import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

import { Button } from '../../shared/components/Button';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { colors } from '../../shared/design/colors';
import { SummaryCard } from './SummaryCard';
import { SourceCaptureTimeline } from './SourceCaptureTimeline';
import type { ThreadDetailsView } from './threadTypes';

interface ThreadDetailsScreenProps {
  threadDetails: ThreadDetailsView | null;
  onOpenAgent?: () => void;
  onShareContext?: () => void;
}

export function ThreadDetailsScreen({
  threadDetails,
  onOpenAgent,
  onShareContext,
}: ThreadDetailsScreenProps) {
  if (!threadDetails) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Thread Not Found</Text>
        <Text style={styles.errorSubtitle}>
          The requested thread details could not be loaded. Please return to reflections and select a different thread.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Executive Summary Section */}
      <SummaryCard summary={threadDetails.summary} />

      {/* Source Captures Timeline Section */}
      <View style={styles.timelineSection}>
        <SectionHeader title="Source captures" />
        <SourceCaptureTimeline captures={threadDetails.captures} />
      </View>

      {/* Thread Action Buttons */}
      <View style={styles.actionsContainer}>
        <Button
          label="Open with AI Agent"
          variant="primary"
          icon="spark"
          onPress={onOpenAgent ?? (() => console.log('Open with AI Agent pressed'))}
          testID="btn_open_agent"
        />
        <Button
          label="Share Context"
          variant="secondary"
          icon="share"
          onPress={onShareContext ?? (() => console.log('Share Context pressed'))}
          testID="btn_share_context"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  timelineSection: {
    gap: spacing.sm,
  },
  actionsContainer: {
    gap: spacing.base,
    marginTop: spacing.md,
  },
  errorContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    minHeight: 300,
  },
  errorTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorSubtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
});
