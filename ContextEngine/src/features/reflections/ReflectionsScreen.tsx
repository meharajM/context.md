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
import type { RecordingState } from '../capture/captureTypes';

function getCaptureStatus(
  recordingState: RecordingState,
  canRecord = false,
  displayStatus?: string,
  queueSize = 0,
  isProcessing = false,
) {
  if (recordingState === 'recording') {
    return {
      icon: 'mic' as const,
      title: 'Recording live',
      copy: 'Tap stop when your note is complete.',
      tone: 'recording' as const,
    };
  }

  if (recordingState === 'starting') {
    return {
      icon: 'clock' as const,
      title: 'Opening microphone',
      copy: 'Preparing local capture.',
      tone: 'pending' as const,
    };
  }

  if (recordingState === 'stopping' || recordingState === 'transcribing') {
    return {
      icon: 'queue' as const,
      title: recordingState === 'stopping' ? 'Saving recording' : 'Building transcript',
      copy: 'Your voice note is moving into the local queue.',
      tone: 'pending' as const,
    };
  }

  if (queueSize > 0 || isProcessing) {
    return {
      icon: 'queue' as const,
      title: `${queueSize || 1} capture${queueSize === 1 ? '' : 's'} in queue`,
      copy: isProcessing ? 'Local AI is synthesizing a note now.' : 'Open Queue to inspect transcripts before synthesis.',
      tone: 'queued' as const,
    };
  }

  if (!canRecord) {
    const unavailableCopy =
      displayStatus && displayStatus !== 'Idle'
        ? displayStatus
        : 'Enable Push to Record in Settings, or check microphone readiness.';

    return {
      icon: 'mic' as const,
      title: 'Recording unavailable',
      copy: unavailableCopy,
      tone: 'pending' as const,
    };
  }

  return {
    icon: 'check' as const,
    title: 'Ready to capture',
    copy: 'Voice and text captures stay on device.',
    tone: 'ready' as const,
  };
}

export function ReflectionsScreen({
  threads,
  displayStatus,
  canRecord,
  isRecording,
  recordingState = 'idle',
  queueSize = 0,
  isProcessing = false,
  onOpenThread,
  onViewAll,
}: {
  threads: RecentThreadView[];
  displayStatus?: string;
  canRecord?: boolean;
  isRecording?: boolean;
  recordingState?: RecordingState;
  queueSize?: number;
  isProcessing?: boolean;
  onOpenThread: (threadId: string) => void;
  onViewAll?: () => void;
}) {
  const status = getCaptureStatus(recordingState, canRecord, displayStatus, queueSize, isProcessing);

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.headline}>What's on your mind?</Text>
        <Text style={styles.subtitle}>
          Capture a thought, start a reflection, or continue a recent thread.
        </Text>
      </View>

      <Card
        variant="default"
        style={[
          styles.captureStatusCard,
          status.tone === 'recording' ? styles.captureStatusRecording : null,
          status.tone === 'pending' ? styles.captureStatusPending : null,
        ]}>
        <View style={styles.captureStatusTop}>
          <View style={[styles.captureStatusIcon, status.tone === 'recording' ? styles.captureStatusIconLive : null]}>
            <Icon
              name={status.icon}
              size={18}
              color={status.tone === 'recording' ? colors.error : colors.primary}
            />
          </View>
          <View style={styles.captureStatusText}>
            <Text style={styles.captureStatusTitle}>{status.title}</Text>
            <Text style={styles.captureStatusCopy}>{status.copy}</Text>
          </View>
          <View style={[styles.captureDot, isRecording ? styles.captureDotLive : canRecord ? styles.captureDotReady : styles.captureDotOff]} />
        </View>
      </Card>

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
  captureStatusCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  captureStatusRecording: {
    borderColor: 'rgba(186, 26, 26, 0.34)',
    backgroundColor: 'rgba(255, 250, 249, 0.82)',
  },
  captureStatusPending: {
    borderColor: 'rgba(59, 95, 122, 0.22)',
    backgroundColor: 'rgba(245, 250, 253, 0.84)',
  },
  captureStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  captureStatusIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureStatusIconLive: {
    backgroundColor: colors.errorContainer,
  },
  captureStatusText: {
    flex: 1,
    gap: 2,
  },
  captureStatusTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  captureStatusCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  captureDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
  },
  captureDotLive: {
    backgroundColor: colors.error,
  },
  captureDotReady: {
    backgroundColor: colors.primary,
  },
  captureDotOff: {
    backgroundColor: colors.outlineVariant,
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
