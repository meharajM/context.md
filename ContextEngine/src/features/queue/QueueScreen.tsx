import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../shared/design/spacing';
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

      <QueueList jobs={jobs} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
});
