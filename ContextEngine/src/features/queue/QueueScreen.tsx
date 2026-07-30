import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { QueueJobCard } from './QueueJobCard';
import { QueueList } from './QueueList';
import type { QueueJobView } from './queueTypes';

function getIdleStatus(displayStatus: string) {
  const staleStatuses = new Set([
    'Idle',
    'Stored for later',
    'Voice note queued',
    'Queue item ended',
    'Stored in context',
  ]);
  return staleStatuses.has(displayStatus) || displayStatus.startsWith('QA transcript')
    ? 'All thoughts synthesized locally'
    : displayStatus || 'All thoughts synthesized locally';
}

export function QueueScreen({
  jobs,
  displayStatus,
  onEndJob,
  onEditJob,
  onResolveClarification,
}: {
  jobs: QueueJobView[];
  displayStatus: string;
  onEndJob?: (jobId: string) => void;
  onEditJob?: (jobId: string) => void;
  onResolveClarification?: (jobId: string, topic: string) => void;
}) {
  const activeJob = jobs.find((job) => job.isActiveSlot);

  return (
    <View style={styles.screen}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active</Text>
        {activeJob ? (
          <QueueJobCard
            job={activeJob}
            isActive={true}
            onEnd={onEndJob}
            onResolveClarification={onResolveClarification}
          />
        ) : (
          <QueueJobCard
            job={{
              id: 'idle',
              noteId: 'idle',
              title: 'Queue clear',
              transcript: '',
              timestampLabel: '',
              statusLabel: getIdleStatus(displayStatus),
              progress: null,
              kind: 'text',
              canEnd: false,
              canEdit: false,
              isActiveSlot: true,
            }}
            isActive={true}
          />
        )}
      </View>

      <QueueList
        jobs={jobs}
        onEndJob={onEndJob}
        onEditJob={onEditJob}
        onResolveClarification={onResolveClarification}
      />
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
