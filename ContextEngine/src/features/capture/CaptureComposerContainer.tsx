import React, { useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAppStore } from '../../core/store';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { selectCanRecord } from './captureSelectors';
import { CaptureComposerView } from './CaptureComposerView';
import { WHISPER_MODEL_SIZE } from '../../modules/AudioEngine/whisperModelManager';
import { formatModelSize } from '../../ui/design';
import { getVoiceSetupState } from '../../modules/AudioEngine/voiceSetup';

export function CaptureComposerContainer({
  focusRequest = 0,
  keyboardDismissRequest = 0,
  tutorialVisible = false,
  voiceSetupLoading,
  voiceSetupError,
  voiceSetupProgress,
}: {
  focusRequest?: number;
  keyboardDismissRequest?: number;
  tutorialVisible?: boolean;
  voiceSetupLoading?: boolean;
  voiceSetupError?: string | null;
  voiceSetupProgress?: number;
}) {
  const [value, setValue] = useState('');
  const isSavingRef = useRef(false);
  const draftRevisionRef = useRef(0);
  const lastManualSaveAtRef = useRef(0);

  const manualCaptureEnabled = useAppStore(state => state.manualCaptureEnabled);
  const pushToRecordEnabled = useAppStore(state => state.pushToRecordEnabled);
  const audioReadiness = useAppStore(state => state.audioReadiness);
  const whisperModelDownloading = useAppStore(state => state.whisperModelDownloading);
  const whisperModelProgress = useAppStore(state => state.whisperModelProgress);
  const whisperModelError = useAppStore(state => state.whisperModelError);
  const recordingState = useAppStore(state => state.recordingState);
  const recordingMessage = useAppStore(state => state.status);
  const addThought = useAppStore(state => state.addThought);
  const startCapture = useAppStore(state => state.startCapture);
  const stopCapture = useAppStore(state => state.stopCapture);

  const canRecord = selectCanRecord({
    pushToRecordEnabled,
    audioReadiness,
  });
  const voiceSetup = getVoiceSetupState(
    audioReadiness,
    voiceSetupError === undefined ? whisperModelError : voiceSetupError,
    voiceSetupLoading ?? whisperModelDownloading,
    Platform.OS,
  );
  const voiceSetupStatus = tutorialVisible || !RELEASE_CAPABILITIES.voiceCapture || audioReadiness.transcriptionReady
    ? null
    : voiceSetup.loading
      ? Platform.OS === 'ios'
        ? 'Loading the bundled voice model…'
        : whisperModelDownloading
          ? `Preparing voice notes · ${voiceSetupProgress ?? whisperModelProgress}% of ${formatModelSize(WHISPER_MODEL_SIZE)} · may use mobile data`
          : 'Preparing the on-device voice model…'
      : voiceSetup.error
        ? 'Voice setup needs attention · Retry in Settings'
        : `Preparing voice notes · about ${formatModelSize(WHISPER_MODEL_SIZE)} on this device…`;

  const handleSave = async () => {
    const trimmed = value.trim();
    if (isSavingRef.current || !manualCaptureEnabled || !trimmed) {
      return;
    }

    isSavingRef.current = true;
    const submittedRevision = draftRevisionRef.current;
    try {
      await addThought(trimmed);
      lastManualSaveAtRef.current = Date.now();
      if (draftRevisionRef.current === submittedRevision) setValue('');
    } catch (error) {
      console.error('Failed to save typed note:', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleRecord = async () => {
    if (recordingState === 'recording') {
      await stopCapture();
      return;
    }

    if (Date.now() - lastManualSaveAtRef.current < 800) {
      return;
    }

    if (!canRecord) {
      return;
    }

    if (recordingState === 'error') {
      useAppStore.setState({ recordingState: 'idle', status: 'Capture Ready' });
      await startCapture();
      return;
    }

    if (recordingState === 'idle') {
      await startCapture();
    }
  };

  return (
    <CaptureComposerView
      focusRequest={focusRequest}
      keyboardDismissRequest={keyboardDismissRequest}
      value={value}
      canType={manualCaptureEnabled}
      canRecord={canRecord}
      recordingState={recordingState}
      recordingMessage={recordingMessage}
      voiceSetupStatus={voiceSetupStatus}
      onChangeValue={nextValue => {
        draftRevisionRef.current += 1;
        setValue(nextValue);
      }}
      onRecordPress={handleRecord}
      onSavePress={handleSave}
    />
  );
}
