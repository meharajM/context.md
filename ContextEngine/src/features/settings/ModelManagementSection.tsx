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
  recommended?: boolean;
}

interface ModelManagementSectionProps {
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
}

export function ModelManagementSection({
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
}: ModelManagementSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const downloadLabel = selectedModelStatusMessage
    ? `${selectedModelStatusMessage} ${selectedModelProgress}%`
    : `Downloading ${selectedModelProgress}%`;

  // Filter out the active model from the general list
  const otherModels = models.filter(m => m.id !== activeModel.id);

  const handleInstallOrDelete = (model: Model) => {
    if (model.installed) {
      removeModel(model.id);
    } else {
      downloadModel(model.id);
    }
  };

  return (
    <View style={styles.container}>
      <SectionHeader 
        title="Local model" 
        actionLabel={otherModels.length > 0 ? (isExpanded ? 'Hide options' : 'View all options') : undefined}
        onActionPress={() => setIsExpanded(!isExpanded)}
      />
      
      {/* Active Model Card */}
      <Card variant="default" style={styles.activeCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.modelName}>{activeModel.name}</Text>
            <Text style={styles.modelDesc}>{activeModel.description}</Text>
          </View>
          {activeModel.recommended ? (
            <Pill label="Recommended" variant="local" />
          ) : (
            <Pill label="Option" variant="progress" />
          )}
        </View>

        <View style={styles.specsRow}>
          <Text style={styles.specLabel}>{formatModelSize(activeModel.sizeInBytes)}</Text>
          <Text style={styles.specDot}>·</Text>
          <Text style={styles.specLabel}>{activeModel.minDeviceMemoryInGb} GB min</Text>
          <Text style={styles.specDot}>·</Text>
          <Text style={styles.specLabel}>{activeModel.backend.toUpperCase()}</Text>
        </View>

        {selectedModelError ? (
          <Text style={styles.errorText}>{selectedModelError}</Text>
        ) : selectedModelDownloading ? (
          <Text style={styles.progressText}>{downloadLabel}</Text>
        ) : (
          <Text style={styles.statusText}>
            {selectedModelInstalled ? 'Ready on device' : 'Not downloaded'}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <Button
            label={selectedModelId === activeModel.id ? 'Selected' : 'Use model'}
            variant={selectedModelId === activeModel.id ? 'primary' : 'secondary'}
            onPress={() => selectModel(activeModel.id)}
            disabled={selectedModelId === activeModel.id}
            style={styles.actionBtn}
            testID="model_select_button"
          />
          <Button
            label={selectedModelDownloading ? downloadLabel : (selectedModelInstalled ? 'Delete' : 'Install')}
            variant={selectedModelInstalled ? 'secondary' : 'primary'}
            onPress={() => handleInstallOrDelete(activeModel)}
            disabled={selectedModelDownloading}
            style={StyleSheet.flatten([styles.actionBtn, selectedModelInstalled && styles.deleteBtn])}
            testID={selectedModelInstalled ? 'model_delete_button' : 'model_install_button'}
          />
        </View>

        {activeModel.sourceUrl ? (
          <Pressable
            accessibilityRole="button"
            testID="model_info_link"
            onPress={() => {
              Linking.openURL(activeModel.sourceUrl!).catch(error => {
                console.error('Failed to open model info URL:', error);
              });
            }}>
            <Text style={styles.linkText}>Model info and download source</Text>
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
                <Pressable style={styles.listItemMain} onPress={() => selectModel(model.id)}>
                  <View style={styles.listItemHeader}>
                    <Text style={styles.listItemName} numberOfLines={1}>{model.name}</Text>
                    <Pill 
                      label={model.installed ? 'Installed' : 'Missing'} 
                      variant={model.installed ? 'installed' : 'progress'} 
                    />
                  </View>
                  <Text style={styles.listItemMeta}>
                    {formatModelSize(model.sizeInBytes)} · {model.minDeviceMemoryInGb} GB · {model.backend.toUpperCase()}
                  </Text>
                </Pressable>
                
                <Pressable
                  accessibilityRole="button"
                  testID={`model_${model.id}_${model.installed ? 'delete' : 'install'}_button`}
                  style={[
                    styles.listItemAction,
                    model.installed ? styles.listItemActionDelete : styles.listItemActionInstall
                  ]}
                  onPress={() => handleInstallOrDelete(model)}
                >
                  <Text style={[
                    styles.listItemActionText,
                    model.installed ? styles.listItemActionDeleteText : styles.listItemActionInstallText
                  ]}>
                    {model.installed ? 'Delete' : 'Install'}
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
    flexDirection: 'row',
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
    borderLeftWidth: 1,
    borderLeftColor: colors.outlineVariant,
    minWidth: 80,
  },
  listItemActionInstall: {
    backgroundColor: colors.primaryContainer,
  },
  listItemActionDelete: {
    backgroundColor: colors.surfaceContainerLow,
  },
  listItemActionInstallText: {
    ...typography.caption,
    color: colors.surfaceContainerLowest,
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
