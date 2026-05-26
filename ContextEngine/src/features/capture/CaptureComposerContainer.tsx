import React, { useState } from 'react';

import { useAppStore } from '../../core/store';
import { selectCanRecord } from './captureSelectors';
import { CaptureComposerView } from './CaptureComposerView';

export function CaptureComposerContainer() {
  const [value, setValue] = useState('');

  const manualCaptureEnabled = useAppStore(state => state.manualCaptureEnabled);
  const pushToRecordEnabled = useAppStore(state => state.pushToRecordEnabled);
  const audioReadiness = useAppStore(state => state.audioReadiness);
  const recordingState = useAppStore(state => state.recordingState);
  const addThought = useAppStore(state => state.addThought);
  const startCapture = useAppStore(state => state.startCapture);
  const stopCapture = useAppStore(state => state.stopCapture);

  const canRecord = selectCanRecord({
    pushToRecordEnabled,
    audioReadiness,
  });

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!manualCaptureEnabled || !trimmed) {
      return;
    }

    await addThought(trimmed);
    setValue('');
  };

  const handleRecord = async () => {
    if (!canRecord) {
      return;
    }

    if (recordingState === 'recording') {
      await stopCapture();
      return;
    }

    if (recordingState === 'idle' || recordingState === 'error') {
      await startCapture();
    }
  };

  return (
    <CaptureComposerView
      value={value}
      canType={manualCaptureEnabled}
      canRecord={canRecord}
      recordingState={recordingState}
      onChangeValue={setValue}
      onRecordPress={handleRecord}
      onSavePress={handleSave}
    />
  );
}
