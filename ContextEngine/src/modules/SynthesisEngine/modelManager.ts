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
}

export interface SynthesisModelView extends SynthesisModelDescriptor, ModelInstallState {
  downloadUrl: string;
}

const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/models`;

export const getSynthesisModels = (): SynthesisModelView[] =>
  SYNTHESIS_MODEL_CATALOG.map(model => ({
    ...model,
    downloadUrl: getSynthesisModelDownloadUrl(model),
    localPath: getSynthesisModelLocalPath(model),
    installed: false,
    downloading: false,
    progress: 0,
    error: null,
  }));

export const resolveModelViews = async (models: SynthesisModelView[]): Promise<SynthesisModelView[]> => {
  return Promise.all(
    models.map(async model => {
      const installed = await RNFS.exists(model.localPath);
      return {
        ...model,
        installed,
        downloading: false,
        progress: installed ? 100 : 0,
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
    await RNFS.unlink(tempPath).catch(() => undefined);
    throw new Error(`Download failed with HTTP ${result.statusCode}`);
  }

  if (await RNFS.exists(finalPath)) {
    await RNFS.unlink(finalPath);
  }

  await RNFS.moveFile(tempPath, finalPath);

  return {
    ...model,
    installed: true,
    downloading: false,
    progress: 100,
    error: null,
  };
};

export const removeSynthesisModel = async (model: SynthesisModelView): Promise<SynthesisModelView> => {
  if (await RNFS.exists(model.localPath)) {
    await RNFS.unlink(model.localPath);
  }

  return {
    ...model,
    installed: false,
    downloading: false,
    progress: 0,
    error: null,
  };
};
