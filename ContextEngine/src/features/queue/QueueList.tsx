import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { QueueJobCard } from './QueueJobCard';
import type { QueueJobView } from './queueTypes';

export function QueueList({
  jobs,
}: {
  jobs: QueueJobView[];
}) {
  const pendingJobs = jobs.filter(
    (j) => j.statusLabel !== 'Synthesizing...' && j.statusLabel !== 'Pending...'
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Pending</Text>
        <Text style={styles.headerSubtitle}>
          {pendingJobs.length} {pendingJobs.length === 1 ? 'item' : 'items'}
        </Text>
      </View>

      {pendingJobs.length === 0 ? (
        <Card variant="inset" style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No thoughts waiting right now</Text>
          <Text style={styles.emptyCopy}>
            New captures will appear here as they are stored for local AI synthesis.
          </Text>
        </Card>
      ) : (
        <View style={styles.listWrapper}>
          <View style={styles.list}>
            {pendingJobs.map((job) => (
              <QueueJobCard key={job.id} job={job} isActive={false} />
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
    borderColor: 'rgba(194, 199, 203, 0.3)', // low opacity outlineVariant
  },
  list: {
    gap: spacing.xs,
  },
  emptyCard: {
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    alignItems: 'center',
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
    maxWidth: 260,
  },
});
