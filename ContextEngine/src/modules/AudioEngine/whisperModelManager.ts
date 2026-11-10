import RNFS from 'react-native-fs';

export type TranscriptionLanguage = 'en' | 'hi';

export const WHISPER_MODEL_SIZE = 32_166_155;
export const WHISPER_MODEL_SHA256 = 'c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b';
export const WHISPER_MODEL_FILE = 'whisper-tiny.en-q5_1.bin';
export const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.en-q5_1.bin';

export const HINDI_WHISPER_MODEL_SIZE = 32_152_673;
export const HINDI_WHISPER_MODEL_SHA256 = '818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7';
export const HINDI_WHISPER_MODEL_FILE = 'whisper-tiny-q5_1.bin';
export const HINDI_WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny-q5_1.bin';

const MODELS: Record<TranscriptionLanguage, { file: string; size: number; sha256: string; url: string }> = {
  en: { file: WHISPER_MODEL_FILE, size: WHISPER_MODEL_SIZE, sha256: WHISPER_MODEL_SHA256, url: WHISPER_MODEL_URL },
  hi: {
    file: HINDI_WHISPER_MODEL_FILE,
    size: HINDI_WHISPER_MODEL_SIZE,
    sha256: HINDI_WHISPER_MODEL_SHA256,
    url: HINDI_WHISPER_MODEL_URL,
  },
};

const MODELS_DIRECTORY = `${RNFS.DocumentDirectoryPath}/models`;
const CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_RANGE_ATTEMPTS = 3;
const DOWNLOAD_PROGRESS_MAX = 95;

export interface WhisperModelDownloadProgress {
  progress: number;
  statusMessage: string;
}

type Verification = 'valid' | 'invalid' | 'unavailable';

const activeDownloads = new Map<TranscriptionLanguage, Promise<string>>();

const modelPath = (language: TranscriptionLanguage): string =>
  `${MODELS_DIRECTORY}/${MODELS[language].file}`;

const fileSize = async (path: string): Promise<number | null> => {
  if (!(await RNFS.exists(path))) return null;
  const size = (await RNFS.stat(path)).size;
  const parsedSize = typeof size === 'number' ? size : Number.parseInt(size, 10);
  return Number.isFinite(parsedSize) ? parsedSize : null;
};

const verifyModel = async (path: string, expected: (typeof MODELS)[TranscriptionLanguage]): Promise<Verification> => {
  try {
    if (!(await RNFS.exists(path))) return 'invalid';
    if (await fileSize(path) !== expected.size) return 'invalid';
    return (await RNFS.hash(path, 'sha256')).toLowerCase() === expected.sha256
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

export const getWhisperModelPath = (language: TranscriptionLanguage = 'en'): string => modelPath(language);

export const isWhisperModelPresent = async (language: TranscriptionLanguage = 'en'): Promise<boolean> => {
  try {
    return (await fileSize(modelPath(language))) === MODELS[language].size;
  } catch {
    return false;
  }
};

export const isWhisperModelInstalled = async (language: TranscriptionLanguage = 'en'): Promise<boolean> =>
  (await verifyModel(modelPath(language), MODELS[language])) === 'valid';

const canResume = (size: number | null, expectedSize: number): size is number =>
  size !== null && size > 0 && size < expectedSize && size % CHUNK_SIZE === 0;

const downloadRanges = async (
  language: TranscriptionLanguage,
  onProgress?: (update: WhisperModelDownloadProgress) => void,
): Promise<void> => {
  const expected = MODELS[language];
  const path = modelPath(language);
  const tempPath = `${path}.download`;
  const chunkPath = `${tempPath}.part`;
  let downloadedBytes = await fileSize(tempPath) ?? 0;
  if (downloadedBytes === expected.size) {
    const existing = await verifyModel(tempPath, expected);
    if (existing === 'valid') return;
    if (existing === 'unavailable') throw new Error('Could not verify the saved voice model download');
    await removePath(tempPath);
    downloadedBytes = 0;
  } else if (downloadedBytes > 0 && !canResume(downloadedBytes, expected.size)) {
    await removePath(tempPath);
    downloadedBytes = 0;
  }

  while (downloadedBytes < expected.size) {
    const rangeEnd = Math.min(downloadedBytes + CHUNK_SIZE, expected.size) - 1;
    const expectedChunkSize = rangeEnd - downloadedBytes + 1;
    let chunkReady = false;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RANGE_ATTEMPTS; attempt += 1) {
      await removePath(chunkPath);
      try {
        let contentRange: string | undefined;
        const result = await RNFS.downloadFile({
          fromUrl: expected.url,
          toFile: chunkPath,
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
              Math.round(((downloadedBytes + bytesWritten) / expected.size) * DOWNLOAD_PROGRESS_MAX),
            ),
            statusMessage: 'Downloading voice model',
          }),
        }).promise;

        if (result.statusCode !== 206) {
          throw new Error(`Voice model download failed with HTTP ${result.statusCode}`);
        }
        const expectedContentRange = `bytes ${downloadedBytes}-${rangeEnd}/${expected.size}`;
        if (contentRange?.toLowerCase() !== expectedContentRange) {
          throw new Error('Voice model download range did not match the requested bytes');
        }
        if (await fileSize(chunkPath) !== expectedChunkSize) {
          throw new Error('Voice model download returned an incomplete range');
        }
        chunkReady = true;
        break;
      } catch (error) {
        lastError = error;
        await removePath(chunkPath);
      }
    }

    if (!chunkReady) {
      throw lastError instanceof Error ? lastError : new Error('Voice model download failed');
    }

    try {
      const chunk = await RNFS.readFile(chunkPath, 'base64');
      if (downloadedBytes === 0) await RNFS.writeFile(tempPath, chunk, 'base64');
      else await RNFS.appendFile(tempPath, chunk, 'base64');
    } finally {
      await removePath(chunkPath);
    }

    downloadedBytes += expectedChunkSize;
  }
};

const installWhisperModel = async (
  language: TranscriptionLanguage,
  onProgress?: (update: WhisperModelDownloadProgress) => void,
): Promise<string> => {
  const expected = MODELS[language];
  const path = modelPath(language);
  const tempPath = `${path}.download`;
  const installed = await verifyModel(path, expected);
  if (installed === 'valid') return path;
  if (installed === 'unavailable') throw new Error('Could not verify the existing voice model');
  await removePath(path);

  if (!(await RNFS.exists(MODELS_DIRECTORY))) await RNFS.mkdir(MODELS_DIRECTORY);
  onProgress?.({ progress: 0, statusMessage: 'Preparing voice model download' });
  await downloadRanges(language, onProgress);

  onProgress?.({ progress: 97, statusMessage: 'Verifying voice model' });
  if (await verifyModel(tempPath, expected) !== 'valid') {
    await removePath(tempPath);
    throw new Error('Downloaded voice model failed its integrity check');
  }

  onProgress?.({ progress: 99, statusMessage: 'Installing voice model' });
  await RNFS.moveFile(tempPath, path);
  onProgress?.({ progress: 100, statusMessage: 'Voice model ready' });
  return path;
};

export const downloadWhisperModel = (
  language: TranscriptionLanguage = 'en',
  onProgress?: (update: WhisperModelDownloadProgress) => void,
): Promise<string> => {
  const active = activeDownloads.get(language);
  if (active) return active;
  const download = installWhisperModel(language, onProgress).finally(() => {
    activeDownloads.delete(language);
  });
  activeDownloads.set(language, download);
  return download;
};
