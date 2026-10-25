import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

export function PrivacyCard() {
  return (
    <Card variant="wash" style={styles.card}>
      <Icon 
        name="shield" 
        size={24} 
        color={colors.primary} 
        backgroundColor={colors.surfaceContainerLowest}
      />
      <View style={styles.content}>
        <Text style={styles.title}>Notes are stored on this phone</Text>
        <Text style={styles.description}>
          The writing assistant works on this phone. You choose if a backup is exported and where it is saved.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.outlineVariant,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.bodyLg,
    color: colors.primary,
    fontWeight: '700',
  },
  description: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
});
