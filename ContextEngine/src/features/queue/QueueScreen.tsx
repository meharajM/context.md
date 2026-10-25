import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { QueueJobCard } from './QueueJobCard';
import { QueueList } from './QueueList';
import type { QueueJobView } from './queueTypes';

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
      {activeJob ? (
        <View style={styles.section}>
          <QueueJobCard
            job={activeJob}
            isActive={true}
            onEnd={onEndJob}
            onResolveClarification={onResolveClarification}
          />
          {activeJob.canEdit ? <Button label="Edit note" testID="clarification_edit_button" variant="secondary" onPress={() => onEditJob?.(activeJob.id)} /> : null}
          {activeJob.canEnd ? <Button label="Remove from waiting" testID="clarification_remove_button" variant="secondary" onPress={() => onEndJob?.(activeJob.id)} /> : null}
        </View>
      ) : null}
      {jobs.length > 0 && displayStatus.startsWith('Saved in Inbox. Android') ? (
        <Text testID="background_synthesis_status" style={styles.backgroundStatus}>
          {displayStatus}
        </Text>
      ) : null}

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
  backgroundStatus: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    paddingHorizontal: 4,
  },
});
