import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { SourceCaptureView } from './threadTypes';

interface SourceCaptureTimelineProps {
  captures: SourceCaptureView[];
  onEditCapture?: (captureId: string) => void;
  onPlayCaptureAudio?: (captureId: string) => void;
  onDeleteCaptureAudio?: (captureId: string) => void;
}

export function SourceCaptureTimeline({
  captures,
  onEditCapture,
  onPlayCaptureAudio,
  onDeleteCaptureAudio,
}: SourceCaptureTimelineProps) {
  if (captures.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No source captures in this thread.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {captures.map((capture, index) => {
        const isLast = index === captures.length - 1;
        
        return (
          <View key={capture.id} style={styles.timelineItem}>
            {/* Timeline rail and icon column */}
            <View style={styles.leftColumn}>
              <View style={styles.iconWrapper}>
                <Icon 
                  name={capture.icon} 
                  size={16} 
                  color={colors.primary} 
                  backgroundColor={colors.surfaceContainer}
                />
              </View>
              {!isLast && <View style={styles.rail} />}
            </View>

            {/* Content card column */}
            <View style={styles.rightColumn}>
              <Card variant="default" style={styles.captureCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.typeLabel}>{capture.typeLabel}</Text>
                  <View style={styles.cardHeaderActions}>
                    <Text style={styles.timeLabel}>{capture.timestampLabel}</Text>
                    {onEditCapture && capture.noteId ? (
                      <Pressable
                        accessibilityLabel={`Edit capture: ${capture.preview}`}
                        accessibilityRole="button"
                        onPress={() => onEditCapture(capture.id)}
                        hitSlop={8}
                        style={({ pressed }) => [styles.editButton, pressed ? styles.editButtonPressed : null]}>
                        <Icon name="edit" size={14} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.previewText}>{capture.preview}</Text>
                {capture.sourceMetadata?.audioFilePath ? (
                  <View style={styles.audioPanel}>
                    <Text style={styles.audioLabel}>Audio retained</Text>
                    <Text style={styles.audioText}>
                      Transcription failed. The original audio is still available.
                    </Text>
                  </View>
                ) : null}
                {capture.sourceTranscript ? (
                  <View style={styles.transcriptPanel}>
                    <Text style={styles.transcriptLabel}>Transcript</Text>
                    <Text style={styles.transcriptText}>{capture.sourceTranscript}</Text>
                  </View>
                ) : null}
                {capture.sourceMetadata?.audioFilePath ? (
                  <View style={styles.audioActions}>
                    {onPlayCaptureAudio && capture.noteId ? (
                      <Pressable
                        accessibilityLabel={`Play audio for capture: ${capture.preview}`}
                        accessibilityRole="button"
                        onPress={() => onPlayCaptureAudio(capture.id)}
                        hitSlop={8}
                        style={({ pressed }) => [styles.audioActionButton, pressed ? styles.audioActionButtonPressed : null]}>
                        <Icon name="play" size={14} color={colors.primary} />
                        <Text style={styles.audioActionText}>Play</Text>
                      </Pressable>
                    ) : null}
                    {onDeleteCaptureAudio && capture.noteId ? (
                      <Pressable
                        accessibilityLabel={`Delete retained audio for capture: ${capture.preview}`}
                        accessibilityRole="button"
                        onPress={() => onDeleteCaptureAudio(capture.id)}
                        hitSlop={8}
                        style={({ pressed }) => [styles.audioActionButton, pressed ? styles.audioActionButtonPressed : null]}>
                        <Icon name="trash" size={14} color={colors.error} />
                        <Text style={[styles.audioActionText, styles.audioActionTextDanger]}>Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.sm,
  },
  leftColumn: {
    alignItems: 'center',
    width: 32,
    marginRight: spacing.sm,
  },
  iconWrapper: {
    zIndex: 1,
    backgroundColor: colors.background,
    borderRadius: 999,
  },
  rail: {
    position: 'absolute',
    top: 24,
    bottom: -spacing.sm, // Extend rail to the next item's icon
    left: 15, // Centered inside the 32px column (15px + 2px width / 2 = 16px center)
    width: 2,
    backgroundColor: colors.surfaceContainerHigh,
  },
  rightColumn: {
    flex: 1,
  },
  captureCard: {
    padding: spacing.md,
    gap: spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeLabel: {
    ...typography.labelCaps,
    color: colors.primary,
    fontWeight: '700',
  },
  timeLabel: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  previewText: {
    ...typography.bodySm,
    color: colors.onSurface,
    lineHeight: 20,
  },
  transcriptPanel: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
  },
  audioPanel: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
  },
  audioActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  transcriptLabel: {
    ...typography.labelCaps,
    color: colors.primary,
  },
  audioLabel: {
    ...typography.labelCaps,
    color: colors.error,
  },
  transcriptText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  audioText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  audioActionButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
  },
  audioActionButtonPressed: {
    opacity: 0.86,
  },
  audioActionText: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '700',
  },
  audioActionTextDanger: {
    color: colors.error,
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  editButtonPressed: {
    opacity: 0.85,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
