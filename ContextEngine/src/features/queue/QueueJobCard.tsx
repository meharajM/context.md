import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { Pill } from '../../shared/components/Pill';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { QueueJobView } from './queueTypes';

export function QueueJobCard({
  job,
  isActive = false,
  onEnd,
  onEdit,
}: {
  job: QueueJobView;
  isActive?: boolean;
  onEnd?: (jobId: string) => void;
  onEdit?: (jobId: string) => void;
}) {
  const isIdle = job.id === 'idle';
  const [expanded, setExpanded] = useState(false);

  if (isActive) {
    const hasProgress = typeof job.progress === 'number';
    const progressLabel = hasProgress ? `${Math.round(job.progress ?? 0)}%` : 'Processing';

    return (
      <Card variant="default" style={styles.activeCard}>
        <View style={styles.activeTop}>
          <View style={styles.iconContainer}>
            <Icon name={isIdle ? 'check' : 'mic'} size={24} color={colors.primary} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.activeLabel}>{isIdle ? 'Status' : 'Active job'}</Text>
            <Text style={styles.activeTitle} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={styles.activeStatus}>{job.statusLabel}</Text>
          </View>
          {!isIdle && <Pill label={progressLabel} variant="progress" />}
        </View>

        {!isIdle && (
          <Text style={styles.transcriptText}>{job.transcript}</Text>
        )}

        {!isIdle && (
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              {hasProgress ? (
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(0, Math.min(100, job.progress ?? 0))}%` },
                  ]}
                />
              ) : (
                <View style={styles.progressIndeterminate} />
              )}
            </View>
          </View>
        )}
      </Card>
    );
  }

  return (
    <Card variant="action" style={styles.pendingCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open queued transcript: ${job.title}`}
        onPress={() => setExpanded(current => !current)}
        style={styles.pendingContent}>
        <View style={styles.pendingLeft}>
          <View style={styles.pendingIconContainer}>
            <Icon
              name={job.kind === 'voice' ? 'mic' : 'document'}
              size={18}
              color={colors.onSurfaceVariant}
            />
          </View>
          <View style={styles.pendingText}>
            <Text style={styles.pendingTitleText} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={styles.pendingStatusText}>{`${job.statusLabel} · ${job.timestampLabel}`}</Text>
          </View>
        </View>
        <Icon name={expanded ? 'chevronLeft' : 'more'} size={18} color={colors.onSurfaceVariant} />
      </Pressable>

      {expanded ? (
        <View style={styles.expandedPanel}>
          <Text style={styles.expandedLabel}>Transcript</Text>
          <Text style={styles.transcriptText}>{job.transcript}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`End queued item: ${job.title}`}
            disabled={!job.canEnd}
            onPress={() => onEnd?.(job.id)}
            style={({ pressed }) => [
              styles.endButton,
              !job.canEnd ? styles.endButtonDisabled : null,
              pressed && job.canEnd ? styles.endButtonPressed : null,
            ]}>
            <Icon name="stop" size={14} color={colors.error} />
            <Text style={styles.endButtonText}>{job.canEnd ? 'End item' : 'Processing now'}</Text>
          </Pressable>
          {job.canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit queued item: ${job.title}`}
              onPress={() => onEdit?.(job.id)}
              style={({ pressed }) => [
                styles.editButton,
                pressed ? styles.editButtonPressed : null,
              ]}>
              <Icon name="edit" size={14} color={colors.primary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    gap: spacing.md,
    borderRadius: radius.xxl,
    padding: spacing.md,
  },
  activeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  activeLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  activeTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  activeStatus: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  progressSection: {
    gap: spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  progressIndeterminate: {
    width: '42%',
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    opacity: 0.7,
  },
  pendingCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  pendingIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingText: {
    flex: 1,
    gap: 2,
  },
  pendingTitleText: {
    ...typography.bodySm,
    fontWeight: '600',
    color: colors.onSurface,
  },
  pendingStatusText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  transcriptText: {
    ...typography.bodySm,
    color: colors.onSurface,
    lineHeight: 20,
  },
  expandedPanel: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.sm,
  },
  expandedLabel: {
    ...typography.labelCaps,
    color: colors.primary,
  },
  endButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.28)',
    backgroundColor: 'rgba(255, 250, 249, 0.76)',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  endButtonDisabled: {
    opacity: 0.52,
  },
  endButtonPressed: {
    opacity: 0.84,
  },
  endButtonText: {
    ...typography.bodySm,
    color: colors.error,
    fontWeight: '700',
  },
  editButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editButtonPressed: {
    opacity: 0.86,
  },
  editButtonText: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '700',
  },
});
