import React, { useState } from 'react';

import { useAppStore } from '../../core/store';
import { selectCanRecord } from './captureSelectors';
import { CaptureComposerView } from './CaptureComposerView';

export function CaptureComposerContainer() {
  const [value, setValue] = useState('');

  const manualCaptureEnabled = useAppStore(state => state.manualCaptureEnabled);
  const pushToRecordEnabled = useAppStore(state => state.pushToRecordEnabled);
  const audioReadiness = useAppStore(state => state.audioReadiness);
  const isRecording = useAppStore(state => state.isRecording);
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

    if (isRecording) {
      await stopCapture();
      return;
    }

    await startCapture();
  };

  return (
    <CaptureComposerView
      value={value}
      canType={manualCaptureEnabled}
      canRecord={canRecord}
      isRecording={isRecording}
      onChangeValue={setValue}
      onRecordPress={handleRecord}
      onSavePress={handleSave}
    />
  );
}
