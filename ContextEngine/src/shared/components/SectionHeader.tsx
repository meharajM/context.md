import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../design/colors';
import { typography } from '../design/typography';

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
}: {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onActionPress} hitSlop={8} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  action: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});
