import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
}: {
  job: QueueJobView;
  isActive?: boolean;
}) {
  if (isActive) {
    return (
      <Card variant="default" style={styles.activeCard}>
        <View style={styles.activeTop}>
          <View style={styles.iconContainer}>
            <Icon name="mic" size={24} color={colors.primary} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.activeLabel}>Active job</Text>
            <Text style={styles.activeTitle} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={styles.activeStatus}>{job.statusLabel}</Text>
          </View>
          <Pill label="Synthesizing" variant="progress" />
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.pendingRow}>
      <View style={styles.pendingIndicator}>
        <View style={styles.pendingDot} />
        <View style={styles.pendingLine} />
      </View>
      <Card variant="action" style={styles.pendingCard}>
        <View style={styles.pendingContent}>
          <View style={styles.pendingText}>
            <Text style={styles.pendingTitleText} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={styles.pendingStatusText}>
              {job.statusLabel}
            </Text>
          </View>
          <Icon name="clock" size={16} color={colors.onSurfaceVariant} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  activeCard: {
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
    width: '65%', // High visual quality active state representation matching modern designs
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  pendingIndicator: {
    width: 16,
    alignItems: 'center',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.outline,
    marginTop: 22,
  },
  pendingLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.outlineVariant,
    marginTop: 4,
    opacity: 0.5,
  },
  pendingCard: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pendingText: {
    flex: 1,
    gap: 2,
  },
  pendingTitleText: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '500',
  },
  pendingStatusText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
});
