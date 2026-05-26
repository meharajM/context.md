import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { Pill } from '../../shared/components/Pill';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { RecentThreadList } from './RecentThreadList';
import type { RecentThreadView } from './reflectionTypes';

export function ReflectionsScreen({
  threads,
  displayStatus,
  canRecord,
  isRecording,
  onOpenThread,
  onViewAll,
}: {
  threads: RecentThreadView[];
  displayStatus?: string;
  canRecord?: boolean;
  isRecording?: boolean;
  onOpenThread: (threadId: string) => void;
  onViewAll?: () => void;
}) {
  const voiceLabel = isRecording ? 'Recording' : canRecord ? 'Voice ready' : 'Voice locked';

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Pill label="Local" variant="local" />
          <View style={styles.runtimePill}>
            <Text style={styles.runtimeLabel}>Runtime</Text>
            <Text style={styles.runtimeValue} numberOfLines={1}>
              {displayStatus ?? 'Idle'}
            </Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.headline}>What&apos;s on your mind?</Text>
          <Text style={styles.subtitle}>
            Typed notes and quick captures stay on device, then reappear as threads when you need them.
          </Text>
        </View>

        <Card variant="wash" style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>Capture state</Text>
              <Text style={styles.statusValue}>{displayStatus ?? 'Idle'}</Text>
            </View>
            <Pill label={voiceLabel} variant={isRecording ? 'danger' : canRecord ? 'installed' : 'progress'} />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent Threads" actionLabel="View All" onActionPress={onViewAll} />

        {threads.length === 0 ? (
          <Card variant="inset" style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon name="spark" size={18} color={colors.primaryContainer} />
            </View>
            <Text style={styles.emptyTitle}>Nothing captured yet</Text>
            <Text style={styles.emptyCopy}>
              Type a thought or record a note, and the latest thread will appear here.
            </Text>
          </Card>
        ) : (
          <RecentThreadList threads={threads} onOpenThread={onOpenThread} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  runtimePill: {
    minWidth: 116,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  runtimeLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  runtimeValue: {
    ...typography.caption,
    color: colors.onSurface,
    fontWeight: '600',
  },
  titleBlock: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    alignItems: 'flex-start',
  },
  headline: {
    ...typography.displayLg,
    color: colors.onSurface,
    maxWidth: 320,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    maxWidth: 320,
  },
  statusCard: {
    borderRadius: radius.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusCopy: {
    flex: 1,
    gap: 4,
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
  section: {
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    borderRadius: radius.xl,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    textAlign: 'center',
  },
  emptyCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 270,
  },
});
