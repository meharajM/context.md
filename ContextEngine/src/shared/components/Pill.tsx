import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '../design/colors';
import { radius } from '../design/radius';
import { typography } from '../design/typography';

type PillVariant = 'local' | 'installed' | 'progress' | 'danger';

export function Pill({
  label,
  variant = 'local',
  style,
}: {
  label: string;
  variant?: PillVariant;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.base, stylesByVariant[variant], style]}>
      <Text style={[styles.text, stylesTextByVariant[variant]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  text: {
    ...typography.labelCaps,
    textTransform: 'uppercase',
  },
  local: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.outlineVariant,
  },
  installed: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.outlineVariant,
  },
  progress: {
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.outlineVariant,
  },
  danger: {
    backgroundColor: colors.errorContainer,
    borderColor: colors.error,
  },
});

const stylesByVariant = {
  local: styles.local,
  installed: styles.installed,
  progress: styles.progress,
  danger: styles.danger,
} as const;

const stylesTextByVariant = {
  local: {
    color: colors.primary,
  },
  installed: {
    color: colors.primary,
  },
  progress: {
    color: colors.onSurfaceVariant,
  },
  danger: {
    color: colors.error,
  },
} as const;
