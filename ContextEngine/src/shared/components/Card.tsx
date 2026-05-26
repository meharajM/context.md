import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../design/colors';
import { radius } from '../design/radius';
import { shadows } from '../design/shadows';

type CardVariant = 'default' | 'wash' | 'inset' | 'action';

export function Card({
  children,
  style,
  variant = 'default',
  ...rest
}: ViewProps & {
  variant?: CardVariant;
}) {
  return <View style={[styles.base, stylesByVariant[variant], style]} {...rest}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xxl,
    padding: 16,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.card,
  },
  default: {
    backgroundColor: colors.surfaceContainerLowest,
  },
  wash: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.outlineVariant,
  },
  inset: {
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.surfaceVariant,
    borderRadius: radius.xl,
    shadowOpacity: 0,
    elevation: 0,
  },
  action: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xl,
    paddingVertical: 14,
  },
});

const stylesByVariant = {
  default: styles.default,
  wash: styles.wash,
  inset: styles.inset,
  action: styles.action,
} as const;
