import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '../design/colors';
import { spacing } from '../design/spacing';
import { typography } from '../design/typography';

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
        thumbColor={colors.surfaceContainerLowest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '600',
  },
  description: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  disabled: {
    opacity: 0.5,
  },
});
