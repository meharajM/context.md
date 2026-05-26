import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { RecentThreadList } from './RecentThreadList';
import type { RecentThreadView } from './reflectionTypes';

export function ReflectionsScreen({
  threads,
  displayStatus: _displayStatus,
  canRecord: _canRecord,
  isRecording: _isRecording,
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

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.headline}>What's on your mind?</Text>
        <Text style={styles.subtitle}>
          Capture a thought, start a reflection, or continue a recent thread.
        </Text>
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
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  headline: {
    ...typography.displayLg,
    color: colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
    opacity: 0.9,
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
