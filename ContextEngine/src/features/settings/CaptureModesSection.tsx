import React from 'react';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { SwitchRow } from '../../shared/components/SwitchRow';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { RecordingState } from '../capture/captureTypes';

interface AudioReadiness {
  transcriptionReady: boolean;
  wakeWordReady: boolean;
  missingModels: string[];
  errors: string[];
}

interface CaptureModesSectionProps {
  audioReadiness: AudioReadiness;
  whisperModelDownloading?: boolean;
  whisperModelProgress?: number;
  whisperModelError?: string | null;
  downloadWhisperModel?: () => Promise<void>;
  transcriptionProbeStatus: string;
  runTranscriptionProbe: () => Promise<void>;
  liteRtEnabled: boolean;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  wakeWordEnabled: boolean;
  lockScreenHeadsetTriggerEnabled: boolean;
  recordingState: RecordingState;
  setCaptureSetting: (
    key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'lockScreenHeadsetTriggerEnabled' | 'liteRtEnabled',
    value: boolean,
  ) => void;
}

export function CaptureModesSection({
  audioReadiness,
  whisperModelDownloading = false,
  whisperModelProgress = 0,
  whisperModelError = null,
  downloadWhisperModel = async () => {},
  transcriptionProbeStatus,
  runTranscriptionProbe,
  liteRtEnabled,
  manualCaptureEnabled,
  pushToRecordEnabled,
  wakeWordEnabled,
  lockScreenHeadsetTriggerEnabled,
  recordingState,
  setCaptureSetting,
}: CaptureModesSectionProps) {
  return (
    <View style={styles.container}>
      <SectionHeader title="Add notes" />
      <Card variant="inset" style={styles.card}>
        <SwitchRow
          label="Type notes"
          description="Write a note with your keyboard"
          value={manualCaptureEnabled}
          onValueChange={val => setCaptureSetting('manualCaptureEnabled', val)}
          testID="switch_manual"
        />
        {RELEASE_CAPABILITIES.voiceCapture && (
          <>
            <View style={styles.separator} />
            <SwitchRow
              label="Record voice notes"
              description="Start here. If you leave the app, use the recording notice to stop."
              value={pushToRecordEnabled}
              onValueChange={val => setCaptureSetting('pushToRecordEnabled', val)}
              disabled={!audioReadiness.transcriptionReady}
              testID="switch_record"
            />
            {RELEASE_CAPABILITIES.headsetTrigger && (
              <>
                <Text style={styles.helperText}>
                  On some headsets, use Record in the app or home-screen widget instead.
                </Text>
                <View style={styles.separator} />
                <SwitchRow
                  label="Use headset while device is locked"
                  description="Start a voice note with your headset while the screen is locked"
                  value={lockScreenHeadsetTriggerEnabled}
                  onValueChange={val => setCaptureSetting('lockScreenHeadsetTriggerEnabled', val)}
                  disabled={!audioReadiness.transcriptionReady || !pushToRecordEnabled || recordingState !== 'idle'}
                  testID="switch_lockscreen_trigger"
                />
                <Text style={styles.helperText}>
                  Turn this on while Thought Notes is open. Microphone access is needed.
                </Text>
              </>
            )}
            {RELEASE_CAPABILITIES.wakeWord && (
              <>
                <View style={styles.separator} />
                <SwitchRow
                  label="Start recording with a phrase"
                  description="Begin listening when you say a chosen phrase"
                  value={wakeWordEnabled}
                  onValueChange={val => setCaptureSetting('wakeWordEnabled', val)}
                  disabled={!audioReadiness.wakeWordReady}
                  testID="switch_wakeword"
                />
              </>
            )}
            {__DEV__ && (
              <>
                <View style={styles.separator} />
                <Button
                  label="Test voice notes"
                  onPress={() => runTranscriptionProbe()}
                  disabled={!audioReadiness.transcriptionReady}
                  testID="whisper_sample_probe"
                  variant="secondary"
                />
                {transcriptionProbeStatus.startsWith('QA transcript') && (
                  <Text testID="whisper_sample_result" accessibilityRole="text" style={styles.diagText}>
                    {`Sample result: ${transcriptionProbeStatus.replace(/^QA transcript:\s*/, '')}`}
                  </Text>
                )}
              </>
            )}
          </>
        )}
        <View style={styles.separator} />
        <SwitchRow
          label="Organize notes automatically"
          description="Let the writing helper sort notes into topics."
          value={liteRtEnabled}
          onValueChange={val => setCaptureSetting('liteRtEnabled', val)}
          testID="switch_litert"
        />

        {RELEASE_CAPABILITIES.voiceCapture && !audioReadiness.transcriptionReady && (
          <View>
            <Text style={styles.warningText}>
              {whisperModelDownloading
                ? `Preparing voice notes · ${whisperModelProgress}%`
                : 'Preparing the on-device voice model.'}
            </Text>
            {whisperModelError ? (
              <Text style={styles.diagText}>
                The voice model couldn't be downloaded. Check your connection and storage, then retry.
              </Text>
            ) : null}
            {audioReadiness.errors.length > 0 && !whisperModelError && (
              <Text style={styles.diagText}>
                Something went wrong while setting up voice notes.
              </Text>
            )}
            <Button
              label={whisperModelDownloading
                ? `Downloading voice model · ${whisperModelProgress}%`
                : whisperModelError ? 'Retry voice model download' : 'Voice model downloads automatically'}
              onPress={() => downloadWhisperModel()}
              disabled={whisperModelDownloading || !whisperModelError}
              testID="whisper_model_download"
              variant="secondary"
            />
          </View>
        )}
        
        {RELEASE_CAPABILITIES.wakeWord && !audioReadiness.wakeWordReady && (
          <Text style={styles.warningText}>
            This option isn't ready yet.
          </Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.surfaceContainer,
  },
  helperText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
    marginTop: spacing.xs,
  },
  warningText: {
    ...typography.caption,
    color: colors.error,
    paddingBottom: spacing.xs,
  },
  diagText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    paddingBottom: spacing.sm,
    fontFamily: 'Menlo',
    fontSize: 11,
  },
});
