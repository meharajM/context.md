jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

import {
  downloadSynthesisModel,
  getSynthesisModels,
  removeSynthesisModel,
  resolveModelViews,
} from '../modelManager';
import { getSynthesisModelDownloadUrl, SYNTHESIS_MODEL_CATALOG } from '../models';

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('modelManager', () => {
  const [model] = getSynthesisModels();

  it('uses each catalog’s pinned model URL for downloads', () => {
    for (const catalogModel of SYNTHESIS_MODEL_CATALOG) {
      expect(getSynthesisModelDownloadUrl(catalogModel)).toBe(catalogModel.sourceUrl);
      expect(catalogModel.sourceUrl).toMatch(/\/resolve\/[a-f0-9]{40}\//i);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.downloadFile as jest.Mock).mockImplementation(({ progress }) => {
      progress?.({
        jobId: 1,
        contentLength: model.sizeInBytes,
        bytesWritten: model.sizeInBytes,
      });
      return {
        promise: Promise.resolve({ statusCode: 200, bytesWritten: model.sizeInBytes }),
      };
    });
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: model.sizeInBytes });
    (RNFS.hash as jest.Mock).mockResolvedValue(model.expectedSha256);
  });

  it('marks a verified model as installed after reading the manifest', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) =>
      path === `${RNFS.DocumentDirectoryPath}/models/manifest.json` || path === model.localPath,
    );
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({
        [model.id]: {
          installedAt: '2026-05-27T00:00:00.000Z',
          file: model.modelFile,
          size: model.sizeInBytes,
          sha256: model.expectedSha256,
          sourceUrl: model.sourceUrl,
          license: model.license,
          verified: true,
        },
      }),
    );

    const resolved = await resolveModelViews([model]);

    expect(resolved[0]).toMatchObject({
      installed: true,
      verified: true,
      progress: 100,
      error: null,
      statusMessage: null,
    });
  });

  it('recovers a complete verified temp model after an interrupted installation', async () => {
    const tempPath = `${model.localPath}.download`;
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => path === tempPath);
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: model.sizeInBytes });

    const resolved = await resolveModelViews([model]);

    expect(RNFS.hash).toHaveBeenCalledWith(tempPath, 'sha256');
    expect(RNFS.moveFile).toHaveBeenCalledWith(tempPath, model.localPath);
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      `${RNFS.DocumentDirectoryPath}/models/manifest.json.download`,
      expect.stringContaining(model.modelFile),
      'utf8',
    );
    expect(resolved[0]).toMatchObject({ installed: true, verified: true, progress: 100 });
    expect(RNFS.downloadFile).not.toHaveBeenCalled();
  });

  it('leaves a temp candidate untouched when a download starts during refresh verification', async () => {
    const tempPath = `${model.localPath}.download`;
    let releaseRefreshHash!: () => void;
    let releaseDownloadHash!: () => void;
    let refreshHashStarted!: () => void;
    let downloadHashStarted!: () => void;
    const refreshHashGate = new Promise<void>(resolve => {
      releaseRefreshHash = resolve;
    });
    const downloadHashGate = new Promise<void>(resolve => {
      releaseDownloadHash = resolve;
    });
    const refreshHash = new Promise<void>(resolve => {
      refreshHashStarted = resolve;
    });
    const downloadHash = new Promise<void>(resolve => {
      downloadHashStarted = resolve;
    });
    let hashCalls = 0;

    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => path === tempPath);
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: model.sizeInBytes });
    (RNFS.hash as jest.Mock).mockImplementation(async () => {
      hashCalls += 1;
      if (hashCalls === 1) {
        refreshHashStarted();
        await refreshHashGate;
      } else if (hashCalls === 2) {
        downloadHashStarted();
        await downloadHashGate;
      }
      return model.expectedSha256;
    });

    const refresh = resolveModelViews([model]);
    await refreshHash;
    const download = downloadSynthesisModel(model);

    try {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(hashCalls).toBe(1);
      releaseRefreshHash();
      const [resolved] = await Promise.all([refresh, downloadHash]);

      expect(resolved[0]).toMatchObject({ installed: false, downloading: true });
      expect(RNFS.moveFile).not.toHaveBeenCalledWith(tempPath, model.localPath);
      expect(RNFS.unlink).not.toHaveBeenCalledWith(tempPath);
    } finally {
      releaseRefreshHash();
      releaseDownloadHash();
    }

    await download;
    const candidatePromotions = (RNFS.moveFile as jest.Mock).mock.calls.filter(
      ([from, to]) => from === tempPath && to === model.localPath,
    );
    expect(candidatePromotions).toHaveLength(1);
  });

  it('waits for recovery to finish before removing a model', async () => {
    const manifestPath = `${RNFS.DocumentDirectoryPath}/models/manifest.json`;
    const hashGate = deferred();
    const hashStarted = deferred();
    const events: string[] = [];
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) =>
      path === manifestPath || path === model.localPath,
    );
    (RNFS.readFile as jest.Mock).mockResolvedValue('{}');
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: model.sizeInBytes });
    (RNFS.hash as jest.Mock).mockImplementation(async () => {
      hashStarted.resolve();
      await hashGate.promise;
      return model.expectedSha256;
    });
    (RNFS.unlink as jest.Mock).mockImplementation(async (path: string) => {
      if (path === model.localPath) events.push('remove-model');
    });
    (RNFS.writeFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path === `${manifestPath}.download`) events.push('write-manifest');
    });
    (RNFS.moveFile as jest.Mock).mockImplementation(async (from: string, to: string) => {
      if (from === `${manifestPath}.download` && to === manifestPath) events.push('commit-manifest');
    });

    const refresh = resolveModelViews([model]);
    await hashStarted.promise;
    const removal = removeSynthesisModel(model);

    try {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(RNFS.unlink).not.toHaveBeenCalledWith(model.localPath);
      hashGate.resolve();
      await Promise.all([refresh, removal]);
    } finally {
      hashGate.resolve();
    }

    expect(events.indexOf('commit-manifest')).toBeLessThan(events.indexOf('remove-model'));
  });

  it('serializes manifest updates from downloads of different models', async () => {
    const [firstModel, secondModel] = getSynthesisModels();
    const manifestPath = `${RNFS.DocumentDirectoryPath}/models/manifest.json`;
    const manifestTempPath = `${manifestPath}.download`;
    const manifestWriteStarted = deferred();
    const releaseManifestWrite = deferred();
    const bothModelsMoved = deferred();
    const downloadedTemps = new Set<string>();
    const installedModels = new Set<string>();
    let manifestExists = true;
    let manifest: Record<string, unknown> = {};
    let pendingManifest = '';
    let modelMoves = 0;
    let heldFirstManifestWrite = false;

    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => {
      if (path === manifestPath) return manifestExists;
      if (path === manifestTempPath) return pendingManifest !== '';
      if (path === `${RNFS.DocumentDirectoryPath}/models`) return true;
      if (path.endsWith('.download')) return downloadedTemps.has(path);
      return installedModels.has(path);
    });
    (RNFS.readFile as jest.Mock).mockImplementation(async (path: string) =>
      path === manifestPath ? JSON.stringify(manifest) : '',
    );
    (RNFS.stat as jest.Mock).mockImplementation(async (path: string) => {
      const candidate = [firstModel, secondModel].find(
        item => path === item.localPath || path === `${item.localPath}.download`,
      );
      return { size: candidate?.sizeInBytes ?? 0 };
    });
    (RNFS.hash as jest.Mock).mockImplementation(async (path: string) => {
      const candidate = [firstModel, secondModel].find(item => path === `${item.localPath}.download`);
      return candidate?.expectedSha256 ?? '';
    });
    (RNFS.downloadFile as jest.Mock).mockImplementation(({ toFile, progress }) => {
      const candidate = [firstModel, secondModel].find(item => toFile === `${item.localPath}.download`);
      downloadedTemps.add(toFile);
      progress?.({ jobId: 1, contentLength: candidate?.sizeInBytes ?? 1, bytesWritten: candidate?.sizeInBytes ?? 1 });
      return { promise: Promise.resolve({ statusCode: 200, bytesWritten: candidate?.sizeInBytes ?? 1 }) };
    });
    (RNFS.writeFile as jest.Mock).mockImplementation(async (path: string, contents: string) => {
      if (path !== manifestTempPath) return;
      if (!heldFirstManifestWrite) {
        heldFirstManifestWrite = true;
        manifestWriteStarted.resolve();
        await releaseManifestWrite.promise;
      }
      pendingManifest = contents;
    });
    (RNFS.unlink as jest.Mock).mockImplementation(async (path: string) => {
      if (path === manifestPath) manifestExists = false;
      if (downloadedTemps.has(path)) downloadedTemps.delete(path);
    });
    (RNFS.moveFile as jest.Mock).mockImplementation(async (from: string, to: string) => {
      if (from === manifestTempPath && to === manifestPath) {
        manifest = JSON.parse(pendingManifest) as Record<string, unknown>;
        pendingManifest = '';
        manifestExists = true;
      } else {
        downloadedTemps.delete(from);
        installedModels.add(to);
        modelMoves += 1;
        if (modelMoves === 2) bothModelsMoved.resolve();
      }
    });

    const downloads = [downloadSynthesisModel(firstModel), downloadSynthesisModel(secondModel)];
    try {
      await Promise.all([manifestWriteStarted.promise, bothModelsMoved.promise]);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(RNFS.readFile).toHaveBeenCalledTimes(1);
    } finally {
      releaseManifestWrite.resolve();
    }

    await Promise.all(downloads);
    expect(manifest).toHaveProperty(firstModel.id);
    expect(manifest).toHaveProperty(secondModel.id);
  });

  it('repairs manifest metadata when a verified final model survived a previous interruption', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) =>
      path === `${RNFS.DocumentDirectoryPath}/models/manifest.json` || path === model.localPath,
    );
    (RNFS.readFile as jest.Mock).mockResolvedValue('{}');
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: model.sizeInBytes });

    const resolved = await resolveModelViews([model]);

    expect(RNFS.hash).toHaveBeenCalledWith(model.localPath, 'sha256');
    expect(RNFS.moveFile).not.toHaveBeenCalledWith(model.localPath, expect.anything());
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      `${RNFS.DocumentDirectoryPath}/models/manifest.json.download`,
      expect.stringContaining(model.modelFile),
      'utf8',
    );
    expect(resolved[0]).toMatchObject({ installed: true, verified: true, progress: 100 });
  });

  it('removes a truncated final model even when its manifest still matches', async () => {
    const manifestPath = `${RNFS.DocumentDirectoryPath}/models/manifest.json`;
    let finalExists = true;
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) =>
      path === manifestPath || (path === model.localPath && finalExists),
    );
    (RNFS.readFile as jest.Mock).mockResolvedValue(JSON.stringify({
      [model.id]: {
        installedAt: '2026-05-27T00:00:00.000Z',
        file: model.modelFile,
        size: model.sizeInBytes,
        sha256: model.expectedSha256,
        sourceUrl: model.sourceUrl,
        license: model.license,
        verified: true,
      },
    }));
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: model.sizeInBytes - 1 });
    (RNFS.unlink as jest.Mock).mockImplementation(async (path: string) => {
      if (path === model.localPath) finalExists = false;
    });

    const [resolved] = await resolveModelViews([model]);

    expect(RNFS.unlink).toHaveBeenCalledWith(model.localPath);
    expect(RNFS.hash).not.toHaveBeenCalledWith(model.localPath, 'sha256');
    expect(resolved).toMatchObject({
      installed: false,
      error: null,
      statusMessage: 'Outdated model removed; download again.',
    });
  });

  it('preserves a valid final model instead of downloading or deleting it again', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => path === model.localPath);

    const installed = await downloadSynthesisModel(model);

    expect(RNFS.hash).toHaveBeenCalledWith(model.localPath, 'sha256');
    expect(RNFS.downloadFile).not.toHaveBeenCalled();
    expect(RNFS.unlink).not.toHaveBeenCalledWith(model.localPath);
    expect(installed).toMatchObject({ installed: true, verified: true, progress: 100 });
  });

  it('keeps an existing final model when file verification is unavailable', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => path === model.localPath);
    (RNFS.hash as jest.Mock).mockRejectedValueOnce(new Error('hash unavailable'));

    await expect(downloadSynthesisModel(model)).rejects.toThrow(
      'Could not verify the existing model; it was kept.',
    );

    expect(RNFS.downloadFile).not.toHaveBeenCalled();
    expect(RNFS.unlink).not.toHaveBeenCalledWith(model.localPath);
  });

  it('reports saved Android range progress as paused so the user can resume', async () => {
    (Platform as any).OS = 'android';
    const tempPath = `${model.localPath}.download`;
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => path === tempPath);
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: 16 * 1024 * 1024 });

    const [resolved] = await resolveModelViews([model]);

    expect(resolved).toMatchObject({
      installed: false,
      downloading: false,
      progress: Math.round(((16 * 1024 * 1024) / model.sizeInBytes) * 95),
      statusMessage: 'Download paused',
    });
  });

  it('verifies size and checksum before moving a downloaded model into place', async () => {
    const progress = jest.fn();

    const installed = await downloadSynthesisModel(model, progress);

    expect(RNFS.mkdir).toHaveBeenCalledWith(`${RNFS.DocumentDirectoryPath}/models`);
    expect(RNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUrl: model.downloadUrl,
        toFile: `${model.localPath}.download`,
        connectionTimeout: 30_000,
        readTimeout: 120_000,
        background: true,
        discretionary: false,
      }),
    );
    expect(RNFS.stat).toHaveBeenCalledWith(`${model.localPath}.download`);
    expect(RNFS.hash).toHaveBeenCalledWith(`${model.localPath}.download`, 'sha256');
    expect(RNFS.moveFile).toHaveBeenCalledWith(`${model.localPath}.download`, model.localPath);
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      `${RNFS.DocumentDirectoryPath}/models/manifest.json.download`,
      expect.stringContaining(model.modelFile),
      'utf8',
    );
    expect(progress).toHaveBeenCalledWith({
      progress: 0,
      statusMessage: 'Preparing download',
    });
    expect(progress).toHaveBeenCalledWith({
      progress: 95,
      statusMessage: 'Downloading model',
    });
    expect(progress).toHaveBeenCalledWith({
      progress: 96,
      statusMessage: 'Verifying download',
    });
    expect(progress).toHaveBeenCalledWith({
      progress: 97,
      statusMessage: 'Verifying checksum',
    });
    expect(progress).toHaveBeenCalledWith({
      progress: 98,
      statusMessage: 'Installing model',
    });
    expect(progress).toHaveBeenCalledWith({
      progress: 99,
      statusMessage: 'Finalizing installation',
    });
    expect(progress).toHaveBeenCalledWith({
      progress: 100,
      statusMessage: 'Installed',
    });
    expect(installed).toMatchObject({
      installed: true,
      verified: true,
      progress: 100,
      statusMessage: null,
      error: null,
    });
  });

  it('derives progress from the expected model size when the server omits content length', async () => {
    (RNFS.downloadFile as jest.Mock).mockImplementation(({ progress }) => {
      progress?.({
        jobId: 1,
        contentLength: 0,
        bytesWritten: Math.round(model.sizeInBytes / 2),
      });
      return {
        promise: Promise.resolve({ statusCode: 200, bytesWritten: Math.round(model.sizeInBytes / 2) }),
      };
    });

    const progress = jest.fn();
    await downloadSynthesisModel(model, progress);

    expect(progress).toHaveBeenCalledWith({
      progress: 48,
      statusMessage: 'Downloading model',
    });
  });

  it('cleans up the temp file when the HTTP download fails', async () => {
    (RNFS.downloadFile as jest.Mock).mockReturnValueOnce({
      promise: Promise.resolve({ statusCode: 404, bytesWritten: 0 }),
    });

    await expect(downloadSynthesisModel(model)).rejects.toThrow('Download failed with HTTP 404');
    expect(RNFS.unlink).toHaveBeenCalledWith(`${model.localPath}.download`);
    expect(RNFS.moveFile).not.toHaveBeenCalledWith(`${model.localPath}.download`, model.localPath);
  });

  it('cleans up the partial temp file when the download request rejects', async () => {
    (RNFS.downloadFile as jest.Mock).mockReturnValueOnce({
      promise: Promise.reject(new Error('read timeout')),
    });

    await expect(downloadSynthesisModel(model)).rejects.toThrow('read timeout');
    expect(RNFS.unlink).toHaveBeenCalledWith(`${model.localPath}.download`);
    expect(RNFS.moveFile).not.toHaveBeenCalledWith(`${model.localPath}.download`, model.localPath);
  });

  it('downloads Android models in verified byte ranges and retries a failed range', async () => {
    (Platform as any).OS = 'android';
    const rangedModel = {
      ...model,
      sizeInBytes: 16 * 1024 * 1024 + 3,
    };
    const firstRange = `bytes=0-${16 * 1024 * 1024 - 1}`;
    const lastRange = `bytes=${16 * 1024 * 1024}-${16 * 1024 * 1024 + 2}`;
    let failedFirstRange = false;
    let lastChunkSize = 0;

    (RNFS.downloadFile as jest.Mock).mockImplementation(({ headers, progress, begin }) => {
      const match = headers.Range.match(/^bytes=(\d+)-(\d+)$/);
      const offset = Number(match[1]);
      const end = Number(match[2]);
      lastChunkSize = end - offset + 1;
      if (headers.Range === firstRange && !failedFirstRange) {
        failedFirstRange = true;
        return { promise: Promise.reject(new Error('temporary stream reset')) };
      }
      begin?.({ headers: { 'Content-Range': `bytes ${offset}-${end}/${rangedModel.sizeInBytes}` } });
      progress?.({ jobId: 1, contentLength: lastChunkSize, bytesWritten: lastChunkSize });
      return { promise: Promise.resolve({ statusCode: 206, bytesWritten: lastChunkSize }) };
    });
    (RNFS.stat as jest.Mock).mockImplementation(async (path: string) =>
      path.endsWith('.part') ? { size: lastChunkSize } : { size: rangedModel.sizeInBytes },
    );
    (RNFS.readFile as jest.Mock).mockResolvedValue('YQ==');
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    (RNFS.appendFile as jest.Mock).mockResolvedValue(undefined);

    const installed = await downloadSynthesisModel(rangedModel);

    expect(RNFS.downloadFile).toHaveBeenCalledTimes(3);
    expect((RNFS.downloadFile as jest.Mock).mock.calls.map(([options]) => options.headers.Range)).toEqual([
      firstRange,
      firstRange,
      lastRange,
    ]);
    expect(RNFS.writeFile).toHaveBeenCalledWith(`${model.localPath}.download`, 'YQ==', 'base64');
    expect(RNFS.appendFile).toHaveBeenCalledWith(`${model.localPath}.download`, 'YQ==', 'base64');
    expect(installed).toMatchObject({ installed: true, verified: true, progress: 100 });
  });

  it('resumes Android downloads from the last complete 16 MiB range', async () => {
    (Platform as any).OS = 'android';
    const chunkSize = 16 * 1024 * 1024;
    const rangedModel = { ...model, sizeInBytes: chunkSize + 3 };
    const tempPath = `${model.localPath}.download`;
    let tempSize = chunkSize;
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => path === tempPath);
    (RNFS.stat as jest.Mock).mockImplementation(async (path: string) => ({
      size: path === `${tempPath}.part` ? 3 : tempSize,
    }));
    (RNFS.downloadFile as jest.Mock).mockImplementation(({ headers, begin }: any) => {
      expect(headers.Range).toBe(`bytes=${chunkSize}-${chunkSize + 2}`);
      begin?.({ headers: { 'Content-Range': `bytes ${chunkSize}-${chunkSize + 2}/${rangedModel.sizeInBytes}` } });
      return { promise: Promise.resolve({ statusCode: 206, bytesWritten: 3 }) };
    });
    (RNFS.appendFile as jest.Mock).mockImplementation(async () => {
      tempSize = rangedModel.sizeInBytes;
    });
    (RNFS.readFile as jest.Mock).mockResolvedValue('YQ==');

    const progress = jest.fn();
    const installed = await downloadSynthesisModel(rangedModel, progress);

    expect(RNFS.downloadFile).toHaveBeenCalledTimes(1);
    expect(RNFS.unlink).not.toHaveBeenCalledWith(tempPath);
    expect(progress).toHaveBeenCalledWith({ progress: 95, statusMessage: 'Resuming download' });
    expect(installed).toMatchObject({ installed: true, verified: true, progress: 100 });
  });

  it('rejects Android ranges that return the wrong Content-Range even when the chunk size matches', async () => {
    (Platform as any).OS = 'android';
    const rangedModel = { ...model, sizeInBytes: 16 * 1024 * 1024 + 3 };
    (RNFS.downloadFile as jest.Mock).mockImplementation(({ headers, begin }: any) => {
      const match = headers.Range.match(/^bytes=(\d+)-(\d+)$/);
      const offset = Number(match[1]);
      const end = Number(match[2]);
      begin?.({ headers: { 'Content-Range': `bytes ${offset + 1}-${end + 1}/${rangedModel.sizeInBytes}` } });
      return { promise: Promise.resolve({ statusCode: 206, bytesWritten: 16 * 1024 * 1024 }) };
    });
    (RNFS.stat as jest.Mock).mockImplementation(async (path: string) => ({
      size: path.endsWith('.part') ? 16 * 1024 * 1024 : 0,
    }));

    await expect(downloadSynthesisModel(rangedModel)).rejects.toThrow('Download range mismatch');
    expect(RNFS.writeFile).not.toHaveBeenCalledWith(`${model.localPath}.download`, expect.anything(), 'base64');
    expect(RNFS.appendFile).not.toHaveBeenCalled();
    expect(RNFS.moveFile).not.toHaveBeenCalledWith(`${model.localPath}.download`, model.localPath);
  });

  it('cleans up the temp file when the size is wrong', async () => {
    (RNFS.stat as jest.Mock).mockResolvedValueOnce({ size: model.sizeInBytes - 1 });

    await expect(downloadSynthesisModel(model)).rejects.toThrow('Download size mismatch');
    expect(RNFS.unlink).toHaveBeenCalledWith(`${model.localPath}.download`);
    expect(RNFS.hash).not.toHaveBeenCalledWith(`${model.localPath}.download`, 'sha256');
  });

  it('cleans up the temp file when the checksum is wrong', async () => {
    (RNFS.hash as jest.Mock).mockResolvedValueOnce('deadbeef');

    await expect(downloadSynthesisModel(model)).rejects.toThrow('Download checksum mismatch');
    expect(RNFS.unlink).toHaveBeenCalledWith(`${model.localPath}.download`);
  });

  it('refuses models with missing or invalid checksums before touching model files', async () => {
    const checksumMissingModel = {
      ...model,
      expectedSha256: '',
    };

    await expect(downloadSynthesisModel(checksumMissingModel)).rejects.toThrow('Model checksum is missing or invalid');

    expect(RNFS.downloadFile).not.toHaveBeenCalled();
    expect(RNFS.moveFile).not.toHaveBeenCalled();
    expect(RNFS.writeFile).not.toHaveBeenCalled();
  });
});
