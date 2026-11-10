import React from 'react';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { SwitchRow } from '../../shared/components/SwitchRow';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { RecordingState } from '../capture/captureTypes';
import { getVoiceSetupState } from '../../modules/AudioEngine/voiceSetup';
import { HINDI_WHISPER_MODEL_SIZE, type TranscriptionLanguage } from '../../modules/AudioEngine/whisperModelManager';

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
  downloadWhisperModel?: (userInitiated?: boolean) => Promise<void>;
  transcriptionLanguage?: TranscriptionLanguage;
  hindiModelInstalled?: boolean;
  hindiModelDownloading?: boolean;
  hindiModelProgress?: number;
  hindiModelError?: string | null;
  downloadHindiModel?: () => Promise<void>;
  selectTranscriptionLanguage?: (language: TranscriptionLanguage) => Promise<void>;
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
  transcriptionLanguage = 'en',
  hindiModelInstalled = false,
  hindiModelDownloading = false,
  hindiModelProgress = 0,
  hindiModelError = null,
  downloadHindiModel = async () => {},
  selectTranscriptionLanguage = async () => {},
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
  const voiceSetup = getVoiceSetupState(audioReadiness, whisperModelError, whisperModelDownloading, Platform.OS);
  const voiceSetupActionLabel = whisperModelDownloading
    ? Platform.OS === 'ios' ? 'Loading voice model…' : `Downloading voice model · ${whisperModelProgress}%`
    : voiceSetup.error
      ? Platform.OS === 'ios' ? 'Retry voice setup' : 'Retry voice model download'
      : Platform.OS === 'ios' ? 'Loading voice model…' : 'Voice model downloads automatically';
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
              description={Platform.OS === 'android'
                ? 'Start here. If you leave the app, use the recording notice to stop.'
                : 'Start here. Recording can continue when you switch apps; return here to stop.'}
              value={pushToRecordEnabled}
              onValueChange={val => setCaptureSetting('pushToRecordEnabled', val)}
              disabled={!audioReadiness.transcriptionReady}
              testID="switch_record"
            />
            <View style={styles.languageSettings}>
              <Text style={styles.languageTitle}>Transcription language</Text>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: transcriptionLanguage === 'en', disabled: recordingState !== 'idle' }}
                disabled={recordingState !== 'idle'}
                onPress={() => selectTranscriptionLanguage('en')}
                style={[styles.languageOption, transcriptionLanguage === 'en' && styles.languageOptionSelected]}>
                <Text style={styles.languageOptionTitle}>English</Text>
                <Text style={styles.helperText}>Ready automatically on this device.</Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  selected: transcriptionLanguage === 'hi',
                  disabled: !hindiModelInstalled || recordingState !== 'idle',
                }}
                disabled={!hindiModelInstalled || recordingState !== 'idle'}
                onPress={() => selectTranscriptionLanguage('hi')}
                style={[
                  styles.languageOption,
                  transcriptionLanguage === 'hi' && styles.languageOptionSelected,
                  !hindiModelInstalled && styles.languageOptionDisabled,
                ]}>
                <Text style={styles.languageOptionTitle}>Hindi / Hinglish</Text>
                <Text style={styles.helperText}>Detects Hindi and English speech automatically.</Text>
              </Pressable>
              {hindiModelInstalled ? (
                <Text style={styles.helperText}>Hindi / Hinglish model downloaded ({Math.round(HINDI_WHISPER_MODEL_SIZE / 1_048_576)} MiB).</Text>
              ) : (
                <Button
                  label={hindiModelDownloading
                    ? `Downloading Hindi model · ${hindiModelProgress}%`
                    : `Download Hindi / Hinglish model · ${Math.round(HINDI_WHISPER_MODEL_SIZE / 1_048_576)} MiB`}
                  onPress={() => downloadHindiModel()}
                  disabled={whisperModelDownloading || recordingState !== 'idle'}
                  testID="hindi_whisper_model_download"
                  variant="secondary"
                />
              )}
              {hindiModelError ? <Text style={styles.diagText}>{hindiModelError}</Text> : null}
              <Text style={styles.helperText}>The model stays on this device. Keep the app open while it downloads.</Text>
            </View>
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
                : Platform.OS === 'ios' ? 'Loading the bundled voice model.' : 'Preparing the on-device voice model.'}
            </Text>
            {voiceSetup.error && Platform.OS === 'android' ? (
              <Text style={styles.diagText}>
                The voice model couldn't be downloaded. Check your connection and storage, then retry.
              </Text>
            ) : null}
            {voiceSetup.error && Platform.OS === 'ios' ? (
              <Text style={styles.diagText}>
                The bundled voice model couldn't be loaded. Retry voice setup or reinstall Thought Notes if it stays unavailable.
              </Text>
            ) : null}
            {Platform.OS === 'android' && audioReadiness.errors.length > 0 && !voiceSetup.error && (
              <Text style={styles.diagText}>
                Something went wrong while setting up voice notes.
              </Text>
            )}
            <Button
              label={voiceSetupActionLabel}
              onPress={() => downloadWhisperModel(true)}
              disabled={whisperModelDownloading || !voiceSetup.error}
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
  languageSettings: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  languageTitle: {
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '600',
  },
  languageOption: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: spacing.sm,
  },
  languageOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.secondaryContainer,
  },
  languageOptionDisabled: {
    opacity: 0.55,
  },
  languageOptionTitle: {
    ...typography.bodySm,
    color: colors.onSurface,
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
