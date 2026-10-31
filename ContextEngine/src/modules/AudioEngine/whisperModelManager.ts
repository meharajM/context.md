import RNFS from 'react-native-fs';

export const WHISPER_MODEL_SIZE = 32_166_155;
export const WHISPER_MODEL_SHA256 = 'c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b';
export const WHISPER_MODEL_FILE = 'whisper-tiny.en-q5_1.bin';
export const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.en-q5_1.bin';

const MODELS_DIRECTORY = `${RNFS.DocumentDirectoryPath}/models`;
const MODEL_PATH = `${MODELS_DIRECTORY}/${WHISPER_MODEL_FILE}`;
const TEMP_PATH = `${MODEL_PATH}.download`;
const CHUNK_PATH = `${TEMP_PATH}.part`;
const CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_RANGE_ATTEMPTS = 3;
const DOWNLOAD_PROGRESS_MAX = 95;

export interface WhisperModelDownloadProgress {
  progress: number;
  statusMessage: string;
}

type Verification = 'valid' | 'invalid' | 'unavailable';

let activeDownload: Promise<string> | null = null;

const fileSize = async (path: string): Promise<number | null> => {
  if (!(await RNFS.exists(path))) return null;
  const size = (await RNFS.stat(path)).size;
  const parsedSize = typeof size === 'number' ? size : Number.parseInt(size, 10);
  return Number.isFinite(parsedSize) ? parsedSize : null;
};

const verifyModel = async (path: string): Promise<Verification> => {
  try {
    if (!(await RNFS.exists(path))) return 'invalid';
    if (await fileSize(path) !== WHISPER_MODEL_SIZE) return 'invalid';
    return (await RNFS.hash(path, 'sha256')).toLowerCase() === WHISPER_MODEL_SHA256
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

export const getWhisperModelPath = (): string => MODEL_PATH;

export const isWhisperModelInstalled = async (): Promise<boolean> =>
  (await verifyModel(MODEL_PATH)) === 'valid';

const canResume = (size: number | null): size is number =>
  size !== null && size > 0 && size < WHISPER_MODEL_SIZE && size % CHUNK_SIZE === 0;

const downloadRanges = async (
  onProgress?: (update: WhisperModelDownloadProgress) => void,
): Promise<void> => {
  let downloadedBytes = await fileSize(TEMP_PATH) ?? 0;
  if (downloadedBytes === WHISPER_MODEL_SIZE) {
    const existing = await verifyModel(TEMP_PATH);
    if (existing === 'valid') return;
    if (existing === 'unavailable') throw new Error('Could not verify the saved voice model download');
    await removePath(TEMP_PATH);
    downloadedBytes = 0;
  } else if (downloadedBytes > 0 && !canResume(downloadedBytes)) {
    await removePath(TEMP_PATH);
    downloadedBytes = 0;
  }

  while (downloadedBytes < WHISPER_MODEL_SIZE) {
    const rangeEnd = Math.min(downloadedBytes + CHUNK_SIZE, WHISPER_MODEL_SIZE) - 1;
    const expectedChunkSize = rangeEnd - downloadedBytes + 1;
    let chunkReady = false;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RANGE_ATTEMPTS; attempt += 1) {
      await removePath(CHUNK_PATH);
      try {
        let contentRange: string | undefined;
        const result = await RNFS.downloadFile({
          fromUrl: WHISPER_MODEL_URL,
          toFile: CHUNK_PATH,
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
              Math.round(((downloadedBytes + bytesWritten) / WHISPER_MODEL_SIZE) * DOWNLOAD_PROGRESS_MAX),
            ),
            statusMessage: 'Downloading voice model',
          }),
        }).promise;

        if (result.statusCode !== 206) {
          throw new Error(`Voice model download failed with HTTP ${result.statusCode}`);
        }
        const expectedContentRange = `bytes ${downloadedBytes}-${rangeEnd}/${WHISPER_MODEL_SIZE}`;
        if (contentRange?.toLowerCase() !== expectedContentRange) {
          throw new Error('Voice model download range did not match the requested bytes');
        }
        if (await fileSize(CHUNK_PATH) !== expectedChunkSize) {
          throw new Error('Voice model download returned an incomplete range');
        }
        chunkReady = true;
        break;
      } catch (error) {
        lastError = error;
        await removePath(CHUNK_PATH);
      }
    }

    if (!chunkReady) {
      throw lastError instanceof Error ? lastError : new Error('Voice model download failed');
    }

    try {
      const chunk = await RNFS.readFile(CHUNK_PATH, 'base64');
      if (downloadedBytes === 0) await RNFS.writeFile(TEMP_PATH, chunk, 'base64');
      else await RNFS.appendFile(TEMP_PATH, chunk, 'base64');
    } finally {
      await removePath(CHUNK_PATH);
    }

    downloadedBytes += expectedChunkSize;
  }
};

const installWhisperModel = async (
  onProgress?: (update: WhisperModelDownloadProgress) => void,
): Promise<string> => {
  const installed = await verifyModel(MODEL_PATH);
  if (installed === 'valid') return MODEL_PATH;
  if (installed === 'unavailable') throw new Error('Could not verify the existing voice model');
  await removePath(MODEL_PATH);

  if (!(await RNFS.exists(MODELS_DIRECTORY))) await RNFS.mkdir(MODELS_DIRECTORY);
  onProgress?.({ progress: 0, statusMessage: 'Preparing voice model download' });
  await downloadRanges(onProgress);

  onProgress?.({ progress: 97, statusMessage: 'Verifying voice model' });
  if (await verifyModel(TEMP_PATH) !== 'valid') {
    await removePath(TEMP_PATH);
    throw new Error('Downloaded voice model failed its integrity check');
  }

  onProgress?.({ progress: 99, statusMessage: 'Installing voice model' });
  await RNFS.moveFile(TEMP_PATH, MODEL_PATH);
  onProgress?.({ progress: 100, statusMessage: 'Voice model ready' });
  return MODEL_PATH;
};

export const downloadWhisperModel = (
  onProgress?: (update: WhisperModelDownloadProgress) => void,
): Promise<string> => {
  if (activeDownload) return activeDownload;
  activeDownload = installWhisperModel(onProgress).finally(() => {
    activeDownload = null;
  });
  return activeDownload;
};
