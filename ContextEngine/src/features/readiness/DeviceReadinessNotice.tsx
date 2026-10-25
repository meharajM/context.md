import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  DeviceReadinessAssessment,
  formatBytesAsGiB,
  RECOMMENDED_FREE_STORAGE_BYTES,
} from '../../modules/DeviceReadiness';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { formatModelSize } from '../../ui/design';

const RECOMMENDED_MODEL_SIZE_BYTES = 584417280;

function describeReadiness(readiness: DeviceReadinessAssessment): string {
  if (!readiness.checkAvailable) {
    return readiness.isSimulator
      ? 'This preview cannot check phone memory. You can still type notes; check this on your phone.'
      : 'Phone memory could not be checked. You can still write notes.';
  }

  if (readiness.meetsSynthesisMinimum === false) {
    const requiredMemory = readiness.minimumMemoryBytes / 1024 ** 3;
    return `This phone has ${formatBytesAsGiB(readiness.totalMemoryBytes)} of memory. The writing assistant needs at least ${requiredMemory} GB. It may run slowly or stop, but your notes stay saved in Inbox.`;
  }

  if (readiness.resourcesAvailable === false) {
    const cause = readiness.reason === 'thermal'
      ? 'Your phone is warm.'
      : 'Your phone has little free memory.';
    return `${cause} Your note is saved in Inbox. The writing assistant will continue when your phone is ready and the app is open.`;
  }

  const storageGuidance = readiness.freeStorageBytes !== null && readiness.freeStorageBytes < RECOMMENDED_FREE_STORAGE_BYTES
    ? ` Free up about ${formatBytesAsGiB(RECOMMENDED_FREE_STORAGE_BYTES - readiness.freeStorageBytes)} to make room.`
    : ` Keep about ${formatBytesAsGiB(RECOMMENDED_FREE_STORAGE_BYTES)} free to download the writing assistant.`;
  return `This phone has enough memory for the writing assistant.${storageGuidance}`;
}

export function DeviceReadinessNotice({
  readiness,
  modelSizeBytes = RECOMMENDED_MODEL_SIZE_BYTES,
  canInstallModel = false,
  isModelDownloading = false,
  modelProgress = 0,
  onInstallModel,
  onDismiss,
}: {
  readiness: DeviceReadinessAssessment | null;
  modelSizeBytes?: number;
  canInstallModel?: boolean;
  isModelDownloading?: boolean;
  modelProgress?: number;
  onInstallModel?: () => void;
  onDismiss: () => void;
}) {
  if (!readiness) {
    return null;
  }

  const detail = describeReadiness(readiness);

  return (
    <Card variant="wash" style={styles.card} testID="device_readiness_notice">
      <View style={styles.header}>
        <View style={styles.icon}>
          <Icon name={readiness.resourcesAvailable === false || readiness.meetsSynthesisMinimum === false ? 'clock' : 'check'} size={18} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Phone check</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {canInstallModel ? (
          <Button
            testID="device_readiness_install_button"
            label={isModelDownloading
              ? `Downloading… ${modelProgress}%`
              : `${readiness.meetsSynthesisMinimum === false ? 'Download anyway' : 'Download assistant'} · ${formatModelSize(modelSizeBytes)}`}
            onPress={() => onInstallModel?.()}
            disabled={isModelDownloading}
            style={styles.button}
          />
        ) : null}
        <Button
          testID="device_readiness_dismiss_button"
          label={isModelDownloading ? 'Continue writing' : canInstallModel ? 'Continue without assistant' : 'Got it'}
          variant="secondary"
          onPress={onDismiss}
          style={styles.button}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  detail: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  button: {
    minHeight: 48,
  },
  actions: {
    gap: spacing.sm,
  },
});
