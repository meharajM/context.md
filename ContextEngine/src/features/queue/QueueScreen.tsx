import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { QueueJobCard } from './QueueJobCard';
import { QueueList } from './QueueList';
import type { QueueJobView } from './queueTypes';

export function QueueScreen({
  jobs,
  displayStatus,
}: {
  jobs: QueueJobView[];
  displayStatus: string;
}) {
  const activeJob = jobs.find(
    (job) => job.statusLabel === 'Synthesizing...' || job.statusLabel === 'Pending...'
  );

  return (
    <View style={styles.screen}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active</Text>
        {activeJob ? (
          <QueueJobCard job={activeJob} isActive={true} />
        ) : (
          <QueueJobCard
            job={{
              id: 'idle',
              title: 'Queue clear',
              statusLabel: displayStatus || 'All thoughts synthesized locally',
              progress: null,
              kind: 'text',
            }}
            isActive={true}
          />
        )}
      </View>

      <QueueList jobs={jobs} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    paddingHorizontal: 4,
  },
});
