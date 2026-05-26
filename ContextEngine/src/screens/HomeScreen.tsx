import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../shared/components/Card';
import { Pill } from '../shared/components/Pill';
import { SectionHeader } from '../shared/components/SectionHeader';
import { colors } from '../shared/design/colors';
import { radius } from '../shared/design/radius';
import { spacing } from '../shared/design/spacing';
import { typography } from '../shared/design/typography';
import { formatSectionPreview } from '../ui/design';

export function HomeScreen({
  displayStatus,
  canRecord,
  isRecording,
  sections,
}: {
  displayStatus: string;
  canRecord: boolean;
  isRecording: boolean;
  sections: { header: string; content: string }[];
}) {
  const latestSections = sections.slice(0, 3);

  return (
    <View style={styles.homeShell}>
      <View style={styles.heroBlock}>
        <Pill label="Local" variant="local" />
        <Text style={styles.homeTitle}>Capture what should not be lost.</Text>
        <Text style={styles.homeCopy}>
          Typed notes, push-to-record, and the local context file stay aligned without leaving the device.
        </Text>

        <Card variant="wash" style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusTextBlock}>
              <Text style={styles.statusLabel}>Runtime</Text>
              <Text style={styles.statusValue}>{displayStatus}</Text>
            </View>
            <Pill
              label={isRecording ? 'Recording' : canRecord ? 'Voice ready' : 'Voice locked'}
              variant={isRecording ? 'danger' : canRecord ? 'installed' : 'progress'}
            />
          </View>
        </Card>
      </View>

      <View style={styles.previewGroup}>
        <SectionHeader title="Recent topics" />
        <Card variant="inset" style={styles.previewCard}>
          {latestSections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing captured yet</Text>
              <Text style={styles.emptyText}>Type a thought or record one and the latest context appears here.</Text>
            </View>
          ) : (
            latestSections.map((section, index) => (
              <View
                key={`${section.header}-${index}`}
                style={[styles.previewItem, index < latestSections.length - 1 ? styles.previewItemDivider : null]}>
                <View style={styles.previewMetaRow}>
                  <Text style={styles.previewHeader} numberOfLines={1}>
                    {section.header}
                  </Text>
                  <Pill label="Review" variant="progress" />
                </View>
                <Text style={styles.previewBody} numberOfLines={2}>
                  {formatSectionPreview(section.content)}
                </Text>
              </View>
            ))
          )}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeShell: {
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.lg,
    marginBottom: spacing.base,
  },
  heroBlock: {
    gap: spacing.md,
  },
  homeTitle: {
    ...typography.displayLg,
    color: colors.onSurface,
    maxWidth: 320,
  },
  homeCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    maxWidth: 330,
  },
  statusCard: {
    marginTop: spacing.xs,
    borderRadius: radius.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  statusLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  statusValue: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  previewGroup: {
    gap: spacing.sm,
  },
  previewCard: {
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  previewItem: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  previewItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  previewHeader: {
    flex: 1,
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  previewBody: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  emptyState: {
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
});
