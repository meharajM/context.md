import React from 'react';
import { StyleSheet } from 'react-native';

import { Card } from '../../shared/components/Card';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import type { RecentThreadView } from './reflectionTypes';
import { ThreadCard } from './ThreadCard';

export function RecentThreadList({
  threads,
  onOpenThread,
}: {
  threads: RecentThreadView[];
  onOpenThread: (threadId: string) => void;
}) {
  return (
    <Card variant="inset" style={styles.card}>
      {threads.map((thread, index) => (
        <ThreadCard key={thread.id} thread={thread} divider={index > 0} onPress={() => onOpenThread(thread.id)} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
  },
});
