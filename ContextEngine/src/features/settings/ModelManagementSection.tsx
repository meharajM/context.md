import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatModelSize } from '../../ui/design';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Pill } from '../../shared/components/Pill';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import {
  MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES,
  type DeviceReadinessAssessment,
} from '../../modules/DeviceReadiness';
import { closestModelId, recommendModelId } from './modelRecommendations';

interface Model {
  id: string;
  name: string;
  description: string;
  sourceUrl?: string;
  sizeInBytes: number;
  minDeviceMemoryInGb: number;
  backend: string;
  installed: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  statusMessage?: string | null;
  recommended?: boolean;
}

interface ModelManagementSectionProps {
  activeModel: Model;
  models: Model[];
  deviceReadiness: DeviceReadinessAssessment | null;
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string, waitForActive?: boolean, userInitiated?: boolean) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
}

export function ModelManagementSection({
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
}: ModelManagementSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const downloadLabel = selectedModelProgress === 0
    ? 'Preparing download…'
    : `Downloading… ${selectedModelProgress}%`;

  // Filter out the active model from the general list
  const otherModels = models.filter(m => m.id !== activeModel.id);
  const recommendedId = recommendModelId(models, deviceReadiness);
  const closestId = closestModelId(models);
  const hasMemoryReading = Boolean(deviceReadiness?.checkAvailable && deviceReadiness.totalMemoryBytes !== null);
  const availableRam = deviceReadiness?.totalMemoryBytes ?? null;
  const activeModelBelowMinimum = hasMemoryReading && availableRam !== null && activeModel.minDeviceMemoryInGb * 1024 ** 3 > availableRam;
  const recommendationModel = models.find(model => model.id === recommendedId);
  const modelName = (model: Model | undefined) => model?.name ?? 'Writing helper';
  const recommendationCopy = !hasMemoryReading
    ? 'The smaller writing helper is a good place to start.'
    : recommendationModel
      ? deviceReadiness?.freeStorageBytes !== null &&
        deviceReadiness?.freeStorageBytes !== undefined &&
        deviceReadiness.freeStorageBytes < recommendationModel.sizeInBytes + MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES
        ? `${modelName(recommendationModel)} should work on this device, but you need more free space to download it.`
        : deviceReadiness?.resourcesAvailable === false
          ? `${modelName(recommendationModel)} should work on this device. Give it a little time before sorting notes.`
          : `${modelName(recommendationModel)} should work on this device.`
      : 'The writing helper may be slow here.';

  const handleInstallOrDelete = (model: Model) => {
    if (model.installed) {
      removeModel(model.id);
    } else {
      downloadModel(model.id, false, true);
    }
  };

  return (
    <View style={styles.container}>
      <SectionHeader 
        title="Writing helper"
        actionLabel={otherModels.length > 0 ? (isExpanded ? 'Hide options' : 'More options') : undefined}
        onActionPress={() => setIsExpanded(!isExpanded)}
      />
      
      {/* Active Model Card */}
      <Card variant="default" style={styles.activeCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.modelName}>{activeModel.name}</Text>
            <Text style={styles.modelDesc}>{activeModel.description}</Text>
          </View>
          {activeModel.id === recommendedId ? (
            <Pill label="Recommended" variant="local" />
          ) : activeModel.id === closestId && hasMemoryReading ? (
            <Pill label="Next best" variant="progress" />
          ) : activeModel.recommended ? (
            <Pill label="Default" variant="local" />
          ) : (
            <Pill label="Option" variant="progress" />
          )}
        </View>

        <View style={styles.specsRow}>
          <Text style={styles.specLabel}>Download size · {formatModelSize(activeModel.sizeInBytes)}</Text>
        </View>

        <Text style={styles.recommendationText} testID="model_recommendation">
          {recommendationCopy}
        </Text>

        {selectedModelError ? (
          <Text style={styles.errorText}>
            {selectedModelError.startsWith('Free up storage before installing ')
              ? selectedModelError
              : 'Something went wrong. Please try again.'}
          </Text>
        ) : selectedModelDownloading ? (
          <Text style={styles.progressText}>{downloadLabel}</Text>
        ) : activeModel.statusMessage === 'Download paused' ? (
          <Text style={styles.statusText}>
            Download paused · {activeModel.progress}% saved. Tap Resume to continue.
          </Text>
        ) : activeModel.statusMessage ? (
          <Text style={styles.statusText}>{activeModel.statusMessage}</Text>
        ) : (
          <Text style={styles.statusText}>
            {selectedModelInstalled
              ? activeModelBelowMinimum ? 'May not work well on this device' : 'Ready'
              : 'Not downloaded'}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <Button
            label={selectedModelId === activeModel.id ? 'Selected' : 'Choose'}
            variant={selectedModelId === activeModel.id ? 'primary' : 'secondary'}
            onPress={() => selectModel(activeModel.id)}
            disabled={selectedModelId === activeModel.id || selectedModelDownloading}
            style={styles.actionBtn}
            testID="model_select_button"
          />
          <Button
            label={selectedModelDownloading
              ? downloadLabel
              : selectedModelInstalled
                ? 'Delete'
                : activeModel.statusMessage === 'Download paused'
                  ? 'Resume'
                  : activeModelBelowMinimum ? 'Download anyway' : 'Download'}
            variant={selectedModelInstalled ? 'secondary' : 'primary'}
            onPress={() => handleInstallOrDelete(activeModel)}
            disabled={selectedModelDownloading}
            style={StyleSheet.flatten([styles.actionBtn, selectedModelInstalled && styles.deleteBtn])}
            testID={selectedModelInstalled ? 'model_delete_button' : 'model_install_button'}
          />
        </View>
        {selectedModelDownloading ? (
          <Text style={styles.statusText}>Finish this download before choosing another helper.</Text>
        ) : null}

        {activeModel.sourceUrl ? (
          <Pressable
            accessibilityRole="button"
            testID="model_info_link"
            onPress={() => {
              Linking.openURL(activeModel.sourceUrl!).catch(error => {
                console.error('Failed to open model info URL:', error);
              });
            }}>
            <Text style={styles.linkText}>More about this helper</Text>
          </Pressable>
        ) : null}
      </Card>

      {/* Expandable Model List */}
      {isExpanded && otherModels.length > 0 && (
        <View style={styles.modelList}>
          {otherModels.map(model => {
            const isSelected = selectedModelId === model.id;
            return (
              <Card 
                key={model.id} 
                variant="inset" 
                style={[styles.listItem, isSelected && styles.listItemSelected]}
              >
                <Pressable
                  style={styles.listItemMain}
                  onPress={() => selectModel(model.id)}
                  disabled={selectedModelDownloading}
                  accessibilityState={{ disabled: selectedModelDownloading }}
                  testID={`model_select_${model.id}`}>
                  <View style={styles.listItemHeader}>
                    <Text
                      style={styles.listItemName}
                      numberOfLines={2}
                      testID={`model_name_${model.id}`}>
                      {model.name}
                    </Text>
                    <Pill
                      label={model.installed ? 'On this device' : 'Not downloaded'}
                      variant={model.installed ? 'installed' : 'progress'} 
                    />
                  </View>
                  <Text style={styles.listItemMeta}>
                    Download size · {formatModelSize(model.sizeInBytes)}
                  </Text>
                  {hasMemoryReading ? (
                    <Text style={styles.modelFitText}>
                      {model.id === recommendedId
                        ? deviceReadiness?.resourcesAvailable === false ? 'Recommended · device needs a little time' : 'Recommended for this device'
                        : availableRam !== null && model.minDeviceMemoryInGb * 1024 ** 3 > availableRam
                          ? 'May not work well on this device'
                          : 'Should work on this device'}
                    </Text>
                  ) : null}
                  {model.statusMessage === 'Download paused' ? (
                    <Text style={styles.modelFitText}>Download paused · {model.progress}% saved</Text>
                  ) : null}
                </Pressable>
                
                <Pressable
                  accessibilityRole="button"
                  testID={`model_${model.id}_${model.installed ? 'delete' : 'install'}_button`}
                  style={[
                    styles.listItemAction,
                    model.installed ? styles.listItemActionDelete : styles.listItemActionInstall
                  ]}
                  onPress={() => handleInstallOrDelete(model)}
                  disabled={selectedModelDownloading || model.downloading}
                  accessibilityState={{ disabled: selectedModelDownloading || model.downloading }}
                >
                  <Text style={[
                    styles.listItemActionText,
                    model.installed ? styles.listItemActionDeleteText : styles.listItemActionInstallText
                  ]}>
                    {model.installed
                      ? 'Delete'
                      : model.statusMessage === 'Download paused'
                        ? 'Resume'
                      : hasMemoryReading && availableRam !== null && model.minDeviceMemoryInGb * 1024 ** 3 > availableRam
                        ? 'Download anyway'
                        : 'Download'}
                  </Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  activeCard: {
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  modelName: {
    ...typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  modelDesc: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  specLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
  },
  specDot: {
    color: colors.outlineVariant,
    fontSize: 14,
  },
  statusText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  recommendationText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  modelFitText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  progressText: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '600',
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  linkText: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '600',
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
  },
  deleteBtn: {
    borderColor: colors.error,
  },
  modelList: {
    gap: spacing.base,
    marginTop: spacing.xs,
  },
  listItem: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 0,
    overflow: 'hidden',
  },
  listItemSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  listItemMain: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listItemName: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '600',
    flex: 1,
  },
  listItemMeta: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  listItemAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    minHeight: 48,
  },
  listItemActionInstall: {
    backgroundColor: colors.primaryContainer,
  },
  listItemActionDelete: {
    backgroundColor: colors.surfaceContainerLow,
  },
  listItemActionInstallText: {
    ...typography.caption,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  listItemActionDeleteText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '700',
  },
  listItemActionText: {
    textAlign: 'center',
  },
});
