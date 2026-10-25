import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

import { Button } from '../../shared/components/Button';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { colors } from '../../shared/design/colors';
import { SourceCaptureTimeline } from './SourceCaptureTimeline';
import type { ThreadDetailsView } from './threadTypes';

interface ThreadDetailsScreenProps {
  threadDetails: ThreadDetailsView | null;
  onQueueInboxForSynthesis?: () => void;
  onOpenAgent?: () => void;
  onEditCapture?: (captureId: string) => void;
  onDeleteCapture?: (captureId: string) => void;
  onPlayCaptureAudio?: (captureId: string) => void;
  onDeleteCaptureAudio?: (captureId: string) => void;
  onTranscribeCapture?: (captureId: string) => Promise<void>;
  targetNoteId?: string | null;
  onTargetLayout?: (y: number) => void;
}

export function ThreadDetailsScreen({
  threadDetails,
  onQueueInboxForSynthesis,
  onOpenAgent,
  onEditCapture,
  onDeleteCapture,
  onPlayCaptureAudio,
  onDeleteCaptureAudio,
  onTranscribeCapture,
  targetNoteId,
  onTargetLayout,
}: ThreadDetailsScreenProps) {
  const [transcribingCaptureId, setTranscribingCaptureId] = React.useState<string | null>(null);
  const targetLayout = React.useRef<{ sectionY?: number; captureY?: number; reported?: boolean }>({});
  const reportTargetLayout = () => {
    const { sectionY, captureY, reported } = targetLayout.current;
    if (sectionY !== undefined && captureY !== undefined && !reported) {
      targetLayout.current.reported = true;
      onTargetLayout?.(sectionY + captureY);
    }
  };

  const handleTranscribeCapture = async (captureId: string) => {
    if (!onTranscribeCapture || transcribingCaptureId) {
      return;
    }

    setTranscribingCaptureId(captureId);
    try {
      await onTranscribeCapture(captureId);
    } finally {
      setTranscribingCaptureId(null);
    }
  };

  if (!threadDetails) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Couldn't open these notes</Text>
        <Text style={styles.errorSubtitle}>
          Go back and choose another topic.
        </Text>
      </View>
    );
  }

  const isInbox = threadDetails.title.trim().toLowerCase() === 'inbox';

  return (
    <View style={styles.container}>
      {/* Source Captures Timeline Section */}
      <View testID="original_notes_section" style={styles.timelineSection} onLayout={event => {
        targetLayout.current.sectionY = event.nativeEvent.layout.y;
        reportTargetLayout();
      }}>
        <SectionHeader title="Original notes" />
        <SourceCaptureTimeline
          captures={threadDetails.captures}
          onEditCapture={onEditCapture}
          onDeleteCapture={isInbox ? onDeleteCapture : undefined}
          onPlayCaptureAudio={onPlayCaptureAudio}
          onDeleteCaptureAudio={isInbox ? onDeleteCaptureAudio : undefined}
          onTranscribeCapture={isInbox && onTranscribeCapture ? handleTranscribeCapture : undefined}
          transcribingCaptureId={transcribingCaptureId}
          targetNoteId={targetNoteId}
          onTargetLayout={y => {
            targetLayout.current.captureY = y;
            reportTargetLayout();
          }}
        />
      </View>

      {/* Thread Action Buttons */}
      <View style={styles.actionsContainer}>
        {isInbox ? (
          <Button
            label="Organize Inbox notes"
            variant="primary"
            icon="queue"
            onPress={onQueueInboxForSynthesis ?? (() => undefined)}
            disabled={!onQueueInboxForSynthesis}
            testID="btn_synthesize_inbox"
          />
        ) : null}
        <Button
          label="Share with an assistant"
          variant={isInbox ? 'secondary' : 'primary'}
          icon="spark"
          onPress={onOpenAgent ?? (() => console.log('Share with an assistant pressed'))}
          testID="btn_open_agent"
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
