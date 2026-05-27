import RNFS from 'react-native-fs';

import {
  downloadSynthesisModel,
  getSynthesisModels,
  resolveModelViews,
} from '../modelManager';

describe('modelManager', () => {
  const [model] = getSynthesisModels();

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('verifies size and checksum before moving a downloaded model into place', async () => {
    const progress = jest.fn();

    const installed = await downloadSynthesisModel(model, progress);

    expect(RNFS.mkdir).toHaveBeenCalledWith(`${RNFS.DocumentDirectoryPath}/models`);
    expect(RNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUrl: model.downloadUrl,
        toFile: `${model.localPath}.download`,
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
    expect(progress).toHaveBeenCalledWith(100);
    expect(installed).toMatchObject({
      installed: true,
      verified: true,
      progress: 100,
      statusMessage: null,
      error: null,
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
});
