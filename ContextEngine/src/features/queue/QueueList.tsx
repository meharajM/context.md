import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { QueueJobCard } from './QueueJobCard';
import type { QueueJobView } from './queueTypes';

export function QueueList({
  jobs,
  onEndJob,
  onEditJob,
  onResolveClarification,
}: {
  jobs: QueueJobView[];
  onEndJob?: (jobId: string) => void;
  onEditJob?: (jobId: string) => void;
  onResolveClarification?: (jobId: string, topic: string) => void;
}) {
  const pendingJobs = jobs.filter((job) => !job.isActiveSlot);

  return (
    <View style={styles.container}>
      {pendingJobs.length > 0 ? (
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Up next</Text>
          <Text style={styles.headerSubtitle}>
            {pendingJobs.length} {pendingJobs.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      ) : null}

      {pendingJobs.length === 0 ? (
        jobs.length === 0 ? (
          <View testID="queue_empty_state" style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="check" size={18} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nothing needs your attention</Text>
            <Text style={styles.emptyCopy}>Notes waiting to be sorted will show here. Saved notes stay in Inbox.</Text>
          </View>
        ) : null
      ) : (
        <View style={styles.listWrapper}>
          <View style={styles.list}>
            {pendingJobs.map((job) => (
              <QueueJobCard
                key={job.id}
                job={job}
                isActive={false}
                onEnd={onEndJob}
                onEdit={onEditJob}
                onResolveClarification={onResolveClarification}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  listWrapper: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.xl,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  list: {
    gap: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    maxWidth: 280,
    textAlign: 'center',
    lineHeight: 20,
  },
});
