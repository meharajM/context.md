import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { QueueJobCard } from './QueueJobCard';
import type { QueueJobView } from './queueTypes';

export function QueueList({
  jobs,
}: {
  jobs: QueueJobView[];
}) {
  const pendingJobs = jobs.filter(j => j.statusLabel !== 'Synthesizing...' && j.statusLabel !== 'Pending...');

  return (
    <View style={styles.container}>
      <SectionHeader title={`Pending (${pendingJobs.length})`} />
      
      {pendingJobs.length === 0 ? (
        <Card variant="inset" style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No thoughts waiting right now</Text>
          <Text style={styles.emptyCopy}>
            New captures will appear here as they are stored for local AI synthesis.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {pendingJobs.map((job) => (
            <QueueJobCard key={job.id} job={job} isActive={false} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
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
