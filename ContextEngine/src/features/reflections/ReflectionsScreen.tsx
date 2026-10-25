import React from 'react';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { RecentThreadList } from './RecentThreadList';
import type { NoteSearchResult, RecentThreadView } from './reflectionTypes';
import type { RecordingState } from '../capture/captureTypes';
import {
  formatBytesAsGiB,
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

  if (RELEASE_CAPABILITIES.voiceCapture && recordingState === 'error') {
    return {
      icon: 'mic' as const,
      title: 'Voice recording needs attention',
      copy: 'If you recorded audio, it is saved in Inbox. Check microphone access in Settings, then try again.',
      tone: 'unavailable' as const,
    };
  }

  if (queueSize > 0 || isProcessing) {
    const backgroundRetryStatus =
      displayStatus.startsWith('Saved in Inbox. Android') && !isProcessing;
    const synthesisUnavailable = displayStatus.startsWith('Synthesis unavailable on this device');
    const synthesisWaiting = displayStatus.startsWith('Waiting for device resources') || displayStatus.startsWith('Synthesis is waiting');
    if (backgroundRetryStatus) {
      return {
        icon: 'queue' as const,
        title: 'Note saved in Inbox',
        copy: displayStatus,
        tone: 'pending' as const,
      };
    }
    return {
      icon: 'queue' as const,
      title: synthesisUnavailable
        ? 'Writing assistant is not ready'
        : synthesisWaiting
          ? 'Your note is waiting'
        : `${queueSize || 1} note${queueSize === 1 ? '' : 's'} waiting`,
      copy: synthesisUnavailable || synthesisWaiting
        ? simpleStatus(displayStatus)
        : isProcessing ? 'The writing assistant is organizing a note.' : 'Open Waiting to review notes.',
      tone: 'queued' as const,
    };
  }

  if (displayStatus.startsWith('Saved to Inbox:')) {
    return {
      icon: 'queue' as const,
      title: 'Note saved in Inbox',
      copy: displayStatus,
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
      title: 'Writing assistant is not ready',
      copy: 'Typed notes are still saved in Inbox on this phone.',
      tone: 'unavailable' as const,
    };
  }

  if (displayStatus.startsWith('Waiting for device resources') || displayStatus.startsWith('Synthesis is waiting')) {
    return {
      icon: 'clock' as const,
      title: 'Your note is waiting',
      copy: 'Your note is saved in Inbox. The assistant will continue when your phone is ready.',
      tone: 'pending' as const,
    };
  }

  if (!RELEASE_CAPABILITIES.voiceCapture) {
    return {
      icon: 'edit' as const,
      title: 'Ready for a note',
      copy: 'Type a note below. It stays on this phone.',
      tone: 'ready' as const,
    };
  }

  if (!canRecord) {
    const needsMicrophone = /microphone|mic\s/i.test(displayStatus);
    return {
      icon: 'mic' as const,
      title: needsMicrophone ? 'Microphone access needed' : 'Voice notes are off',
      copy: needsMicrophone
        ? 'Allow microphone access in your phone settings. You can still type a note.'
        : 'Turn on voice notes in Settings. You can still type a note.',
      tone: 'unavailable' as const,
    };
  }

  return {
    icon: 'check' as const,
    title: 'Ready for a note',
      copy: 'Voice and typed notes stay on this phone.',
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
    const statusTitle = 'Downloading the writing assistant…';
    return {
      title: statusTitle,
      copy: belowMemoryMinimum
        ? `This phone has ${formatBytesAsGiB(deviceReadiness?.totalMemoryBytes ?? null)} of memory. The assistant may run slowly or stop, but your notes stay saved in Inbox.`
        : queueSize && queueSize > 0
          ? `${queueSize} note${queueSize === 1 ? '' : 's'} will be organized when the download finishes.`
          : 'New notes will be organized when the download finishes.',
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
    const requiredMemory = selectedModelMinMemoryInGb ?? deviceReadiness!.minimumMemoryBytes / 1024 ** 3;
    const modelSize = formatModelSize(selectedModelSizeBytes ?? 0);
    const currentMemory = formatBytesAsGiB(deviceReadiness!.totalMemoryBytes);
    return {
      title: selectedModelInstalled ? 'This phone has less memory than recommended' : `Needs ${requiredMemory} GB phone memory`,
      copy: selectedModelInstalled
        ? `This phone has ${currentMemory} of memory. The assistant may run slowly or stop, and your notes stay saved in Inbox.`
        : `This phone has ${currentMemory} of memory. It may run slowly or stop, but your notes stay saved in Inbox.`,
      progressLabel: null,
      showInstallAction: !selectedModelInstalled,
      installLabel: `Download anyway · ${modelSize}`,
    };
  }

  if (!selectedModelInstalled) {

    return {
      title: 'Download the writing assistant',
      copy:
        queueSize && queueSize > 0
          ? `${queueSize} note${queueSize === 1 ? '' : 's'} ${queueSize === 1 ? 'is' : 'are'} waiting to be organized.`
          : 'Your notes stay saved on this phone. Download the assistant to sort them into topics.',
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
  isRecording,
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
  onDismissDeviceReadinessNotice,
}: {
  threads: RecentThreadView[];
  searchQuery?: string;
  searchResults?: NoteSearchResult[];
  onSearchChange?: (query: string) => void;
  displayStatus?: string;
  canRecord?: boolean;
  isRecording?: boolean;
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
  onDismissDeviceReadinessNotice?: () => void;
}) {
  const status = getCaptureStatus(recordingState, canRecord, queueSize, isProcessing, displayStatus);
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
      : status.title === 'Note organized' && organizedTopic
        ? { label: `Open ${organizedTopic.title}`, onPress: () => onOpenThread(organizedTopic.id) }
        : null;

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.headline}>What's on your mind?</Text>
        <Text style={styles.subtitle}>
          {RELEASE_CAPABILITIES.voiceCapture
            ? 'Write or record a note, or continue a recent topic.'
            : 'Write a note, or continue a recent topic.'}
        </Text>
      </View>

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
              <Text style={styles.captureStatusCopy}>{status.copy}</Text>
            </View>
            <View
              style={[
                styles.captureDot,
                isRecording ? styles.captureDotLive : canRecord || !RELEASE_CAPABILITIES.voiceCapture ? styles.captureDotReady : styles.captureDotOff,
              ]}
            />
          </View>
          {status.tone === 'unavailable' && RELEASE_CAPABILITIES.voiceCapture ? (
            <Button
              label="Open voice note settings"
              variant="secondary"
              onPress={() => onOpenCaptureSettings?.()}
              testID="capture_settings_button"
              style={styles.captureSettingsButton}
            />
          ) : null}
          {statusAction ? (
            <Button
              label={statusAction.label}
              variant="secondary"
              onPress={statusAction.onPress}
              testID="capture_status_action"
              style={styles.captureSettingsButton}
            />
          ) : null}
        </Card>
      ) : null}

      {modelDownloadState && !showDeviceReadinessNotice ? (
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
        <SectionHeader title={searchQuery.trim() ? 'Search results' : 'Topics'} />

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
          <Card variant="inset" style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon name="spark" size={18} color={colors.primaryContainer} />
            </View>
            <Text style={styles.emptyTitle}>Nothing captured yet</Text>
            <Text style={styles.emptyCopy}>
              Your saved notes will appear here.
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
  captureSettingsButton: {
    minHeight: 44,
    marginTop: spacing.md,
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
    gap: spacing.xs,
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
