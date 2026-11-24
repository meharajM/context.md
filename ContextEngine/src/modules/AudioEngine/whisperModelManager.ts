import RNFS from 'react-native-fs';

import type { TranscriptionLanguage } from '../../shared/languages/transcriptionLanguages';

interface WhisperModelDefinition {
  file: string;
  size: number;
  sha256: string;
  url: string;
  label: string;
}

const ENGLISH_MODEL: WhisperModelDefinition = {
  file: 'whisper-tiny.en-q5_1.bin',
  size: 32_166_155,
  sha256: 'c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.en-q5_1.bin',
  label: 'Whisper tiny.en',
};

const MULTILINGUAL_MODEL: WhisperModelDefinition = {
  file: 'whisper-tiny-multilingual-q5_1.bin',
  size: 32_152_673,
  sha256: '818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/fb5ed9369c26eaf08392504d8446da431e0fffb9/ggml-tiny-q5_1.bin',
  label: 'Whisper tiny multilingual',
};

// Retain the English constants for existing callers and Android download scheduling.
export const WHISPER_MODEL_SIZE = ENGLISH_MODEL.size;
export const WHISPER_MODEL_SHA256 = ENGLISH_MODEL.sha256;
export const WHISPER_MODEL_FILE = ENGLISH_MODEL.file;
export const WHISPER_MODEL_URL = ENGLISH_MODEL.url;

const MODELS_DIRECTORY = `${RNFS.DocumentDirectoryPath}/models`;
const CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_RANGE_ATTEMPTS = 3;
const DOWNLOAD_PROGRESS_MAX = 95;

export interface WhisperModelDownloadProgress {
  progress: number;
  statusMessage: string;
}

type Verification = 'valid' | 'invalid' | 'unavailable';

const activeDownloads = new Map<string, Promise<string>>();

const modelForLanguage = (language: TranscriptionLanguage): WhisperModelDefinition =>
  language === 'en' ? ENGLISH_MODEL : MULTILINGUAL_MODEL;

const pathsForModel = (model: WhisperModelDefinition) => {
  const modelPath = `${MODELS_DIRECTORY}/${model.file}`;
  const tempPath = `${modelPath}.download`;
  return { modelPath, tempPath, chunkPath: `${tempPath}.part` };
};

export const getWhisperModelPath = (language: TranscriptionLanguage = 'en'): string =>
  pathsForModel(modelForLanguage(language)).modelPath;

export const getWhisperModelSize = (language: TranscriptionLanguage = 'en'): number =>
  modelForLanguage(language).size;

export const getWhisperModelLabel = (language: TranscriptionLanguage = 'en'): string =>
  modelForLanguage(language).label;

const fileSize = async (path: string): Promise<number | null> => {
  if (!(await RNFS.exists(path))) return null;
  const size = (await RNFS.stat(path)).size;
  const parsedSize = typeof size === 'number' ? size : Number.parseInt(size, 10);
  return Number.isFinite(parsedSize) ? parsedSize : null;
};

const verifyModel = async (path: string, model: WhisperModelDefinition): Promise<Verification> => {
  try {
    if (!(await RNFS.exists(path))) return 'invalid';
    if (await fileSize(path) !== model.size) return 'invalid';
    return (await RNFS.hash(path, 'sha256')).toLowerCase() === model.sha256
      ? 'valid'
      : 'invalid';
  } catch {
    return 'unavailable';
  }
};

const removePath = async (path: string): Promise<void> => {
  try {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  } catch {
    // A later retry can clean an incomplete file if storage is temporarily unavailable.
  }
};

export const isWhisperModelInstalled = async (
  language: TranscriptionLanguage = 'en',
): Promise<boolean> => {
  const model = modelForLanguage(language);
  return (await verifyModel(pathsForModel(model).modelPath, model)) === 'valid';
};

const canResume = (size: number | null, model: WhisperModelDefinition): size is number =>
  size !== null && size > 0 && size < model.size && size % CHUNK_SIZE === 0;

const downloadRanges = async (
  model: WhisperModelDefinition,
  paths: ReturnType<typeof pathsForModel>,
  onProgress?: (update: WhisperModelDownloadProgress) => void,
): Promise<void> => {
  let downloadedBytes = await fileSize(paths.tempPath) ?? 0;
  if (downloadedBytes === model.size) {
    const existing = await verifyModel(paths.tempPath, model);
    if (existing === 'valid') return;
    if (existing === 'unavailable') throw new Error(`Could not verify the saved ${model.label} download`);
    await removePath(paths.tempPath);
    downloadedBytes = 0;
  } else if (downloadedBytes > 0 && !canResume(downloadedBytes, model)) {
    await removePath(paths.tempPath);
    downloadedBytes = 0;
  }

  while (downloadedBytes < model.size) {
    const rangeEnd = Math.min(downloadedBytes + CHUNK_SIZE, model.size) - 1;
    const expectedChunkSize = rangeEnd - downloadedBytes + 1;
    let chunkReady = false;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RANGE_ATTEMPTS; attempt += 1) {
      await removePath(paths.chunkPath);
      try {
        let contentRange: string | undefined;
        const result = await RNFS.downloadFile({
          fromUrl: model.url,
          toFile: paths.chunkPath,
          headers: { Range: `bytes=${downloadedBytes}-${rangeEnd}` },
          begin: ({ headers }) => {
            contentRange = Object.entries(headers ?? {})
              .find(([name]) => name.toLowerCase() === 'content-range')?.[1];
          },
          connectionTimeout: 30_000,
          readTimeout: 120_000,
          progressDivider: 5,
          progress: ({ bytesWritten }) => onProgress?.({
            progress: Math.min(
              DOWNLOAD_PROGRESS_MAX,
              Math.round(((downloadedBytes + bytesWritten) / model.size) * DOWNLOAD_PROGRESS_MAX),
            ),
            statusMessage: `Downloading ${model.label}`,
          }),
        }).promise;

        if (result.statusCode !== 206) {
          throw new Error(`${model.label} download failed with HTTP ${result.statusCode}`);
        }
        const expectedContentRange = `bytes ${downloadedBytes}-${rangeEnd}/${model.size}`;
        if (contentRange?.toLowerCase() !== expectedContentRange) {
          throw new Error(`${model.label} download range did not match the requested bytes`);
        }
        if (await fileSize(paths.chunkPath) !== expectedChunkSize) {
          throw new Error(`${model.label} download returned an incomplete range`);
        }
        chunkReady = true;
        break;
      } catch (error) {
        lastError = error;
        await removePath(paths.chunkPath);
      }
    }

    if (!chunkReady) {
      throw lastError instanceof Error ? lastError : new Error(`${model.label} download failed`);
    }

    try {
      const chunk = await RNFS.readFile(paths.chunkPath, 'base64');
      if (downloadedBytes === 0) await RNFS.writeFile(paths.tempPath, chunk, 'base64');
      else await RNFS.appendFile(paths.tempPath, chunk, 'base64');
    } finally {
      await removePath(paths.chunkPath);
    }

    downloadedBytes += expectedChunkSize;
  }
};

const installWhisperModel = async (
  language: TranscriptionLanguage,
  onProgress?: (update: WhisperModelDownloadProgress) => void,
): Promise<string> => {
  const model = modelForLanguage(language);
  const paths = pathsForModel(model);
  const installed = await verifyModel(paths.modelPath, model);
  if (installed === 'valid') return paths.modelPath;
  if (installed === 'unavailable') throw new Error(`Could not verify the existing ${model.label}`);
  await removePath(paths.modelPath);

  if (!(await RNFS.exists(MODELS_DIRECTORY))) await RNFS.mkdir(MODELS_DIRECTORY);
  onProgress?.({ progress: 0, statusMessage: `Preparing ${model.label} download` });
  await downloadRanges(model, paths, onProgress);

  onProgress?.({ progress: 97, statusMessage: `Verifying ${model.label}` });
  if (await verifyModel(paths.tempPath, model) !== 'valid') {
    await removePath(paths.tempPath);
    throw new Error(`Downloaded ${model.label} failed its integrity check`);
  }

  onProgress?.({ progress: 99, statusMessage: `Installing ${model.label}` });
  await RNFS.moveFile(paths.tempPath, paths.modelPath);
  onProgress?.({ progress: 100, statusMessage: 'Voice model ready' });
  return paths.modelPath;
};

export const downloadWhisperModel = (
  onProgress?: (update: WhisperModelDownloadProgress) => void,
  language: TranscriptionLanguage = 'en',
): Promise<string> => {
  const model = modelForLanguage(language);
  const active = activeDownloads.get(model.file);
  if (active) return active;
  const download = installWhisperModel(language, onProgress).finally(() => {
    activeDownloads.delete(model.file);
  });
  activeDownloads.set(model.file, download);
  return download;
};
