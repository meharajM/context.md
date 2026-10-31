import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

export function PrivacyCard() {
  return (
    <View style={styles.card}>
      <Icon name="shield" size={20} color={colors.onSurfaceVariant} />
      <View style={styles.content}>
        <Text style={styles.title}>Private by default</Text>
        <Text style={styles.description}>
          Notes and the writing helper stay on this device. Backups are exported only when you choose.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '600',
  },
  description: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
});
