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
import {
  TRANSCRIPTION_LANGUAGES,
  type TranscriptionLanguage,
} from '../../shared/languages/transcriptionLanguages';

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
  transcriptionProbeStatus: string;
  runTranscriptionProbe: () => Promise<void>;
  liteRtEnabled: boolean;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  wakeWordEnabled: boolean;
  lockScreenHeadsetTriggerEnabled: boolean;
  transcriptionLanguage?: TranscriptionLanguage;
  selectedModelRecommendedForMultilingualText?: boolean;
  setTranscriptionLanguage?: (language: TranscriptionLanguage) => Promise<void>;
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
  transcriptionLanguage = 'en',
  selectedModelRecommendedForMultilingualText = false,
  setTranscriptionLanguage = async () => {},
  recordingState,
  setCaptureSetting,
}: CaptureModesSectionProps) {
  const voiceSetup = getVoiceSetupState(audioReadiness, whisperModelError, whisperModelDownloading, Platform.OS);
  const usesGemmaForVoice = audioReadiness.missingModels.some(model => model.toLowerCase().includes('gemma'));
  const voiceSetupActionLabel = whisperModelDownloading
    ? `Downloading voice model · ${whisperModelProgress}%`
    : voiceSetup.error
      ? usesGemmaForVoice ? 'Retry Gemma 3n download' : 'Retry voice model download'
      : 'Voice model downloads automatically';
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
              testID="switch_record"
            />
            <View style={styles.languagePicker}>
              <Text style={styles.languageTitle}>Voice and AI language</Text>
              <Text style={styles.helperText}>
                Choose the main language spoken in recordings. English uses the English Whisper model or Gemma; Spanish, French, German, and Italian use the multilingual Whisper model. Audio stays on this device.
              </Text>
              <View style={styles.languageChoices}>
                {TRANSCRIPTION_LANGUAGES.map(language => {
                  const selected = transcriptionLanguage === language.code;
                  const disabled = recordingState !== 'idle' || Boolean(whisperModelDownloading);
                  return (
                    <Pressable
                      key={language.code}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled }}
                      disabled={disabled}
                      onPress={() => { void setTranscriptionLanguage(language.code); }}
                      style={[styles.languageChoice, selected ? styles.languageChoiceSelected : null, disabled ? styles.languageChoiceDisabled : null]}>
                      <Text style={[styles.languageChoiceText, selected ? styles.languageChoiceTextSelected : null]}>
                        {language.nativeName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {whisperModelDownloading ? (
                <Text style={styles.helperText}>Finish the current voice model download before changing language.</Text>
              ) : null}
              {transcriptionLanguage !== 'en' && !selectedModelRecommendedForMultilingualText ? (
                <Text style={styles.languageWarning}>
                  Voice transcription is available in this language. Your compact writing model may be less reliable for multilingual organization; choose Gemma 3n E2B or Gemma 4 E2B in Writing models for stronger multilingual output.
                </Text>
              ) : null}
            </View>
            {RELEASE_CAPABILITIES.headsetTrigger && (
              <>
                <Text style={styles.helperText}>
                  Three media-button presses start or stop a voice note. Some headsets do not send supported commands.
                </Text>
                <View style={styles.separator} />
                <SwitchRow
                  label="Use headset while device is locked"
                  description="Start a voice note with your headset while the screen is locked"
                  value={lockScreenHeadsetTriggerEnabled}
                  onValueChange={val => setCaptureSetting('lockScreenHeadsetTriggerEnabled', val)}
                  disabled={!pushToRecordEnabled || recordingState !== 'idle'}
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
                : usesGemmaForVoice
                  ? 'Gemma 3n E2B handles both speech transcription and note organization on this device.'
                  : 'This device uses a lightweight voice model alongside its writing helper.'}
            </Text>
            {voiceSetup.error && Platform.OS === 'android' ? (
              <Text style={styles.diagText}>
                The voice model couldn't be downloaded. Check your connection and storage, then retry.
              </Text>
            ) : null}
            {voiceSetup.error && Platform.OS === 'ios' ? (
              <Text style={styles.diagText}>
                {voiceSetup.error}
              </Text>
            ) : null}
            {(Platform.OS === 'android' || Platform.OS === 'ios') && audioReadiness.errors.length > 0 && !voiceSetup.error && (
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
  languagePicker: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
  },
  languageTitle: {
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '600',
  },
  languageChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  languageChoice: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
  },
  languageChoiceSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  languageChoiceDisabled: {
    opacity: 0.45,
  },
  languageChoiceText: {
    ...typography.caption,
    color: colors.onSurface,
  },
  languageChoiceTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  languageWarning: {
    ...typography.caption,
    color: colors.error,
    paddingBottom: spacing.xs,
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
