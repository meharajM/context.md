import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { RecentThreadView } from './reflectionTypes';

export function ThreadCard({
  thread,
  onPress,
  divider = false,
}: {
  thread: RecentThreadView;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${thread.title}, ${thread.noteCountLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider ? styles.rowDivider : null, pressed ? styles.rowPressed : null]}>
      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={styles.title} numberOfLines={1}>
            {thread.title}
          </Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {thread.preview}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{thread.noteCountLabel} · {thread.updatedAtLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  rowPressed: {
    opacity: 0.88,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '600',
  },
  preview: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
});
