import RNFS from 'react-native-fs';

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

const removePath = async (path: string): Promise<void> => {
  try {
    await RNFS.unlink(path);
  } catch {
    // Ignore cleanup failures.
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

export const resolveModelViews = async (models: SynthesisModelView[]): Promise<SynthesisModelView[]> => {
  const manifest = await readModelManifest();

  return Promise.all(
    models.map(async model => {
      const installed = await RNFS.exists(model.localPath);
      const installRecord = manifest[model.id];
      const verified =
        installed &&
        Boolean(installRecord?.verified) &&
        installRecord?.file === model.modelFile &&
        installRecord?.size === model.sizeInBytes &&
        installRecord?.sha256 === model.expectedSha256 &&
        installRecord?.sourceUrl === model.sourceUrl &&
        installRecord?.license === model.license;

      return {
        ...model,
        installed: verified,
        downloading: false,
        progress: verified ? 100 : 0,
        error: installed && !verified ? 'Installed; metadata incomplete' : null,
        verified,
        statusMessage: installed && !verified ? 'Installed; metadata incomplete' : null,
      };
    }),
  );
};

export const ensureModelsDirectory = async (): Promise<void> => {
  const exists = await RNFS.exists(MODELS_DIR);
  if (!exists) {
    await RNFS.mkdir(MODELS_DIR);
  }
};

export const downloadSynthesisModel = async (
  model: SynthesisModelView,
  onProgress?: (progress: number) => void,
): Promise<SynthesisModelView> => {
  await ensureModelsDirectory();

  const tempPath = `${model.localPath}.download`;
  const finalPath = model.localPath;

  if (await RNFS.exists(tempPath)) {
    await RNFS.unlink(tempPath).catch(() => undefined);
  }

  const downloadTask = RNFS.downloadFile({
    fromUrl: model.downloadUrl,
    toFile: tempPath,
    progressDivider: 5,
    progress: ({ contentLength, bytesWritten }) => {
      if (contentLength > 0) {
        onProgress?.(Math.round((bytesWritten / contentLength) * 100));
      }
    },
  });

  const result = await downloadTask.promise;
  if (result.statusCode < 200 || result.statusCode >= 300) {
    await removePath(tempPath);
    throw new Error(`Download failed with HTTP ${result.statusCode}`);
  }

  const downloadedSize = (await RNFS.stat(tempPath)).size;
  if (downloadedSize !== model.sizeInBytes) {
    await removePath(tempPath);
    throw new Error(`Download size mismatch: expected ${model.sizeInBytes} bytes, got ${downloadedSize} bytes`);
  }

  const downloadedHash = await RNFS.hash(tempPath, 'sha256');
  if (downloadedHash.toLowerCase() !== model.expectedSha256.toLowerCase()) {
    await removePath(tempPath);
    throw new Error(
      `Download checksum mismatch: expected ${model.expectedSha256}, got ${downloadedHash}`,
    );
  }

  if (await RNFS.exists(finalPath)) {
    await removePath(finalPath);
  }

  await RNFS.moveFile(tempPath, finalPath);

  const manifest = await readModelManifest();
  manifest[model.id] = {
    installedAt: new Date().toISOString(),
    file: model.modelFile,
    size: model.sizeInBytes,
    sha256: model.expectedSha256,
    sourceUrl: model.sourceUrl,
    license: model.license,
    verified: true,
  };

  try {
    await writeModelManifest(manifest);
  } catch {
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

  return {
    ...model,
    installed: true,
    downloading: false,
    progress: 100,
    error: null,
    verified: true,
    statusMessage: null,
  };
};

export const removeSynthesisModel = async (model: SynthesisModelView): Promise<SynthesisModelView> => {
  if (await RNFS.exists(model.localPath)) {
    await removePath(model.localPath);
  }

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
