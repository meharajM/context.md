import React from 'react';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { RecentThreadList } from './RecentThreadList';
import type { NoteSearchResult, RecentThreadView } from './reflectionTypes';
import type { RecordingState } from '../capture/captureTypes';
import {
  type DeviceReadinessAssessment,
} from '../../modules/DeviceReadiness';
import { formatModelSize } from '../../ui/design';
import { DeviceReadinessNotice } from '../readiness/DeviceReadinessNotice';
import { simpleStatus } from '../../shared/utils/simpleStatus';

function getCaptureStatus(
  recordingState: RecordingState,
  canRecord = false,
  queueSize = 0,
  isProcessing = false,
  displayStatus = '',
) {
  if (RELEASE_CAPABILITIES.voiceCapture && recordingState === 'recording') {
    return {
      icon: 'mic' as const,
      title: 'Recording voice note',
      copy: 'Tap stop when your note is complete.',
      tone: 'recording' as const,
    };
  }

  if (RELEASE_CAPABILITIES.voiceCapture && recordingState === 'starting') {
    return {
      icon: 'clock' as const,
      title: 'Starting voice note',
      copy: 'Getting ready to record.',
      tone: 'pending' as const,
    };
  }

  if (RELEASE_CAPABILITIES.voiceCapture && (recordingState === 'stopping' || recordingState === 'transcribing')) {
    return {
      icon: 'queue' as const,
      title: recordingState === 'stopping' ? 'Saving recording' : 'Getting words from recording',
      copy: 'Your voice note is being saved.',
      tone: 'pending' as const,
    };
  }

  const microphoneIssue = /^mic error:|^allow the requested permissions/i.test(displayStatus);
  if (RELEASE_CAPABILITIES.voiceCapture && recordingState === 'error' &&
    /^(Audio retained in Inbox|Temporary audio saved in Inbox)/i.test(displayStatus)) {
    return {
      icon: 'queue' as const,
      title: 'Recording saved in Inbox',
      copy: "We couldn't get words from this recording. You can listen to it in Inbox and try again later.",
      tone: 'pending' as const,
    };
  }

  if (RELEASE_CAPABILITIES.voiceCapture && recordingState === 'error' && microphoneIssue) {
    return {
      icon: 'mic' as const,
      title: 'Microphone access needed',
      copy: 'Allow microphone access in Settings, then try again. You can still type a note.',
      tone: 'unavailable' as const,
    };
  }

  if (queueSize > 0 || isProcessing) {
    const backgroundRetryStatus =
      displayStatus.startsWith('Saved in Inbox.') && !isProcessing;
    const synthesisUnavailable = displayStatus.startsWith('Synthesis unavailable on this device');
    const synthesisWaiting = displayStatus.startsWith('Waiting for device resources') || displayStatus.startsWith('Synthesis is waiting');
    if (backgroundRetryStatus) {
      return {
        icon: 'queue' as const,
        title: 'Note saved in Inbox',
        copy: simpleStatus(displayStatus),
        tone: 'pending' as const,
      };
    }
    return {
      icon: 'queue' as const,
      title: synthesisUnavailable
        ? 'Writing helper is not ready'
        : synthesisWaiting
          ? 'Your note is waiting'
        : `${queueSize || 1} note${queueSize === 1 ? '' : 's'} waiting`,
      copy: synthesisUnavailable || synthesisWaiting
        ? simpleStatus(displayStatus)
        : isProcessing ? 'The writing helper is sorting a note.' : 'Open Waiting to review notes.',
      tone: 'queued' as const,
    };
  }

  if (displayStatus.startsWith('Saved to Inbox:')) {
    return {
      icon: 'queue' as const,
      title: 'Note saved in Inbox',
      copy: 'AI will sort it when ready.',
      tone: 'pending' as const,
    };
  }

  if (displayStatus.startsWith('Organized into ') || displayStatus === 'Note organized') {
    return {
      icon: 'check' as const,
      title: 'Note organized',
      copy: displayStatus,
      tone: 'ready' as const,
    };
  }

  if (displayStatus.startsWith('Synthesis unavailable on this device')) {
    return {
      icon: 'clock' as const,
      title: 'Writing helper is not ready',
      copy: 'Typed notes are still saved in Inbox on this device.',
      tone: 'unavailable' as const,
    };
  }

  if (displayStatus.startsWith('Waiting for device resources') || displayStatus.startsWith('Synthesis is waiting')) {
    return {
      icon: 'clock' as const,
      title: 'Your note is waiting',
      copy: 'Your note is safe in Inbox. The writing helper will try again when it can.',
      tone: 'pending' as const,
    };
  }

  if (RELEASE_CAPABILITIES.voiceCapture && recordingState === 'error') {
    return {
      icon: 'mic' as const,
      title: 'Voice recording needs attention',
      copy: 'Your notes are safe. Try recording again, or type a note.',
      tone: 'unavailable' as const,
    };
  }

  if (!RELEASE_CAPABILITIES.voiceCapture) {
    return {
      icon: 'edit' as const,
      title: 'Ready for a note',
      copy: 'Type a note below. It stays on this device.',
      tone: 'ready' as const,
    };
  }

  if (!canRecord) {
    const needsMicrophone = /microphone|mic\s/i.test(displayStatus);
    return {
      icon: 'mic' as const,
      title: needsMicrophone ? 'Microphone access needed' : 'Voice notes are off',
      copy: needsMicrophone
        ? 'Allow microphone access in your device settings. You can still type a note.'
        : 'Turn on voice notes in Settings. You can still type a note.',
      tone: 'unavailable' as const,
    };
  }

  return {
    icon: 'check' as const,
    title: 'Ready for a note',
      copy: 'Voice and typed notes stay on this device.',
    tone: 'ready' as const,
  };
}

function getModelDownloadState({
  liteRtEnabled,
  selectedModelInstalled,
  selectedModelDownloading,
  selectedModelSizeBytes,
  selectedModelMinMemoryInGb,
  selectedModelProgress,
  queueSize,
  deviceReadiness,
}: {
  liteRtEnabled?: boolean;
  selectedModelInstalled?: boolean;
  selectedModelDownloading?: boolean;
  selectedModelSizeBytes?: number;
  selectedModelMinMemoryInGb?: number;
  selectedModelProgress?: number;
  queueSize?: number;
  deviceReadiness?: DeviceReadinessAssessment | null;
}) {
  if (!liteRtEnabled) {
    return null;
  }

  if (selectedModelDownloading) {
    const belowMemoryMinimum = Boolean(
      deviceReadiness?.checkAvailable &&
      deviceReadiness.totalMemoryBytes !== null &&
      deviceReadiness.totalMemoryBytes <
        (selectedModelMinMemoryInGb ?? deviceReadiness.minimumMemoryBytes / 1024 ** 3) * 1024 ** 3,
    );
    const downloadSize = selectedModelSizeBytes ? `about ${formatModelSize(selectedModelSizeBytes)}` : 'the writing helper';
    const statusTitle = 'Downloading the writing helper…';
    return {
      title: statusTitle,
      copy: `Downloading ${downloadSize}${belowMemoryMinimum ? '; it may be slow on this device' : ''}. You can keep capturing; notes stay saved in Inbox while it prepares. This may use mobile data.`,
      progressLabel: `${selectedModelProgress ?? 0}%`,
      showInstallAction: true,
      installLabel: `Downloading ${selectedModelProgress ?? 0}%`,
    };
  }

  const belowMemoryMinimum = Boolean(
    deviceReadiness?.checkAvailable &&
    deviceReadiness.totalMemoryBytes !== null &&
    deviceReadiness.totalMemoryBytes <
      (selectedModelMinMemoryInGb ?? deviceReadiness.minimumMemoryBytes / 1024 ** 3) * 1024 ** 3,
  );

  if (belowMemoryMinimum) {
    const modelSize = formatModelSize(selectedModelSizeBytes ?? 0);
    return {
      title: 'The writing helper may be slow here',
      copy: selectedModelInstalled
        ? 'Your notes will still be saved, and you can keep using the app.'
        : 'Your notes will still be saved if you choose to download it.',
      progressLabel: null,
      showInstallAction: !selectedModelInstalled,
      installLabel: `Download · ${modelSize}`,
    };
  }

  if (!selectedModelInstalled) {

    return {
      title: 'Download the writing helper',
      copy:
        queueSize && queueSize > 0
          ? `${queueSize} note${queueSize === 1 ? '' : 's'} ${queueSize === 1 ? 'is' : 'are'} waiting to be organized.`
          : 'Your notes stay saved on this device. Download the helper to sort them into topics.',
      progressLabel: null,
      showInstallAction: true,
      installLabel: `Download · ${formatModelSize(selectedModelSizeBytes ?? 0)}`,
    };
  }

  return null;
}

export function ReflectionsScreen({
  threads,
  searchQuery = '',
  searchResults = [],
  onSearchChange,
  displayStatus = '',
  canRecord,
  recordingState = 'idle',
  queueSize = 0,
  isProcessing = false,
  liteRtEnabled,
  selectedModelSizeBytes,
  selectedModelMinMemoryInGb,
  selectedModelInstalled,
  selectedModelDownloading,
  selectedModelProgress,
  onDownloadModel,
  onOpenModelInfo,
  onOpenCaptureSettings,
  onOpenQueue,
  onOpenThread,
  deviceReadiness,
  showDeviceReadinessNotice = false,
  deviceReadinessNoticeDismissed = false,
  onDismissDeviceReadinessNotice,
}: {
  threads: RecentThreadView[];
  searchQuery?: string;
  searchResults?: NoteSearchResult[];
  onSearchChange?: (query: string) => void;
  displayStatus?: string;
  canRecord?: boolean;
  recordingState?: RecordingState;
  queueSize?: number;
  isProcessing?: boolean;
  liteRtEnabled?: boolean;
  selectedModelSizeBytes?: number;
  selectedModelMinMemoryInGb?: number;
  selectedModelInstalled?: boolean;
  selectedModelDownloading?: boolean;
  selectedModelProgress?: number;
  onDownloadModel?: () => void;
  onOpenModelInfo?: () => void;
  onOpenCaptureSettings?: () => void;
  onOpenQueue?: () => void;
  onOpenThread: (threadId: string, noteId?: string) => void;
  deviceReadiness?: DeviceReadinessAssessment | null;
  showDeviceReadinessNotice?: boolean;
  deviceReadinessNoticeDismissed?: boolean;
  onDismissDeviceReadinessNotice?: () => void;
}) {
  const status = getCaptureStatus(recordingState, canRecord, queueSize, isProcessing, displayStatus);
  const topicOrganizerReady = Boolean(liteRtEnabled && selectedModelInstalled);
  const modelDownloadState = getModelDownloadState({
    liteRtEnabled,
    selectedModelInstalled,
    selectedModelDownloading,
    selectedModelSizeBytes,
    selectedModelMinMemoryInGb,
    selectedModelProgress,
    queueSize,
    deviceReadiness,
  });
  const inbox = threads.find(thread => thread.title.trim().toLowerCase() === 'inbox');
  const organizedTopic = displayStatus.startsWith('Organized into ')
    ? threads.find(thread => thread.title === displayStatus.slice('Organized into '.length))
    : undefined;
  const statusAction = status.tone === 'queued' || (queueSize > 0 && status.title === 'Note saved in Inbox')
    ? onOpenQueue ? { label: 'Open Waiting', onPress: onOpenQueue } : null
    : status.title === 'Note saved in Inbox' && inbox
      ? { label: 'Open Inbox', onPress: () => onOpenThread(inbox.id) }
        : status.title === 'Recording saved in Inbox' && inbox
          ? { label: 'Open Inbox', onPress: () => onOpenThread(inbox.id) }
      : status.title === 'Note organized' && organizedTopic
        ? { label: `Open ${organizedTopic.title}`, onPress: () => onOpenThread(organizedTopic.id) }
        : null;

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.headline}>Your thoughts</Text>
        <Text style={styles.subtitle}>
          {topicOrganizerReady
            ? 'On-device AI keeps related thoughts together.'
            : 'Notes stay here; on-device AI organizes them when ready.'}
        </Text>
      </View>

      {threads.length > 0 || searchQuery.trim() ? (
        <TextInput
          accessibilityLabel="Search saved notes"
          placeholder="Search notes"
          placeholderTextColor={colors.onSurfaceVariant}
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
          testID="note_search_input"
          style={styles.searchInput}
        />
      ) : null}

      {showDeviceReadinessNotice ? (
        <DeviceReadinessNotice
          readiness={deviceReadiness ?? null}
          modelSizeBytes={selectedModelSizeBytes}
          canInstallModel={Boolean(liteRtEnabled && !selectedModelInstalled)}
          isModelDownloading={Boolean(selectedModelDownloading)}
          modelProgress={selectedModelProgress ?? 0}
          onInstallModel={onDownloadModel}
          onDismiss={() => onDismissDeviceReadinessNotice?.()}
        />
      ) : null}

      {status && status.title !== 'Ready for a note' ? (
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
              <Text style={styles.captureStatusCopy} numberOfLines={status.title === 'Note saved in Inbox' ? 1 : 2}>
                {status.copy}
              </Text>
            </View>
            {statusAction ? (
              <Button
                label={statusAction.label}
                variant="ghost"
                onPress={statusAction.onPress}
                testID="capture_status_action"
                style={styles.captureStatusAction}
              />
            ) : null}
          </View>
          {status.tone === 'unavailable' && status.title === 'Microphone access needed' && RELEASE_CAPABILITIES.voiceCapture ? (
            <Button
              label="Open voice note settings"
              variant="ghost"
              onPress={() => onOpenCaptureSettings?.()}
              testID="capture_settings_button"
              style={styles.captureSettingsButton}
            />
          ) : null}
        </Card>
      ) : null}

      {modelDownloadState && deviceReadiness && !showDeviceReadinessNotice && (!deviceReadinessNoticeDismissed || selectedModelDownloading) ? (
        <Card variant="wash" style={styles.modelPromptCard}>
          <View style={styles.modelPromptPressable}>
            <View style={styles.modelPromptTop}>
              <View style={styles.modelPromptIcon}>
                <Icon name="storage" size={18} color={colors.primary} />
              </View>
              <View style={styles.modelPromptText}>
                <Text style={styles.modelPromptTitle}>{modelDownloadState.title}</Text>
                <Text style={styles.modelPromptCopy}>{modelDownloadState.copy}</Text>
              </View>
              {modelDownloadState.progressLabel ? (
                <Text style={styles.modelPromptProgress}>{modelDownloadState.progressLabel}</Text>
              ) : null}
            </View>

            <View style={styles.modelPromptActions}>
              {modelDownloadState.showInstallAction !== false ? (
                <Button
                  label={
                    modelDownloadState.installLabel
                  }
                  onPress={() => onDownloadModel?.()}
                  disabled={selectedModelDownloading}
                  testID="model_prompt_install_button"
                  style={styles.modelPromptAction}
                />
              ) : null}
              <Button
                label="More details"
                variant="ghost"
                onPress={() => onOpenModelInfo?.()}
                testID="model_prompt_info_button"
                style={styles.modelPromptAction}
              />
            </View>
          </View>
        </Card>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{searchQuery.trim() ? 'Search results' : 'Topics'}</Text>

        {searchQuery.trim() ? searchResults.length === 0 ? (
          <Card variant="inset" style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matching notes</Text>
            <Text style={styles.emptyCopy}>Try another word from a note, transcript, or topic.</Text>
          </Card>
        ) : (
          <Card variant="inset" style={styles.searchResultsCard}>
            {searchResults.map((result, index) => (
              <Pressable
                key={`${result.id}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${result.topic}, ${result.dateLabel}: ${result.text}`}
                onPress={() => onOpenThread(result.threadId, result.id)}
                testID={`note_search_result_${index}`}
                style={({ pressed }) => [styles.searchResult, index > 0 ? styles.searchResultDivider : null, pressed ? styles.searchResultPressed : null]}>
                <View style={styles.searchResultHeading}>
                  <Text style={styles.searchResultTopic} numberOfLines={1}>{result.topic}</Text>
                  <Text style={styles.searchResultDate}>{result.dateLabel}</Text>
                </View>
                <Text style={styles.searchResultText} numberOfLines={3}>{result.text}</Text>
              </Pressable>
            ))}
          </Card>
        ) : threads.length === 0 ? (
          <View style={styles.emptyTopics} testID="empty_topics_state">
            <Text style={styles.emptyTitle}>No topics yet</Text>
            <Text style={styles.emptyCopy}>Add a thought below to get started.</Text>
          </View>
        ) : (
          <RecentThreadList threads={threads} onOpenThread={onOpenThread} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
  },
  searchInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.md,
    ...typography.bodySm,
    color: colors.onSurface,
  },
  searchResultsCard: {
    padding: 0,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
  },
  searchResult: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  searchResultDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  searchResultPressed: {
    opacity: 0.85,
  },
  searchResultHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchResultTopic: {
    flex: 1,
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  searchResultDate: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  searchResultText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  captureStatusCard: {
    borderRadius: radius.lg,
    padding: spacing.xs,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: colors.surfaceContainerLow,
  },
  captureStatusRecording: {
    borderColor: colors.error,
    backgroundColor: colors.errorContainer,
  },
  captureStatusPending: {
    borderColor: colors.outlineVariant,
    backgroundColor: colors.secondaryContainer,
  },
  captureSettingsButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  captureStatusAction: {
    flexShrink: 0,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  captureStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  captureStatusIcon: {
    width: 30,
    height: 30,
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
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '600',
  },
  captureStatusCopy: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  modelPromptCard: {
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  modelPromptPressable: {
    gap: spacing.md,
  },
  modelPromptTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  modelPromptIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelPromptText: {
    flex: 1,
    gap: spacing.xs,
  },
  modelPromptTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  modelPromptCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  modelPromptProgress: {
    ...typography.labelCaps,
    color: colors.primary,
  },
  modelPromptActions: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  modelPromptAction: {
    flex: 1,
    minHeight: 44,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  headline: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'left',
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'left',
  },
  section: {
    flex: 1,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    paddingBottom: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    borderRadius: radius.xl,
  },
  emptyTopics: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    justifyContent: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
