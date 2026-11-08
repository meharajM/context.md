import RNFS from 'react-native-fs';

import { useAppStore } from '../../core/store';
import { ContextManager } from '../ContextManager';
import { ProcessingQueueManager } from '../SynthesisEngine/ProcessingQueueManager';
import { SynthesisService } from '../SynthesisEngine/SynthesisService';
import { reportQueuedSynthesisResult, scheduleQueuedSynthesis } from './index';
import { drainQuickTextOutbox } from './quickTextCapture';
import { getReminderState, scanAutomaticReminders } from '../AutomaticReminders';

const BACKGROUND_QUEUE_TIMEOUT_MS = 7.5 * 60 * 1000;

export async function runBackgroundSynthesisTask(data: {
  automaticRemindersOnly?: boolean;
  synthesisModelId?: string;
  downloadWhisperModel?: boolean;
  captureProcessing?: boolean;
  userInitiatedModelDownload?: boolean;
  backgroundWorkId?: string;
} = {}): Promise<void> {
  let retryForWorker = false;
  let hasMoreAudio = false;
  let modelDownloadFailed = false;
  let shouldSynthesize = !data.automaticRemindersOnly && !data.captureProcessing;
  const startedAt = Date.now();
  try {
    if (data.automaticRemindersOnly && !(await getReminderState()).enabled) return;
    ContextManager.setPath(`${RNFS.DocumentDirectoryPath}/topics`, {
      legacyPath: `${RNFS.DocumentDirectoryPath}/context.md`,
    });
    const drainedQuickTextCount = await drainQuickTextOutbox();
    shouldSynthesize ||= drainedQuickTextCount > 0;

    const store = useAppStore.getState();
    await store.hydratePreferences();
    if (data.synthesisModelId) await store.refreshModels();
    if (data.downloadWhisperModel) {
      await store.downloadWhisperModel(true, data.userInitiatedModelDownload);
      if (!useAppStore.getState().audioReadiness.transcriptionReady) {
        retryForWorker = true;
        modelDownloadFailed = true;
        return;
      }
      if (data.userInitiatedModelDownload) {
        retryForWorker = true;
        return;
      }
    }
    if (data.synthesisModelId) {
      const model = useAppStore.getState().models.find(candidate => candidate.id === data.synthesisModelId);
      if (!model) throw new Error('Background model download requested an unknown model');
      if (!model.installed) {
        await useAppStore.getState().downloadModel(data.synthesisModelId, true, data.userInitiatedModelDownload);
        const downloadStatusMessage = useAppStore.getState().selectedModelStatusMessage;
        await useAppStore.getState().refreshModels();
        const latest = useAppStore.getState();
        if (!latest.models.find(candidate => candidate.id === data.synthesisModelId)?.installed) {
          retryForWorker = !downloadStatusMessage?.startsWith('Free up storage before installing ');
          modelDownloadFailed = true;
          return;
        }
      }
      if (data.userInitiatedModelDownload) {
        retryForWorker = true;
        return;
      }
    }
    await store.loadContext();
    await store.recoverInterruptedRecordings();
    const readiness = await store.refreshDeviceReadiness();
    if (data.automaticRemindersOnly) {
      // New text reminders must not wait behind a long retained-audio decode.
      await scanAutomaticReminders(readiness.resourcesAvailable !== false);
    }
    const canTranscribeAudio = readiness.resourcesAvailable !== false || (
      data.captureProcessing === true &&
      readiness.lowMemory !== true &&
      readiness.thermalState !== 'serious' &&
      readiness.thermalState !== 'critical'
    );
    const captureTranscriptionDeferred = data.captureProcessing === true && !canTranscribeAudio;
    if (canTranscribeAudio) {
      const recovery = await store.retryRetainedInboxAudio({
        queueSynthesis: !data.captureProcessing && shouldSynthesize,
      });
      hasMoreAudio = recovery.hasMore;
      shouldSynthesize ||= recovery.recovered > 0;
    }
    if (data.captureProcessing) {
      await store.loadContext();
      retryForWorker = shouldSynthesize || hasMoreAudio || captureTranscriptionDeferred;
      return;
    }
    if (data.automaticRemindersOnly) {
      await store.loadContext();
      const finished = await scanAutomaticReminders(readiness.resourcesAvailable !== false);
      if (!shouldSynthesize) {
        retryForWorker = !finished || hasMoreAudio || readiness.resourcesAvailable === false;
        return;
      }
    }
    if (readiness.resourcesAvailable === false) {
      await store.queueInboxForSynthesis({ announce: false });
    } else if (!SynthesisService.getLiteRtReadiness()?.available) {
      await store.initializeEngine({ eagerAudio: false, eagerSynthesis: true });
    } else {
      await store.queueInboxForSynthesis({ announce: false });
    }

    const result = await ProcessingQueueManager.waitUntilSettled(
      Math.max(0, BACKGROUND_QUEUE_TIMEOUT_MS - (Date.now() - startedAt)),
    );
    const blockedReason = ProcessingQueueManager.getState().blockedReason;
    if (
      result === 'timeout' ||
      (result === 'blocked' && blockedReason?.startsWith('Waiting for device resources'))
    ) {
      retryForWorker = true;
    }
  } catch (error) {
    retryForWorker = true;
    console.error('Background synthesis did not finish; the Inbox note will be retried when the app opens:', error);
  } finally {
    if (shouldSynthesize && !modelDownloadFailed && (retryForWorker || hasMoreAudio)) {
      retryForWorker = !(await scheduleQueuedSynthesis());
    }
    if (data.backgroundWorkId) await reportQueuedSynthesisResult(retryForWorker, data.backgroundWorkId);
    else await reportQueuedSynthesisResult(retryForWorker);
  }
}
