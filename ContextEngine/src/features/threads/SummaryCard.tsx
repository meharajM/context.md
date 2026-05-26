import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

interface SummaryCardProps {
  summary: string;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <Card variant="wash" style={styles.card}>
      <View style={styles.header}>
        <Icon name="spark" size={16} color={colors.primary} />
        <Text style={styles.headerLabel}>Executive Summary</Text>
      </View>
      <Text style={styles.summaryText}>{summary}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.outlineVariant,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  headerLabel: {
    ...typography.labelCaps,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryText: {
    ...typography.bodyLg,
    color: colors.onSurface,
    lineHeight: 24,
  },
});
