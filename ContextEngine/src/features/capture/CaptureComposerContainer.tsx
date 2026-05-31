import React, { useRef, useState } from 'react';

import { useAppStore } from '../../core/store';
import { selectCanRecord } from './captureSelectors';
import { CaptureComposerView } from './CaptureComposerView';

export function CaptureComposerContainer() {
  const [value, setValue] = useState('');
  const isSavingRef = useRef(false);
  const lastManualSaveAtRef = useRef(0);

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
    if (isSavingRef.current || !manualCaptureEnabled || !trimmed) {
      return;
    }

    isSavingRef.current = true;
    try {
      await addThought(trimmed);
      lastManualSaveAtRef.current = Date.now();
      setValue('');
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleRecord = async () => {
    if (Date.now() - lastManualSaveAtRef.current < 800) {
      return;
    }

    if (!canRecord) {
      return;
    }

    if (recordingState === 'recording') {
      await stopCapture();
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
