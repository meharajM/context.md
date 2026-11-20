import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

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
  onResearchWithChatGPT?: (task: string) => Promise<void>;
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
  onResearchWithChatGPT,
  onEditCapture,
  onDeleteCapture,
  onPlayCaptureAudio,
  onDeleteCaptureAudio,
  onTranscribeCapture,
  targetNoteId,
  onTargetLayout,
}: ThreadDetailsScreenProps) {
  const [transcribingCaptureId, setTranscribingCaptureId] = React.useState<string | null>(null);
  const [researchModalVisible, setResearchModalVisible] = React.useState(false);
  const [researchTask, setResearchTask] = React.useState('');
  const [researchBusy, setResearchBusy] = React.useState(false);
  const [researchError, setResearchError] = React.useState<string | null>(null);
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

  const handleResearchSubmit = async () => {
    const task = researchTask.trim();
    if (!task || !onResearchWithChatGPT || researchBusy) return;
    setResearchBusy(true);
    setResearchError(null);
    try {
      await onResearchWithChatGPT(task);
      setResearchModalVisible(false);
      setResearchTask('');
    } catch (error) {
      setResearchError(error instanceof Error ? error.message : 'Could not prepare the research handoff.');
    } finally {
      setResearchBusy(false);
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
        {onResearchWithChatGPT ? (
          <Button
            label="Research with ChatGPT"
            variant="secondary"
            icon="spark"
            onPress={() => {
              setResearchError(null);
              setResearchModalVisible(true);
            }}
            testID="btn_research_chatgpt"
          />
        ) : null}
      </View>
      <Modal
        visible={researchModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setResearchModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Research with ChatGPT</Text>
            <Text style={styles.modalCopy}>
              FunctionGemma will prepare a research query on this device. Thought Notes will share your task and this topic with the app you choose. Select ChatGPT in the share sheet, send the request there, then share its answer back to Thought Notes to review and save it through Import.
            </Text>
            <TextInput
              value={researchTask}
              onChangeText={value => {
                setResearchTask(value);
                setResearchError(null);
              }}
              placeholder="What should ChatGPT research?"
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              maxLength={500}
              editable={!researchBusy}
              accessibilityLabel="Research task"
              testID="research_task_input"
              style={styles.researchInput}
            />
            {researchError ? (
              <Text style={styles.researchError} accessibilityLiveRegion="polite">{researchError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setResearchModalVisible(false)}
                disabled={researchBusy}
                testID="research_cancel_button"
              />
              <Button
                label={researchBusy ? 'Preparing…' : 'Continue'}
                variant="primary"
                onPress={handleResearchSubmit}
                disabled={researchBusy || !researchTask.trim()}
                testID="research_continue_button"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.base,
  },
  modalTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  modalCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  researchInput: {
    ...typography.bodyLg,
    color: colors.onSurface,
    minHeight: 112,
    maxHeight: 180,
    borderColor: colors.outline,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  researchError: {
    ...typography.caption,
    color: colors.error,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
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
