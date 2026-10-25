import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

import {
  getSynthesisModelDownloadUrl,
  getSynthesisModelLocalPath,
  SYNTHESIS_MODEL_CATALOG,
  type SynthesisModelDescriptor,
} from './models';

export interface ModelInstallState {
  installed: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  localPath: string;
  verified: boolean;
  statusMessage?: string | null;
}

export interface SynthesisModelView extends SynthesisModelDescriptor, ModelInstallState {
  downloadUrl: string;
}

export interface SynthesisModelDownloadProgress {
  progress: number;
  statusMessage: string | null;
}

const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/models`;
const MODEL_MANIFEST_PATH = `${MODELS_DIR}/manifest.json`;

interface ModelInstallRecord {
  installedAt: string;
  file: string;
  size: number;
  sha256: string;
  sourceUrl: string;
  license: string;
  verified: boolean;
}

type ModelManifest = Record<string, ModelInstallRecord>;
const DOWNLOAD_PHASE_MAX_PROGRESS = 95;
const ANDROID_DOWNLOAD_CHUNK_SIZE = 16 * 1024 * 1024;
const ANDROID_DOWNLOAD_RETRY_LIMIT = 3;
const activeModelDownloads = new Set<string>();
const modelOperationQueues = new Map<string, Promise<void>>();
let manifestOperationQueue = Promise.resolve();

const withModelLocks = async <T>(modelIds: string[], operation: () => Promise<T>): Promise<T> => {
  const ids = [...new Set(modelIds)].sort();
  const run = async (index: number): Promise<T> => {
    if (index === ids.length) {
      return operation();
    }

    const modelId = ids[index];
    const previous = modelOperationQueues.get(modelId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    modelOperationQueues.set(modelId, current);
    await previous;

    try {
      return await run(index + 1);
    } finally {
      release();
      if (modelOperationQueues.get(modelId) === current) {
        modelOperationQueues.delete(modelId);
      }
    }
  };

  return run(0);
};

const withManifestLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previous = manifestOperationQueue;
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  manifestOperationQueue = current;
  await previous;

  try {
    return await operation();
  } finally {
    release();
    if (manifestOperationQueue === current) {
      manifestOperationQueue = Promise.resolve();
    }
  }
};

const emitDownloadProgress = (
  onProgress: ((update: SynthesisModelDownloadProgress) => void) | undefined,
  progress: number,
  statusMessage: string | null,
) => {
  onProgress?.({
    progress: Math.min(100, Math.max(0, progress)),
    statusMessage,
  });
};

const parseFileSize = (size: number | string): number =>
  typeof size === 'number' ? size : Number.parseInt(size, 10);

const hasValidChecksum = (value: string): boolean => /^[a-f0-9]{64}$/i.test(value);

const removePath = async (path: string): Promise<void> => {
  try {
    await RNFS.unlink(path);
  } catch {
    // Ignore cleanup failures.
  }
};

const getFileSize = async (path: string): Promise<number | null> => {
  if (!(await RNFS.exists(path))) {
    return null;
  }

  try {
    return parseFileSize((await RNFS.stat(path)).size);
  } catch {
    return null;
  }
};

type ModelFileVerification = 'verified' | 'invalid' | 'unavailable';

const verifyModelFile = async (
  model: SynthesisModelView,
  path: string,
): Promise<ModelFileVerification> => {
  if (!hasValidChecksum(model.expectedSha256)) return 'unavailable';
  if (!(await RNFS.exists(path))) {
    return 'invalid';
  }

  let size: number;
  try {
    size = parseFileSize((await RNFS.stat(path)).size);
  } catch {
    return 'unavailable';
  }
  if (size !== model.sizeInBytes) {
    return 'invalid';
  }

  try {
    return (await RNFS.hash(path, 'sha256')).toLowerCase() === model.expectedSha256.toLowerCase()
      ? 'verified'
      : 'invalid';
  } catch {
    return 'unavailable';
  }
};

const createInstallRecord = (model: SynthesisModelView): ModelInstallRecord => ({
  installedAt: new Date().toISOString(),
  file: model.modelFile,
  size: model.sizeInBytes,
  sha256: model.expectedSha256,
  sourceUrl: model.sourceUrl,
  license: model.license,
  verified: hasValidChecksum(model.expectedSha256),
});

const manifestRecordMatches = (
  record: ModelInstallRecord | undefined,
  model: SynthesisModelView,
): boolean =>
  Boolean(
    hasValidChecksum(model.expectedSha256) &&
    record?.verified &&
      record.file === model.modelFile &&
      record.size === model.sizeInBytes &&
      record.sha256 === model.expectedSha256 &&
      record.sourceUrl === model.sourceUrl &&
      record.license === model.license,
  );

const canResumeAndroidDownload = (size: number | null, expectedSize: number): size is number =>
  size !== null &&
  size > 0 &&
  size < expectedSize &&
  size % ANDROID_DOWNLOAD_CHUNK_SIZE === 0;

const downloadAndroidModelRanges = async (
  model: SynthesisModelView,
  tempPath: string,
  onProgress: ((update: SynthesisModelDownloadProgress) => void) | undefined,
): Promise<void> => {
  const chunkPath = `${tempPath}.part`;
  let downloadedBytes = (await getFileSize(tempPath)) ?? 0;
  let reportedProgress = 0;

  if (downloadedBytes > 0 && !canResumeAndroidDownload(downloadedBytes, model.sizeInBytes)) {
    await removePath(tempPath);
    downloadedBytes = 0;
  }

  if (downloadedBytes > 0) {
    reportedProgress = Math.round((downloadedBytes / model.sizeInBytes) * DOWNLOAD_PHASE_MAX_PROGRESS);
    emitDownloadProgress(onProgress, reportedProgress, 'Resuming download');
  }

  while (downloadedBytes < model.sizeInBytes) {
    const rangeEnd = Math.min(downloadedBytes + ANDROID_DOWNLOAD_CHUNK_SIZE, model.sizeInBytes) - 1;
    const expectedChunkSize = rangeEnd - downloadedBytes + 1;
    let chunkReady = false;
    let lastError: unknown;

    for (let attempt = 0; attempt < ANDROID_DOWNLOAD_RETRY_LIMIT; attempt += 1) {
      await removePath(chunkPath);
      try {
        let contentRange: string | undefined;
        const result = await RNFS.downloadFile({
          fromUrl: model.downloadUrl,
          toFile: chunkPath,
          headers: { Range: `bytes=${downloadedBytes}-${rangeEnd}` },
          begin: ({ headers }) => {
            contentRange = Object.entries(headers ?? {})
              .find(([name]) => name.toLowerCase() === 'content-range')?.[1];
          },
          connectionTimeout: 30_000,
          readTimeout: 120_000,
          progressDivider: 5,
          progress: ({ bytesWritten }) => {
            reportedProgress = Math.max(
              reportedProgress,
              Math.round(((downloadedBytes + bytesWritten) / model.sizeInBytes) * DOWNLOAD_PHASE_MAX_PROGRESS),
            );
            emitDownloadProgress(onProgress, reportedProgress, 'Downloading model');
          },
        }).promise;

        if (result.statusCode !== 206) {
          throw new Error(`Download range failed with HTTP ${result.statusCode}`);
        }

        const expectedContentRange = `bytes ${downloadedBytes}-${rangeEnd}/${model.sizeInBytes}`;
        if (contentRange?.toLowerCase() !== expectedContentRange) {
          throw new Error(`Download range mismatch: expected ${expectedContentRange}, got ${contentRange ?? 'no Content-Range header'}`);
        }

        const chunkSize = parseFileSize((await RNFS.stat(chunkPath)).size);
        if (chunkSize !== expectedChunkSize) {
          throw new Error(`Download range size mismatch: expected ${expectedChunkSize} bytes, got ${chunkSize} bytes`);
        }

        chunkReady = true;
        break;
      } catch (error) {
        lastError = error;
        await removePath(chunkPath);
      }
    }

    if (!chunkReady) {
      throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Model range download failed'));
    }

    try {
      const chunkContents = await RNFS.readFile(chunkPath, 'base64');
      if (downloadedBytes === 0) {
        await RNFS.writeFile(tempPath, chunkContents, 'base64');
      } else {
        await RNFS.appendFile(tempPath, chunkContents, 'base64');
      }
    } finally {
      await removePath(chunkPath);
    }

    downloadedBytes += expectedChunkSize;
  }
};

const readModelManifest = async (): Promise<ModelManifest> => {
  if (!(await RNFS.exists(MODEL_MANIFEST_PATH))) {
    return {};
  }

  try {
    const rawManifest = await RNFS.readFile(MODEL_MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(rawManifest);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ModelManifest;
    }
  } catch {
    return {};
  }

  return {};
};

const writeModelManifest = async (manifest: ModelManifest): Promise<void> => {
  const tempPath = `${MODEL_MANIFEST_PATH}.download`;
  if (await RNFS.exists(tempPath)) {
    await removePath(tempPath);
  }

  await RNFS.writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf8');

  if (await RNFS.exists(MODEL_MANIFEST_PATH)) {
    await RNFS.unlink(MODEL_MANIFEST_PATH);
  }

  await RNFS.moveFile(tempPath, MODEL_MANIFEST_PATH);
};

export const getSynthesisModels = (): SynthesisModelView[] =>
  SYNTHESIS_MODEL_CATALOG.map(model => ({
    ...model,
    downloadUrl: getSynthesisModelDownloadUrl(model),
    localPath: getSynthesisModelLocalPath(model),
    installed: false,
    downloading: false,
    progress: 0,
    error: null,
    verified: false,
    statusMessage: null,
  }));

const resolveModelViewsLocked = async (models: SynthesisModelView[]): Promise<SynthesisModelView[]> => {
  const manifest = await readModelManifest();
  let manifestChanged = false;
  const recoveredModels = new Set<string>();
  const views: SynthesisModelView[] = [];

  for (const model of models) {
    const installRecord = manifest[model.id];
    let finalExists = await RNFS.exists(model.localPath);
    const manifestMatches = manifestRecordMatches(installRecord, model);
    let installed = finalExists && manifestMatches &&
      (await getFileSize(model.localPath)) === model.sizeInBytes;
    let statusMessage: string | null = null;
    let progress = installed ? 100 : 0;
    let error: string | null = null;

    // Stat matching installs to catch truncation without hashing multi-gigabyte files on every refresh.
    if (!installed && finalExists) {
      const finalVerification = await verifyModelFile(model, model.localPath);
      if (finalVerification === 'verified') {
        installed = true;
        progress = 100;
        manifest[model.id] = createInstallRecord(model);
        manifestChanged = true;
        recoveredModels.add(model.id);
      } else if (finalVerification === 'invalid' && hasValidChecksum(model.expectedSha256)) {
        await removePath(model.localPath);
        finalExists = await RNFS.exists(model.localPath);
        if (finalExists) {
          error = 'Could not remove the outdated model; tap Download to retry.';
          statusMessage = error;
        } else {
          statusMessage = 'Outdated model removed; download again.';
        }
      } else {
        statusMessage = 'Could not verify the existing model; it was kept. Tap Download to retry.';
      }
    }

    if (!installed) {
      const tempPath = `${model.localPath}.download`;
      const tempSize = await getFileSize(tempPath);
      const tempVerification = tempSize === model.sizeInBytes
        ? await verifyModelFile(model, tempPath)
        : 'invalid';
      // A queued download reserves this model before waiting for the same lock.
      if (!activeModelDownloads.has(model.id)) {
        if (tempVerification === 'verified' && !finalExists) {
          try {
            await RNFS.moveFile(tempPath, model.localPath);
            finalExists = true;
            installed = true;
            progress = 100;
            statusMessage = null;
            manifest[model.id] = createInstallRecord(model);
            manifestChanged = true;
            recoveredModels.add(model.id);
          } catch {
            error = 'Verified download is ready; tap Download to finish installing it.';
            statusMessage = error;
          }
        } else if (tempVerification === 'verified' && finalExists) {
          statusMessage = 'Could not verify the existing model; it was kept. Tap Download to retry.';
        } else if (tempVerification === 'unavailable') {
          error = 'Could not verify saved download; tap Download to retry.';
          statusMessage = error;
        } else if (Platform.OS === 'android' && canResumeAndroidDownload(tempSize, model.sizeInBytes)) {
          progress = Math.min(
            DOWNLOAD_PHASE_MAX_PROGRESS - 1,
            Math.round((tempSize / model.sizeInBytes) * DOWNLOAD_PHASE_MAX_PROGRESS),
          );
          statusMessage = 'Download paused';
        } else if (tempSize !== null) {
          await removePath(tempPath);
        }
      }
    }

    views.push({
      ...model,
      installed,
      downloading: activeModelDownloads.has(model.id),
      progress,
      error: error ?? (finalExists && !installed && !statusMessage ? 'Installed; metadata incomplete' : null),
      verified: installed,
      statusMessage: statusMessage ?? (finalExists && !installed ? 'Installed; metadata incomplete' : null),
    });
  }

  if (manifestChanged) {
    try {
      await writeModelManifest(manifest);
    } catch {
      for (const model of views) {
        if (recoveredModels.has(model.id)) {
          model.statusMessage = 'Installed; metadata incomplete';
        }
      }
    }
  }

  return views;
};

export const resolveModelViews = (models: SynthesisModelView[]): Promise<SynthesisModelView[]> =>
  withModelLocks(models.map(model => model.id), () =>
    withManifestLock(() => resolveModelViewsLocked(models)),
  );

export const ensureModelsDirectory = async (): Promise<void> => {
  const exists = await RNFS.exists(MODELS_DIR);
  if (!exists) {
    await RNFS.mkdir(MODELS_DIR);
  }
};

const downloadSynthesisModelLocked = async (
  model: SynthesisModelView,
  onProgress?: (update: SynthesisModelDownloadProgress) => void,
): Promise<SynthesisModelView> => {
  if (!hasValidChecksum(model.expectedSha256)) {
    throw new Error('Model checksum is missing or invalid; refusing to install');
  }
  const tempPath = `${model.localPath}.download`;
  const finalPath = model.localPath;
  let downloadTaskJobId: number | undefined;

  try {
    await ensureModelsDirectory();
    emitDownloadProgress(onProgress, 0, 'Preparing download');

    if (await RNFS.exists(finalPath)) {
      const finalVerification = await verifyModelFile(model, finalPath);
      if (finalVerification === 'verified') {
        return {
          ...model,
          installed: true,
          downloading: false,
          progress: 100,
          error: null,
          verified: true,
          statusMessage: null,
        };
      }
      if (finalVerification === 'unavailable') {
        throw new Error('Could not verify the existing model; it was kept. Try again later.');
      }

      emitDownloadProgress(onProgress, 0, 'Removing outdated model before re-download');
      await removePath(finalPath);
      if (await RNFS.exists(finalPath)) {
        throw new Error('Could not remove the outdated model; free space and try again.');
      }
    }

    const existingTempSize = await getFileSize(tempPath);
    const existingTempVerification = existingTempSize === model.sizeInBytes
      ? await verifyModelFile(model, tempPath)
      : 'invalid';
    if (existingTempVerification === 'unavailable') {
      throw new Error('Could not verify saved model download; try again later');
    }
    const verifiedExistingTemp = existingTempVerification === 'verified';
    if (!verifiedExistingTemp && existingTempSize !== null) {
      const resumable = Platform.OS === 'android' && canResumeAndroidDownload(existingTempSize, model.sizeInBytes);
      if (!resumable) {
        await removePath(tempPath);
      }
    }

    const downloadOptions: Parameters<typeof RNFS.downloadFile>[0] & {
      background?: boolean;
      discretionary?: boolean;
    } = {
      fromUrl: model.downloadUrl,
      toFile: tempPath,
      connectionTimeout: 30_000,
      readTimeout: 120_000,
      progressDivider: 5,
      progress: ({ contentLength, bytesWritten }) => {
        const totalBytes = contentLength > 0 ? contentLength : model.sizeInBytes;
        if (totalBytes > 0) {
          emitDownloadProgress(
            onProgress,
            Math.min(
              DOWNLOAD_PHASE_MAX_PROGRESS,
              Math.max(0, Math.round((bytesWritten / totalBytes) * DOWNLOAD_PHASE_MAX_PROGRESS)),
            ),
            'Downloading model',
          );
        }
      },
    };

    if (Platform.OS === 'ios') {
      downloadOptions.background = true;
      downloadOptions.discretionary = false;
    }

    if (!verifiedExistingTemp) {
      if (Platform.OS === 'android') {
        await downloadAndroidModelRanges(model, tempPath, onProgress);
      } else {
        const downloadTask = RNFS.downloadFile(downloadOptions);
        downloadTaskJobId = (downloadTask as { jobId?: number }).jobId;
        const result = await downloadTask.promise;
        if (result.statusCode < 200 || result.statusCode >= 300) {
          throw new Error(`Download failed with HTTP ${result.statusCode}`);
        }
      }
    }

    emitDownloadProgress(onProgress, 96, 'Verifying download');

    const downloadedSize = parseFileSize((await RNFS.stat(tempPath)).size);
    if (downloadedSize !== model.sizeInBytes) {
      throw new Error(`Download size mismatch: expected ${model.sizeInBytes} bytes, got ${downloadedSize} bytes`);
    }

    if (!verifiedExistingTemp) {
      emitDownloadProgress(onProgress, 97, 'Verifying checksum');
      const downloadedHash = await RNFS.hash(tempPath, 'sha256');
      if (downloadedHash.toLowerCase() !== model.expectedSha256.toLowerCase()) {
        throw new Error(
          `Download checksum mismatch: expected ${model.expectedSha256}, got ${downloadedHash}`,
        );
      }
    }

    emitDownloadProgress(onProgress, 98, 'Installing model');
    await RNFS.moveFile(tempPath, finalPath);

    emitDownloadProgress(onProgress, 99, 'Finalizing installation');
    const manifestWritten = await withManifestLock(async () => {
      const manifest = await readModelManifest();
      manifest[model.id] = createInstallRecord(model);
      try {
        await writeModelManifest(manifest);
        return true;
      } catch {
        return false;
      }
    });

    if (!manifestWritten) {
      emitDownloadProgress(onProgress, 100, 'Installed');
      return {
        ...model,
        installed: true,
        downloading: false,
        progress: 100,
        error: null,
        verified: true,
        statusMessage: 'Installed; metadata incomplete',
      };
    }

    emitDownloadProgress(onProgress, 100, 'Installed');
    return {
      ...model,
      installed: true,
      downloading: false,
      progress: 100,
      error: null,
      verified: true,
      statusMessage: null,
    };
  } catch (error) {
    await removePath(`${tempPath}.part`);
    const tempSize = await getFileSize(tempPath);
    const tempVerification = tempSize === model.sizeInBytes
      ? await verifyModelFile(model, tempPath)
      : 'invalid';
    const keepForRecovery =
      (tempSize === model.sizeInBytes && tempVerification !== 'invalid') ||
      (Platform.OS === 'android' && canResumeAndroidDownload(tempSize, model.sizeInBytes));
    if (!keepForRecovery) {
      await removePath(tempPath);
    }
    throw error;
  } finally {
    if (Platform.OS === 'ios' && typeof downloadTaskJobId === 'number') {
      const completeHandlerIOS = (
        RNFS as unknown as { completeHandlerIOS?: (jobId: number) => Promise<void> | void }
      ).completeHandlerIOS;
      if (typeof completeHandlerIOS === 'function') {
        try {
          await completeHandlerIOS(downloadTaskJobId);
        } catch {
          // Ignore completion-handler errors.
        }
      }
    }
  }
};

export const downloadSynthesisModel = async (
  model: SynthesisModelView,
  onProgress?: (update: SynthesisModelDownloadProgress) => void,
): Promise<SynthesisModelView> => {
  if (activeModelDownloads.has(model.id)) {
    throw new Error(`Model ${model.id} is already downloading`);
  }
  activeModelDownloads.add(model.id);
  try {
    return await withModelLocks([model.id], () => downloadSynthesisModelLocked(model, onProgress));
  } finally {
    activeModelDownloads.delete(model.id);
  }
};

const removeSynthesisModelLocked = async (model: SynthesisModelView): Promise<SynthesisModelView> => {
  if (await RNFS.exists(model.localPath)) {
    await removePath(model.localPath);
  }

  await withManifestLock(async () => {
    const manifest = await readModelManifest();
    if (manifest[model.id]) {
      delete manifest[model.id];
      try {
        if (Object.keys(manifest).length > 0) {
          await writeModelManifest(manifest);
        } else if (await RNFS.exists(MODEL_MANIFEST_PATH)) {
          await removePath(MODEL_MANIFEST_PATH);
        }
      } catch {
        // Keep the model removed even if manifest cleanup fails.
      }
    }
  });

  return {
    ...model,
    installed: false,
    downloading: false,
    progress: 0,
    error: null,
    verified: false,
    statusMessage: null,
  };
};

export const removeSynthesisModel = (model: SynthesisModelView): Promise<SynthesisModelView> =>
  withModelLocks([model.id], () => removeSynthesisModelLocked(model));
