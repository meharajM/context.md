import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../../shared/design/colors';
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
    <View style={styles.list}>
      {threads.map((thread, index) => (
        <ThreadCard key={thread.id} thread={thread} divider={index > 0} onPress={() => onOpenThread(thread.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerHigh,
  },
});
