import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { RecentThreadList } from './RecentThreadList';
import type { RecentThreadView } from './reflectionTypes';
import type { RecordingState } from '../capture/captureTypes';

function getCaptureStatus(
  recordingState: RecordingState,
  canRecord = false,
  queueSize = 0,
  isProcessing = false,
) {
  if (recordingState === 'recording') {
    return {
      icon: 'mic' as const,
      title: 'Recording live',
      copy: 'Tap stop when your note is complete.',
      tone: 'recording' as const,
    };
  }

  if (recordingState === 'starting') {
    return {
      icon: 'clock' as const,
      title: 'Opening microphone',
      copy: 'Preparing local capture.',
      tone: 'pending' as const,
    };
  }

  if (recordingState === 'stopping' || recordingState === 'transcribing') {
    return {
      icon: 'queue' as const,
      title: recordingState === 'stopping' ? 'Saving recording' : 'Building transcript',
      copy: 'Your voice note is moving into the local queue.',
      tone: 'pending' as const,
    };
  }

  if (queueSize > 0 || isProcessing) {
    return {
      icon: 'queue' as const,
      title: `${queueSize || 1} capture${queueSize === 1 ? '' : 's'} in queue`,
      copy: isProcessing ? 'Local AI is synthesizing a note now.' : 'Open Queue to inspect transcripts before synthesis.',
      tone: 'queued' as const,
    };
  }

  if (!canRecord) {
    return null;
  }

  return {
    icon: 'check' as const,
    title: 'Ready to capture',
    copy: 'Voice and text captures stay on device.',
    tone: 'ready' as const,
  };
}

function getModelDownloadState({
  liteRtEnabled,
  selectedModelInstalled,
  selectedModelDownloading,
  selectedModelName,
  selectedModelProgress,
  selectedModelStatusMessage,
  queueSize,
}: {
  liteRtEnabled?: boolean;
  selectedModelInstalled?: boolean;
  selectedModelDownloading?: boolean;
  selectedModelName?: string;
  selectedModelProgress?: number;
  selectedModelStatusMessage?: string | null;
  queueSize?: number;
}) {
  if (!liteRtEnabled) {
    return null;
  }

  if (selectedModelDownloading) {
    const statusTitle = selectedModelStatusMessage
      ? `${selectedModelStatusMessage} ${selectedModelName}`
      : `Downloading ${selectedModelName}`;
    return {
      title: statusTitle,
      copy:
        queueSize && queueSize > 0
          ? `${queueSize} queued capture${queueSize === 1 ? '' : 's'} will process when the download completes.`
          : 'New captures will process automatically when the model is ready.',
      progressLabel: `${selectedModelProgress ?? 0}%`,
    };
  }

  if (!selectedModelInstalled) {
    return {
      title: `${selectedModelName} required`,
      copy:
        queueSize && queueSize > 0
          ? `${queueSize} queued capture${queueSize === 1 ? '' : 's'} are waiting for on-device categorization.`
          : 'Install the recommended local model to categorize captures by topic instead of saving raw Inbox entries.',
      progressLabel: null,
    };
  }

  return null;
}

export function ReflectionsScreen({
  threads,
  displayStatus: _displayStatus,
  canRecord,
  isRecording,
  recordingState = 'idle',
  queueSize = 0,
  isProcessing = false,
  liteRtEnabled,
  selectedModelName,
  selectedModelInstalled,
  selectedModelDownloading,
  selectedModelProgress,
  selectedModelStatusMessage,
  onDownloadModel,
  onOpenModelInfo,
  onOpenThread,
  onViewAll,
}: {
  threads: RecentThreadView[];
  displayStatus?: string;
  canRecord?: boolean;
  isRecording?: boolean;
  recordingState?: RecordingState;
  queueSize?: number;
  isProcessing?: boolean;
  liteRtEnabled?: boolean;
  selectedModelName?: string;
  selectedModelInstalled?: boolean;
  selectedModelDownloading?: boolean;
  selectedModelProgress?: number;
  selectedModelStatusMessage?: string | null;
  onDownloadModel?: () => void;
  onOpenModelInfo?: () => void;
  onOpenThread: (threadId: string) => void;
  onViewAll?: () => void;
}) {
  const status = getCaptureStatus(recordingState, canRecord, queueSize, isProcessing);
  const modelDownloadState = getModelDownloadState({
    liteRtEnabled,
    selectedModelInstalled,
    selectedModelDownloading,
    selectedModelName,
    selectedModelProgress,
    selectedModelStatusMessage,
    queueSize,
  });

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.headline}>What's on your mind?</Text>
        <Text style={styles.subtitle}>
          Capture a thought, start a reflection, or continue a recent thread.
        </Text>
      </View>

      {status ? (
        <Card
          variant="default"
          style={[
            styles.captureStatusCard,
            status.tone === 'recording' ? styles.captureStatusRecording : null,
            status.tone === 'pending' ? styles.captureStatusPending : null,
          ]}>
          <View style={styles.captureStatusTop}>
            <View style={[styles.captureStatusIcon, status.tone === 'recording' ? styles.captureStatusIconLive : null]}>
              <Icon
                name={status.icon}
                size={18}
                color={status.tone === 'recording' ? colors.error : colors.primary}
              />
            </View>
            <View style={styles.captureStatusText}>
              <Text style={styles.captureStatusTitle}>{status.title}</Text>
              <Text style={styles.captureStatusCopy}>{status.copy}</Text>
            </View>
            <View
              style={[
                styles.captureDot,
                isRecording ? styles.captureDotLive : canRecord ? styles.captureDotReady : styles.captureDotOff,
              ]}
            />
          </View>
        </Card>
      ) : null}

      {modelDownloadState ? (
        <Card variant="wash" style={styles.modelPromptCard}>
          <Pressable
            accessibilityRole="button"
            testID="model_prompt_card"
            onPress={() => onDownloadModel?.()}
            style={styles.modelPromptPressable}>
            <View style={styles.modelPromptTop}>
              <View style={styles.modelPromptIcon}>
                <Icon name="storage" size={18} color={colors.primary} />
              </View>
              <View style={styles.modelPromptText}>
                <Text style={styles.modelPromptTitle}>{modelDownloadState.title}</Text>
                <Text style={styles.modelPromptCopy}>{modelDownloadState.copy}</Text>
              </View>
              {modelDownloadState.progressLabel ? (
                <Text style={styles.modelPromptProgress}>{modelDownloadState.progressLabel}</Text>
              ) : null}
            </View>

            <View style={styles.modelPromptActions}>
              <Button
                label={
                  selectedModelDownloading
                    ? `${selectedModelStatusMessage ?? 'Downloading'} ${selectedModelProgress ?? 0}%`
                    : 'Install model'
                }
                onPress={() => onDownloadModel?.()}
                disabled={selectedModelDownloading}
                testID="model_prompt_install_button"
                style={styles.modelPromptAction}
              />
              <Button
                label="Model info"
                variant="ghost"
                onPress={() => onOpenModelInfo?.()}
                testID="model_prompt_info_button"
                style={styles.modelPromptAction}
              />
            </View>
          </Pressable>
        </Card>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Recent Threads" actionLabel="View All" onActionPress={onViewAll} />

        {threads.length === 0 ? (
          <Card variant="inset" style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon name="spark" size={18} color={colors.primaryContainer} />
            </View>
            <Text style={styles.emptyTitle}>Nothing captured yet</Text>
            <Text style={styles.emptyCopy}>
              Type a thought or record a note, and the latest thread will appear here.
            </Text>
          </Card>
        ) : (
          <RecentThreadList threads={threads} onOpenThread={onOpenThread} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  captureStatusCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  captureStatusRecording: {
    borderColor: 'rgba(186, 26, 26, 0.34)',
    backgroundColor: 'rgba(255, 250, 249, 0.82)',
  },
  captureStatusPending: {
    borderColor: 'rgba(59, 95, 122, 0.22)',
    backgroundColor: 'rgba(245, 250, 253, 0.84)',
  },
  captureStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  captureStatusIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureStatusIconLive: {
    backgroundColor: colors.errorContainer,
  },
  captureStatusText: {
    flex: 1,
    gap: 2,
  },
  captureStatusTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  captureStatusCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  captureDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
  },
  captureDotLive: {
    backgroundColor: colors.error,
  },
  captureDotReady: {
    backgroundColor: colors.primary,
  },
  captureDotOff: {
    backgroundColor: colors.outlineVariant,
  },
  modelPromptCard: {
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  modelPromptPressable: {
    gap: spacing.md,
  },
  modelPromptTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  modelPromptIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelPromptText: {
    flex: 1,
    gap: spacing.xs,
  },
  modelPromptTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  modelPromptCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  modelPromptProgress: {
    ...typography.labelCaps,
    color: colors.primary,
  },
  modelPromptActions: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  modelPromptAction: {
    flex: 1,
    minHeight: 44,
  },
  hero: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  headline: {
    ...typography.displayLg,
    color: colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
    opacity: 0.9,
  },
  section: {
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    borderRadius: radius.xl,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    textAlign: 'center',
  },
  emptyCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 270,
  },
});
