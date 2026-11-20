import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '../../core/store';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { MeetingSharePart } from '../../shared/utils/meetingContent';
import type { MeetingSession } from './meetingTypes';

const clock = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const formattedMinutes = String(minutes % 60).padStart(2, '0');
  const formattedSeconds = String(seconds % 60).padStart(2, '0');
  return minutes >= 60
    ? String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + formattedMinutes + ':' + formattedSeconds
    : String(minutes).padStart(2, '0') + ':' + formattedSeconds;
};

function MeetingDetails({
  meeting,
  active,
  onAction,
  onRetryTranscription,
  onShareMeeting,
  onShareMeetingWithAi,
  onSaveMeetingToNotes,
  writingHelperReady,
}: {
  meeting: MeetingSession;
  active: boolean;
  onAction: (actionId: string, state: 'confirmed' | 'dismissed') => void;
  onRetryTranscription: () => void;
  onShareMeeting: (meeting: MeetingSession, part: MeetingSharePart) => void;
  onShareMeetingWithAi: (meeting: MeetingSession) => void;
  onSaveMeetingToNotes: (meetingId: string) => Promise<void>;
  writingHelperReady: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const [savingToNotes, setSavingToNotes] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const duration = (meeting.endedAt ?? now) - meeting.startedAt;
  const actions = meeting.actions.filter(action => !action.dismissed);
  const hasTranscript = meeting.transcript.some(segment => segment.text.trim());
  const hasSummary = Boolean(meeting.summary?.trim());
  const hasActions = meeting.actions.length > 0;
  const hasShareableContent = hasTranscript || hasSummary || hasActions;
  const canShareOrSave = !active && meeting.status !== 'recording' &&
    (meeting.status !== 'summarizing' || meeting.transcriptionComplete) && hasShareableContent;

  const saveToNotes = async () => {
    if (savingToNotes) return;
    setSavingToNotes(true);
    setSaveError('');
    try {
      await onSaveMeetingToNotes(meeting.id);
    } catch (error) {
      console.warn('Could not save meeting content to notes:', error);
      setSaveError('Could not save the meeting to notes. Try again.');
    } finally {
      setSavingToNotes(false);
    }
  };

  return (
    <View style={styles.stack}>
      {active ? (
        <Card variant="wash" style={styles.recordingCard} testID="meeting_recording_indicator">
          <View style={styles.recordingRow}>
            <View style={styles.liveDot} />
            <View style={styles.fill}>
              <Text style={styles.recordingTitle}>Recording meeting</Text>
              <Text style={styles.muted}>Audio stays on this device · {clock(duration)}</Text>
            </View>
            <Icon name="mic" size={20} color={colors.error} />
          </View>
          <Text style={styles.muted}>
            Transcript appears in timestamped chunks. Processing may trail the recording on slower devices.
          </Text>
          <Button
            label="Stop and save"
            onPress={() => useAppStore.getState().stopMeeting()}
            testID="meeting_stop_button"
          />
        </Card>
      ) : null}

      {meeting.status === 'summarizing' ? (
        <Card variant="inset">
          <Text style={styles.body}>
            {meeting.transcriptionComplete
              ? 'Transcript saved. Creating summary and suggested actions…'
              : 'Transcribing recovered meeting audio…'}
          </Text>
        </Card>
      ) : null}
      {meeting.error ? (
        <Card variant="inset">
          <Text style={styles.body}>{meeting.error}</Text>
        </Card>
      ) : null}
      {meeting.audioFilePath && !meeting.transcriptionComplete &&
        meeting.status !== 'recording' && meeting.status !== 'summarizing' ? (
        <Button label="Transcribe recovered audio" variant="secondary" onPress={onRetryTranscription} />
      ) : null}

      {meeting.summary ? (
        <View style={styles.section}>
          <SectionHeader title={meeting.summarySource === 'transcript' ? 'Transcript highlights' : 'Summary'} />
          <Card variant="default"><Text style={styles.body}>{meeting.summary}</Text></Card>
          {meeting.summarySource === 'transcript' ? (
            <Text style={styles.muted}>Selected from recognized speech. Check names and details against the transcript.</Text>
          ) : null}
        </View>
      ) : meeting.status === 'complete' ? (
        <Card variant="inset">
          <Text style={styles.muted} testID="meeting_summary_auto_notice">Summary creation is automatic. Transcript and suggested actions are saved.</Text>
          {!writingHelperReady ? (
            <Text style={styles.muted}>Enable and download the on-device writing helper in Settings to create a summary.</Text>
          ) : null}
        </Card>
      ) : null}

      {canShareOrSave ? (
        <View style={styles.section}>
          <SectionHeader title="Share content" />
          <Text style={styles.muted}>Choose one section or share everything together.</Text>
          <Button label="Share summary" variant="ghost" disabled={!hasSummary} onPress={() => onShareMeeting(meeting, 'summary')} testID="meeting_share_summary_button" />
          <Button label="Share transcript" variant="ghost" disabled={!hasTranscript} onPress={() => onShareMeeting(meeting, 'transcript')} testID="meeting_share_transcript_button" />
          <Button label="Share action items" variant="ghost" disabled={!hasActions} onPress={() => onShareMeeting(meeting, 'actions')} testID="meeting_share_actions_button" />
          <Button label="Share everything" variant="secondary" onPress={() => onShareMeeting(meeting, 'all')} testID="meeting_share_all_button" />
          <Button label="Share everything with an assistant" variant="ghost" onPress={() => onShareMeetingWithAi(meeting)} testID="meeting_share_ai_button" />
          <Button
            label={savingToNotes ? 'Saving…' : meeting.savedNoteId ? 'Update saved note' : 'Save to notes'}
            onPress={saveToNotes}
            disabled={savingToNotes}
            testID="meeting_save_note_button"
          />
          {meeting.savedNoteId ? <Text style={styles.muted}>Saved as a note. Updates replace the same note.</Text> : null}
          {saveError ? <Text style={styles.muted}>{saveError}</Text> : null}
        </View>
      ) : null}

      {actions.length ? (
        <View style={styles.section}>
          <SectionHeader title="Suggested actions" />
          {actions.map(action => (
            <Card key={action.id} variant="default" style={styles.actionCard}>
              <Text style={styles.body}>{action.text}</Text>
              <View style={styles.actionButtons}>
                <Button
                  label={action.confirmed ? 'Kept' : 'Keep action'}
                  variant={action.confirmed ? 'secondary' : 'ghost'}
                  disabled={action.confirmed}
                  onPress={() => onAction(action.id, 'confirmed')}
                />
                {!action.confirmed ? (
                  <Button label="Dismiss" variant="ghost" onPress={() => onAction(action.id, 'dismissed')} />
                ) : null}
              </View>
            </Card>
          ))}
          <Text style={styles.muted}>Review each suggestion. Keeping one does not schedule a reminder.</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Transcript" />
        {meeting.transcript.length ? meeting.transcript.map(segment => (
          <View key={segment.id} style={styles.transcriptRow}>
            <Text style={styles.timestamp}>{clock(segment.startMs)}</Text>
            <Text style={styles.body}>{segment.text}</Text>
          </View>
        )) : (
          <Card variant="inset">
            <Text style={styles.muted}>
              {active ? 'Waiting for the first transcript chunk…' : 'No transcript was saved. The recording is preserved for review.'}
            </Text>
          </Card>
        )}
      </View>
    </View>
  );
}

export function MeetingScreen({
  onBack,
  onShareMeeting,
  onShareMeetingWithAi,
  onSaveMeetingToNotes,
}: {
  onBack: () => void;
  onShareMeeting: (meeting: MeetingSession, part: MeetingSharePart) => void;
  onShareMeetingWithAi: (meeting: MeetingSession) => void;
  onSaveMeetingToNotes: (meetingId: string) => Promise<void>;
}) {
  const {
    meetings,
    activeMeetingId,
    meetingTranscriptionRetryActive,
    recordingState,
    status,
    audioReadiness,
    whisperModelDownloading,
    liteRtEnabled,
    selectedModelInstalled,
    selectedModelDownloading,
    startMeeting,
    loadMeetings,
    updateMeetingAction,
    retryMeetingTranscription,
  } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startError, setStartError] = useState('');
  const previousActiveId = useRef<string | null>(null);
  const canStartMeeting = audioReadiness.transcriptionReady && !whisperModelDownloading;
  const writingHelperReady = liteRtEnabled && selectedModelInstalled;
  const active = meetings.find(meeting => meeting.id === activeMeetingId) ?? null;
  const selected = useMemo(
    () => meetings.find(meeting => meeting.id === selectedId) ?? null,
    [meetings, selectedId],
  );

  useEffect(() => {
    loadMeetings().catch(error => console.warn('Meeting load failed:', error));
  }, [loadMeetings]);
  useEffect(() => {
    if (activeMeetingId) {
      previousActiveId.current = activeMeetingId;
    } else if (previousActiveId.current) {
      setSelectedId(previousActiveId.current);
      previousActiveId.current = null;
    }
  }, [activeMeetingId]);

  const startMeetingWithFeedback = async () => {
    setStartError('');
    try {
      setStartError((await startMeeting()) ?? '');
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error));
    }
  };

  if (selected && selected.id !== activeMeetingId) {
    return (
      <View style={styles.stack}>
        <Button label="All meetings" variant="ghost" onPress={() => setSelectedId(null)} />
        <Text style={styles.heading}>{selected.title}</Text>
        <Text style={styles.muted}>{new Date(selected.startedAt).toLocaleString()} · {clock((selected.endedAt ?? selected.startedAt) - selected.startedAt)}</Text>
        <MeetingDetails
          meeting={selected}
          active={false}
          onAction={(actionId, state) => updateMeetingAction(selected.id, actionId, state)
            .catch(error => console.warn('Meeting action update failed:', error))}
          onRetryTranscription={() => retryMeetingTranscription(selected.id)
            .catch(error => console.warn('Meeting transcription retry failed:', error))}
          onShareMeeting={onShareMeeting}
          onShareMeetingWithAi={onShareMeetingWithAi}
          onSaveMeetingToNotes={onSaveMeetingToNotes}
          writingHelperReady={writingHelperReady}
        />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.intro}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Meeting mode</Text>
          <Button label="Back" variant="ghost" onPress={onBack} />
        </View>
        <Text style={styles.muted}>
          For in-person meetings. Captures room audio from your microphone and transcribes on this device.
        </Text>
        <Text style={styles.muted}>
          Let everyone know recording is on and follow your local consent rules.
        </Text>
      </View>

      {active ? (
        <>
          <Text style={styles.meetingTitle}>{active.title}</Text>
          <MeetingDetails
            meeting={active}
            active={recordingState === 'recording'}
            onAction={(actionId, state) => updateMeetingAction(active.id, actionId, state)
              .catch(error => console.warn('Meeting action update failed:', error))}
            onRetryTranscription={() => retryMeetingTranscription(active.id)
              .catch(error => console.warn('Meeting transcription retry failed:', error))}
            onShareMeeting={onShareMeeting}
            onShareMeetingWithAi={onShareMeetingWithAi}
            onSaveMeetingToNotes={onSaveMeetingToNotes}
            writingHelperReady={writingHelperReady}
          />
          {recordingState === 'starting' || recordingState === 'stopping' || recordingState === 'transcribing' ? (
            <Card variant="inset"><Text style={styles.muted}>{status}</Text></Card>
          ) : null}
        </>
      ) : (
        <>
          <Card variant="wash" style={styles.startCard}>
            <View style={styles.recordingRow}>
              <View style={styles.startIcon}><Icon name="mic" size={22} color={colors.primary} /></View>
              <View style={styles.fill}>
                <Text style={styles.recordingTitle}>{canStartMeeting ? 'Ready when you are' : 'Transcription not ready'}</Text>
                <Text style={styles.muted}>
                  {canStartMeeting
                    ? 'Start here. The widget opens this screen but never starts recording.'
                    : 'Start becomes available when the on-device voice model is ready.'}
                </Text>
              </View>
            </View>
            <Button
              label={meetingTranscriptionRetryActive ? 'Transcribing…' : recordingState === 'starting' ? 'Preparing…' : 'Start meeting'}
              onPress={startMeetingWithFeedback}
              disabled={!canStartMeeting || recordingState === 'starting' || recordingState === 'recording' ||
                recordingState === 'stopping' || recordingState === 'transcribing' || meetingTranscriptionRetryActive}
              testID="meeting_start_button"
            />
            {!audioReadiness.transcriptionReady || whisperModelDownloading ? (
              <Text style={styles.muted}>
                {whisperModelDownloading ? 'Voice model is downloading.' : 'Whisper setup is needed before recording.'}
              </Text>
            ) : null}
            {!writingHelperReady ? (
              <Text style={styles.muted} testID="meeting_summary_setup_notice">
                {selectedModelDownloading
                  ? 'The writing helper is downloading. On-device AI summaries will be available when it finishes; transcript highlights are generated automatically.'
                  : 'On-device AI summaries need the writing helper. Transcript highlights are generated automatically even when it is unavailable.'}
              </Text>
            ) : null}
          </Card>
          {startError ? (
            <Card variant="inset" testID="meeting_start_error">
              <Text accessibilityLiveRegion="polite" style={styles.muted}>{startError}</Text>
            </Card>
          ) : null}
          {meetings.length ? (
            <View style={styles.section}>
              <SectionHeader title="Recent meetings" />
              {meetings.map(meeting => (
                <Pressable
                  key={meeting.id}
                  testID={`meeting_history_${meeting.id}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedId(meeting.id)}
                  style={({ pressed }) => [styles.historyRow, pressed ? styles.pressed : null]}>
                  <View style={styles.fill}>
                    <Text style={styles.recordingTitle}>{meeting.title}</Text>
                    <Text style={styles.muted}>{new Date(meeting.startedAt).toLocaleString()}</Text>
                  </View>
                  <Text style={styles.status}>{meeting.status === 'complete' ? 'Saved' : 'Needs review'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  intro: { gap: spacing.xs },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { ...typography.headlineMd, color: colors.onSurface, fontWeight: '700' },
  meetingTitle: { ...typography.headlineSm, color: colors.onSurface, fontWeight: '600' },
  body: { ...typography.bodyLg, color: colors.onSurface, lineHeight: 23 },
  muted: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 20 },
  recordingCard: { gap: spacing.md },
  startCard: { gap: spacing.md },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fill: { flex: 1, gap: 3 },
  recordingTitle: { ...typography.bodySm, color: colors.onSurface, fontWeight: '600' },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  startIcon: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.secondaryContainer,
  },
  actionCard: { gap: spacing.sm },
  actionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  transcriptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  timestamp: { ...typography.caption, color: colors.primary, minWidth: 44, paddingTop: 3 },
  historyRow: {
    minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, paddingVertical: spacing.sm,
  },
  status: { ...typography.caption, color: colors.onSurfaceVariant },
  pressed: { opacity: 0.75 },
});
