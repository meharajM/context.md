import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { colors } from '../../shared/design/colors';
import { ModelManagementSection } from './ModelManagementSection';
import { CaptureModesSection } from './CaptureModesSection';
import { AssistantShortcutsSection } from './AssistantShortcutsSection';
import { DiagnosticsSection } from './DiagnosticsSection';
import { PrivacyCard } from './PrivacyCard';
import type { SettingsViewModel } from './settingsTypes';

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
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
  selectedModelStatusMessage: string | null;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  // Capture modes
  audioReadiness: AudioReadiness;
  liteRtEnabled: boolean;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  wakeWordEnabled: boolean;
  setCaptureSetting: (
    key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'liteRtEnabled',
    value: boolean,
  ) => void;
}

export function SettingsScreen({
  settingsView,
  activeModel,
  models,
  selectedModelDownloading,
  selectedModelError,
  selectedModelId,
  selectedModelInstalled,
  selectedModelProgress,
  selectedModelStatusMessage,
  selectModel,
  downloadModel,
  removeModel,
  audioReadiness,
  liteRtEnabled,
  manualCaptureEnabled,
  pushToRecordEnabled,
  wakeWordEnabled,
  setCaptureSetting,
}: SettingsScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Manage offline models, local capture behavior, and subsystem diagnostics.
        </Text>
      </View>

      <ModelManagementSection
        activeModel={activeModel}
        models={models}
        selectedModelDownloading={selectedModelDownloading}
        selectedModelError={selectedModelError}
        selectedModelId={selectedModelId}
        selectedModelInstalled={selectedModelInstalled}
        selectedModelProgress={selectedModelProgress}
        selectedModelStatusMessage={selectedModelStatusMessage}
        selectModel={selectModel}
        downloadModel={downloadModel}
        removeModel={removeModel}
      />

      <CaptureModesSection
        audioReadiness={audioReadiness}
        liteRtEnabled={liteRtEnabled}
        manualCaptureEnabled={manualCaptureEnabled}
        pushToRecordEnabled={pushToRecordEnabled}
        wakeWordEnabled={wakeWordEnabled}
        setCaptureSetting={setCaptureSetting}
      />

      <AssistantShortcutsSection />

      <DiagnosticsSection settingsView={settingsView} />

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
});
