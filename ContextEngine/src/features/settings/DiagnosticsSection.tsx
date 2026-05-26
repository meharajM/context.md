import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Pill } from '../../shared/components/Pill';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { SettingsViewModel } from './settingsTypes';

interface DiagnosticsSectionProps {
  settingsView: SettingsViewModel;
}

export function DiagnosticsSection({ settingsView }: DiagnosticsSectionProps) {
  const getStatusPillVariant = (status: 'good' | 'warning' | 'error') => {
    switch (status) {
      case 'good':
        return 'installed';
      case 'warning':
        return 'progress';
      case 'error':
        return 'danger';
      default:
        return 'progress';
    }
  };

  const getStatusLabel = (status: 'good' | 'warning' | 'error') => {
    switch (status) {
      case 'good':
        return 'Healthy';
      case 'warning':
        return 'Warning';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const diagnosticItems = [
    settingsView.audioStatus,
    settingsView.modelStatus,
    settingsView.storageStatus,
  ];

  return (
    <View style={styles.container}>
      <SectionHeader title="Diagnostics" />
      <Card variant="inset" style={styles.card}>
        {diagnosticItems.map((item, index) => (
          <View key={item.label}>
            {index > 0 && <View style={styles.separator} />}
            <View style={styles.row}>
              <View style={styles.textBlock}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value} numberOfLines={2}>
                  {item.value}
                </Text>
              </View>
              <Pill 
                label={getStatusLabel(item.status)} 
                variant={getStatusPillVariant(item.status)} 
              />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.surfaceContainer,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '600',
  },
  value: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
});
