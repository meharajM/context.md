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
  onQueueInboxForSynthesis?: () => void;
  onOpenAgent?: () => void;
  onShareContext?: () => void;
  onEditCapture?: (captureId: string) => void;
  onDeleteCapture?: (captureId: string) => void;
  onPlayCaptureAudio?: (captureId: string) => void;
  onDeleteCaptureAudio?: (captureId: string) => void;
}

export function ThreadDetailsScreen({
  threadDetails,
  onQueueInboxForSynthesis,
  onOpenAgent,
  onShareContext,
  onEditCapture,
  onDeleteCapture,
  onPlayCaptureAudio,
  onDeleteCaptureAudio,
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

  const isInbox = threadDetails.title.trim().toLowerCase() === 'inbox';

  return (
    <View style={styles.container}>
      {/* Executive Summary Section */}
      <SummaryCard summary={threadDetails.summary} />

      {/* Source Captures Timeline Section */}
      <View style={styles.timelineSection}>
        <SectionHeader title="Source captures" />
        <SourceCaptureTimeline
          captures={threadDetails.captures}
          onEditCapture={onEditCapture}
          onDeleteCapture={isInbox ? onDeleteCapture : undefined}
          onPlayCaptureAudio={onPlayCaptureAudio}
          onDeleteCaptureAudio={isInbox ? onDeleteCaptureAudio : undefined}
        />
      </View>

      {/* Thread Action Buttons */}
      <View style={styles.actionsContainer}>
        {isInbox ? (
          <Button
            label="Synthesize Inbox"
            variant="primary"
            icon="queue"
            onPress={onQueueInboxForSynthesis ?? (() => undefined)}
            disabled={!onQueueInboxForSynthesis}
            testID="btn_synthesize_inbox"
          />
        ) : null}
        <Button
          label="Open with AI Agent"
          variant={isInbox ? 'secondary' : 'primary'}
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
