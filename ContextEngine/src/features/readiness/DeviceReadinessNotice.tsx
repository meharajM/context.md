import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  DeviceReadinessAssessment,
  RECOMMENDED_FREE_STORAGE_BYTES,
} from '../../modules/DeviceReadiness';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { formatModelSize } from '../../ui/design';

const RECOMMENDED_MODEL_SIZE_BYTES = 584417280;

function describeReadiness(readiness: DeviceReadinessAssessment): string {
  if (!readiness.checkAvailable) {
    return readiness.isSimulator
      ? 'This preview can’t check this device. Your notes will still be saved.'
      : 'We couldn’t check this device. Your notes will still be saved.';
  }

  if (readiness.meetsSynthesisMinimum === false) {
    return 'The writing helper may be slow here, but your notes will still be saved.';
  }

  if (readiness.resourcesAvailable === false) {
    return 'Your device needs a little time before it can sort notes. Your note is saved.';
  }

  return readiness.freeStorageBytes !== null && readiness.freeStorageBytes < RECOMMENDED_FREE_STORAGE_BYTES
    ? 'Make space on your device before downloading the writing helper.'
    : 'Ready to sort your notes with the writing helper.';
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

  const detail = isModelDownloading
    ? `Downloading about ${formatModelSize(modelSizeBytes)}. You can keep capturing; your notes stay saved and will be organized when it’s ready. This download may use mobile data.`
    : describeReadiness(readiness);

  return (
    <Card variant="wash" style={styles.card} testID="device_readiness_notice">
      <View style={styles.copy}>
        <Text style={styles.title}>{isModelDownloading ? 'On-device AI is getting ready' : 'The writing helper is optional'}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <View style={styles.actions}>
        {canInstallModel ? (
          <Button
            testID="device_readiness_install_button"
            label={isModelDownloading
              ? `Downloading… ${modelProgress}%`
              : `Download · ${formatModelSize(modelSizeBytes)}`}
            onPress={() => onInstallModel?.()}
            disabled={isModelDownloading}
            style={styles.button}
          />
        ) : null}
        <Button
          testID="device_readiness_dismiss_button"
          label={isModelDownloading ? 'Continue writing' : canInstallModel ? 'Continue without it' : 'Got it'}
          variant="secondary"
          onPress={onDismiss}
          style={canInstallModel ? styles.button : styles.fullButton}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  copy: {
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
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  fullButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
