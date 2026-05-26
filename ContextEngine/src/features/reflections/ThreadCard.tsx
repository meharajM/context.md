import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
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
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider ? styles.rowDivider : null, pressed ? styles.rowPressed : null]}>
      <View style={styles.iconShell}>
        <Icon name={thread.icon} size={16} color={colors.primaryContainer} />
      </View>

      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={styles.title} numberOfLines={1}>
            {thread.title}
          </Text>
          <Text style={styles.updatedAt}>{thread.updatedAtLabel}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2}>
          {thread.preview}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{thread.noteCountLabel}</Text>
        </View>
      </View>

      <Icon name="chevronRight" size={16} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  rowPressed: {
    opacity: 0.88,
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  updatedAt: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
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
    color: colors.primary,
    fontWeight: '600',
  },
});
