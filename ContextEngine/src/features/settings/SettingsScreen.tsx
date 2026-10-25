import React, { useState } from 'react';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { colors } from '../../shared/design/colors';
import { ModelManagementSection } from './ModelManagementSection';
import { CaptureModesSection } from './CaptureModesSection';
import { AssistantShortcutsSection } from './AssistantShortcutsSection';
import { DiagnosticsSection } from './DiagnosticsSection';
import { PrivacyCard } from './PrivacyCard';
import type { SettingsViewModel } from './settingsTypes';
import type { RecordingState } from '../capture/captureTypes';
import type { DeviceReadinessAssessment } from '../../modules/DeviceReadiness';
import type { BackupMergeResult } from '../../modules/ContextManager';

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
  downloadModel: (modelId: string) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  // Capture modes
  audioReadiness: AudioReadiness;
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
  exportLibraryBackup: () => Promise<boolean>;
  restoreLibraryBackup: () => Promise<BackupMergeResult | null>;
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
  transcriptionProbeStatus,
  runTranscriptionProbe,
  liteRtEnabled,
  manualCaptureEnabled,
  pushToRecordEnabled,
  wakeWordEnabled,
  lockScreenHeadsetTriggerEnabled,
  recordingState,
  setCaptureSetting,
  exportLibraryBackup,
  restoreLibraryBackup,
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
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Choose how you add notes and organize them on this phone.
        </Text>
      </View>

      <ModelManagementSection
        activeModel={activeModel}
        models={models}
        deviceReadiness={deviceReadiness}
        selectedModelDownloading={selectedModelDownloading}
        selectedModelError={selectedModelError}
        selectedModelId={selectedModelId}
        selectedModelInstalled={selectedModelInstalled}
        selectedModelProgress={selectedModelProgress}
        selectModel={selectModel}
        downloadModel={downloadModel}
        removeModel={removeModel}
      />

      <CaptureModesSection
        audioReadiness={audioReadiness}
        transcriptionProbeStatus={transcriptionProbeStatus}
        runTranscriptionProbe={runTranscriptionProbe}
        liteRtEnabled={liteRtEnabled}
        manualCaptureEnabled={manualCaptureEnabled}
        pushToRecordEnabled={pushToRecordEnabled}
        wakeWordEnabled={wakeWordEnabled}
        lockScreenHeadsetTriggerEnabled={lockScreenHeadsetTriggerEnabled}
        recordingState={recordingState}
        setCaptureSetting={setCaptureSetting}
      />

      {RELEASE_CAPABILITIES.assistantCapture && <AssistantShortcutsSection />}

      <DiagnosticsSection settingsView={settingsView} />

      <View style={styles.backupSection}>
        <SectionHeader title="Backup and restore" />
        <Card variant="inset" style={styles.backupCard}>
          <Text style={styles.backupDescription}>
            Backups are plain JSON files saved where you choose. They include notes and transcripts, not audio recordings. Restore adds notes and keeps your current library.
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
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerBlock: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.displayLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
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
});
