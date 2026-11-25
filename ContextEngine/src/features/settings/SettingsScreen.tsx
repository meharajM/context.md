import React, { useState } from 'react';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { colors } from '../../shared/design/colors';
import { ModelManagementSection } from './ModelManagementSection';
import { FunctionGemmaSection } from './FunctionGemmaSection';
import { CaptureModesSection } from './CaptureModesSection';
import { AutomaticRemindersSection } from './AutomaticRemindersSection';
import { AssistantShortcutsSection } from './AssistantShortcutsSection';
import { DiagnosticsSection } from './DiagnosticsSection';
import { PrivacyCard } from './PrivacyCard';
import type { SettingsViewModel } from './settingsTypes';
import type { RecordingState } from '../capture/captureTypes';
import type { DeviceReadinessAssessment } from '../../modules/DeviceReadiness';
import type { BackupMergeResult } from '../../modules/ContextManager';
import type { MeetingRetention } from '../../core/appPreferences';
import type { TranscriptionLanguage } from '../../shared/languages/transcriptionLanguages';

interface Model {
  id: string;
  name: string;
  description: string;
  sizeInBytes: number;
  minDeviceMemoryInGb: number;
  backend: string;
  installed: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  recommended?: boolean;
  recommendedForMultilingualText?: boolean;
  taskTypes?: string[];
  statusMessage?: string | null;
  sourceUrl?: string;
  detailsUrl?: string;
}

interface AudioReadiness {
  transcriptionReady: boolean;
  wakeWordReady: boolean;
  missingModels: string[];
  errors: string[];
}

interface SettingsScreenProps {
  settingsView: SettingsViewModel;
  // Model management
  activeModel: Model;
  models: Model[];
  deviceReadiness: DeviceReadinessAssessment | null;
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string, waitForActive?: boolean, userInitiated?: boolean, selectForSynthesis?: boolean) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  // Capture modes
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
  setTranscriptionLanguage?: (language: TranscriptionLanguage) => Promise<void>;
  recordingState: RecordingState;
  setCaptureSetting: (
    key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'lockScreenHeadsetTriggerEnabled' | 'liteRtEnabled',
    value: boolean,
  ) => void;
  exportLibraryBackup: () => Promise<boolean>;
  restoreLibraryBackup: () => Promise<BackupMergeResult | null>;
  meetingAudioRetention?: MeetingRetention;
  setMeetingAudioRetention?: (retention: MeetingRetention) => Promise<void>;
}

export function SettingsScreen({
  settingsView,
  activeModel,
  models,
  deviceReadiness,
  selectedModelDownloading,
  selectedModelError,
  selectedModelId,
  selectedModelInstalled,
  selectedModelProgress,
  selectModel,
  downloadModel,
  removeModel,
  audioReadiness,
  whisperModelDownloading,
  whisperModelProgress,
  whisperModelError,
  downloadWhisperModel,
  transcriptionProbeStatus,
  runTranscriptionProbe,
  liteRtEnabled,
  manualCaptureEnabled,
  pushToRecordEnabled,
  wakeWordEnabled,
  lockScreenHeadsetTriggerEnabled,
  transcriptionLanguage = 'en',
  setTranscriptionLanguage = async () => {},
  recordingState,
  setCaptureSetting,
  exportLibraryBackup,
  restoreLibraryBackup,
  meetingAudioRetention = '5m',
  setMeetingAudioRetention,
}: SettingsScreenProps) {
  const [backupBusy, setBackupBusy] = useState<'export' | 'restore' | null>(null);
  const [backupMessage, setBackupMessage] = useState('');

  const runBackupAction = async (action: 'export' | 'restore') => {
    setBackupBusy(action);
    setBackupMessage('');
    try {
      if (action === 'export') {
        const saved = await exportLibraryBackup();
        setBackupMessage(saved ? 'Backup saved.' : 'Backup export cancelled.');
      } else {
        const result = await restoreLibraryBackup();
        setBackupMessage(result
          ? `Added ${result.added} note${result.added === 1 ? '' : 's'}; skipped ${result.skipped} already saved.`
          : 'Backup restore cancelled.');
      }
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Backup action failed.');
    } finally {
      setBackupBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <ModelManagementSection
        activeModel={activeModel}
        models={models}
        deviceReadiness={deviceReadiness}
        selectedModelDownloading={selectedModelDownloading}
        selectedModelError={selectedModelError}
        selectedModelId={selectedModelId}
        selectedModelInstalled={selectedModelInstalled}
        selectedModelProgress={selectedModelProgress}
        transcriptionLanguage={transcriptionLanguage}
        selectModel={selectModel}
        downloadModel={downloadModel}
        removeModel={removeModel}
      />

      <FunctionGemmaSection
        model={models.find(model => model.id === 'functiongemma-270m-it')}
        downloadModel={downloadModel}
        removeModel={removeModel}
      />

      <CaptureModesSection
        audioReadiness={audioReadiness}
        whisperModelDownloading={whisperModelDownloading}
        whisperModelProgress={whisperModelProgress}
        whisperModelError={whisperModelError}
        downloadWhisperModel={downloadWhisperModel}
        transcriptionProbeStatus={transcriptionProbeStatus}
        runTranscriptionProbe={runTranscriptionProbe}
        liteRtEnabled={liteRtEnabled}
        manualCaptureEnabled={manualCaptureEnabled}
        pushToRecordEnabled={pushToRecordEnabled}
        wakeWordEnabled={wakeWordEnabled}
        lockScreenHeadsetTriggerEnabled={lockScreenHeadsetTriggerEnabled}
        transcriptionLanguage={transcriptionLanguage}
        selectedModelRecommendedForMultilingualText={Boolean(activeModel.recommendedForMultilingualText)}
        setTranscriptionLanguage={setTranscriptionLanguage}
        recordingState={recordingState}
        setCaptureSetting={setCaptureSetting}
      />

      <View style={styles.meetingRetentionSection}>
        <SectionHeader title="Meeting audio" />
        <Card variant="inset" style={styles.meetingRetentionCard}>
          <Text style={styles.backupDescription}>
            Delete retained audio after both recording and transcript saving finish. Audio stays if transcription fails.
          </Text>
          <View style={styles.retentionChoices}>
            {([
              ['5m', '5 min'],
              ['1h', '1 hour'],
              ['1d', '1 day'],
              ['keep', 'Keep'],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: meetingAudioRetention === value }}
                onPress={() => { void setMeetingAudioRetention?.(value); }}
                style={[
                  styles.retentionChoice,
                  meetingAudioRetention === value ? styles.retentionChoiceSelected : null,
                ]}>
                <Text style={[
                  styles.retentionChoiceText,
                  meetingAudioRetention === value ? styles.retentionChoiceTextSelected : null,
                ]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.backupDescription}>
            Deletion runs when the app can run or next opens; your transcript remains saved.
          </Text>
        </Card>
      </View>

      <AutomaticRemindersSection />

      {RELEASE_CAPABILITIES.assistantCapture && <AssistantShortcutsSection />}

      <DiagnosticsSection settingsView={settingsView} />

      <View style={styles.backupSection}>
        <SectionHeader title="Backup and restore" />
        <Card variant="inset" style={styles.backupCard}>
          <Text style={styles.backupDescription}>
            Library JSON backups include notes and transcripts, not audio. Meeting sessions are stored separately and are not included.
          </Text>
          <View style={styles.backupActions}>
            <Button
              label={backupBusy === 'export' ? 'Saving…' : 'Export backup'}
              variant="secondary"
              disabled={backupBusy !== null}
              onPress={() => runBackupAction('export')}
              testID="export_backup_button"
              style={styles.backupButton}
            />
            <Button
              label={backupBusy === 'restore' ? 'Restoring…' : 'Restore backup'}
              variant="secondary"
              disabled={backupBusy !== null}
              onPress={() => runBackupAction('restore')}
              testID="restore_backup_button"
              style={styles.backupButton}
            />
          </View>
          {backupMessage ? <Text accessibilityLiveRegion="polite" style={styles.backupMessage}>{backupMessage}</Text> : null}
        </Card>
      </View>

      <PrivacyCard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onSurface,
    fontWeight: '700',
  },
  backupSection: {
    gap: spacing.md,
  },
  backupCard: {
    gap: spacing.md,
  },
  backupDescription: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  backupActions: {
    gap: spacing.sm,
  },
  backupButton: {
    minHeight: 46,
  },
  backupMessage: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  meetingRetentionSection: {
    gap: spacing.md,
  },
  meetingRetentionCard: {
    gap: spacing.md,
  },
  retentionChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  retentionChoice: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
  },
  retentionChoiceSelected: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.primary,
  },
  retentionChoiceText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  retentionChoiceTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
