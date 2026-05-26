import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '../design/colors';
import { radius } from '../design/radius';
import { typography } from '../design/typography';
import { Icon, type IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        stylesByVariant[variant],
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}>
      {icon ? <Icon name={icon} size={16} color={stylesTextByVariant[variant].color} /> : null}
      <Text style={[styles.text, stylesTextByVariant[variant]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  primary: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  secondary: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  text: {
    ...typography.bodySm,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});

const stylesByVariant = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
} as const;

const stylesTextByVariant = {
  primary: {
    color: colors.surfaceContainerLowest,
  },
  secondary: {
    color: colors.onSurface,
  },
  ghost: {
    color: colors.primary,
  },
} as const;
