import RNFS from 'react-native-fs';

import { useAppStore } from '../../core/store';
import { ContextManager } from '../ContextManager';
import { ProcessingQueueManager } from '../SynthesisEngine/ProcessingQueueManager';
import { SynthesisService } from '../SynthesisEngine/SynthesisService';
import { reportQueuedSynthesisResult, scheduleQueuedSynthesis } from './index';
import { drainQuickTextOutbox } from './quickTextCapture';

const BACKGROUND_QUEUE_TIMEOUT_MS = 7.5 * 60 * 1000;

export async function runBackgroundSynthesisTask(): Promise<void> {
  let retryForWorker = false;
  let hasMoreAudio = false;
  const startedAt = Date.now();
  try {
    ContextManager.setPath(`${RNFS.DocumentDirectoryPath}/topics`, {
      legacyPath: `${RNFS.DocumentDirectoryPath}/context.md`,
    });

    await drainQuickTextOutbox();
    const store = useAppStore.getState();
    await store.hydratePreferences();
    await store.loadContext();
    await store.recoverInterruptedRecordings();
    const readiness = await store.refreshDeviceReadiness();
    if (readiness.resourcesAvailable !== false) {
      const recovery = await store.retryRetainedInboxAudio({
        queueSynthesis: readiness.meetsSynthesisMinimum !== false,
      });
      hasMoreAudio = recovery.hasMore;
    }
    if (readiness.meetsSynthesisMinimum === false) {
      return;
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
    if (retryForWorker || hasMoreAudio) {
      retryForWorker = !(await scheduleQueuedSynthesis());
    }
    await reportQueuedSynthesisResult(retryForWorker);
  }
}
