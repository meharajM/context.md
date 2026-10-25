import { RELEASE_CAPABILITIES } from '../core/releaseCapabilities';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Linking, NativeModules, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '../core/store';
import { AppHeader } from '../shared/components/AppHeader';
import { Button } from '../shared/components/Button';
import { BottomNav } from '../shared/components/BottomNav';
import { colors } from '../shared/design/colors';
import { spacing } from '../shared/design/spacing';
import { CaptureComposerContainer } from '../features/capture/CaptureComposerContainer';
import { RecordingIndicator } from '../features/capture/RecordingIndicator';
import { ImportScreen } from '../features/import/ImportScreen';
import { ReflectionsScreen } from '../features/reflections/ReflectionsScreen';
import { selectNoteSearchResults, selectRecentThreads } from '../features/reflections/reflectionsSelectors';
import { QueueScreen } from '../features/queue/QueueScreen';
import { selectQueueView } from '../features/queue/queueSelectors';
import { NoteEditorScreen, type NoteEditorMetadataLine } from '../features/noteEditor/NoteEditorScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { selectSettingsViewModel } from '../features/settings/settingsSelectors';
import { ThreadDetailsScreen } from '../features/threads/ThreadDetailsScreen';
import { selectThreadDetailsView } from '../features/threads/threadSelectors';
import { ContextManager } from '../modules/ContextManager';
import { ProcessingQueueManager } from '../modules/SynthesisEngine/ProcessingQueueManager';
import { useHeadsetTripleTapCapture } from '../shared/hooks/useHeadsetTripleTapCapture';
import type { AppRoute, PrimaryRoute } from './navigation';
import { shareThreadContext, shareThreadWithAiPrompt } from '../shared/utils/share';

type NoteEditorState =
  | {
      mode: 'queue';
      returnRoute: Exclude<AppRoute, 'noteEditor'>;
      bodyLabel: string;
      value: string;
      topic: string;
      canEditTopic: boolean;
      metadataLines: NoteEditorMetadataLine[];
      queueJobId: string;
    }
    | {
      mode: 'capture';
      returnRoute: Exclude<AppRoute, 'noteEditor'>;
      bodyLabel: string;
      value: string;
      topic: string;
      canEditTopic: boolean;
      metadataLines: NoteEditorMetadataLine[];
      sectionHeader: string;
      noteId: string;
      sourceKind?: 'voice' | 'text' | 'image';
      sourceTranscript?: string;
      originalSourceTranscript?: string;
      sourceAudioFilePath?: string | null;
    };

export function AppShell({
  bootMessage,
  contextPath,
  quickCaptureRequest = 0,
  quickRecordRequest = 0,
}: {
  bootMessage: string;
  contextPath: string;
  quickCaptureRequest?: number;
  quickRecordRequest?: number;
}) {
  useHeadsetTripleTapCapture();

  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<AppRoute>('reflections');
  const [primaryRoute, setPrimaryRoute] = useState<PrimaryRoute>('reflections');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [targetNoteId, setTargetNoteId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const previousRouteRef = useRef(route);
  const [editorState, setEditorState] = useState<NoteEditorState | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardDismissRequest, setKeyboardDismissRequest] = useState(0);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');

  const {
    sections,
    isRecording,
    recordingState,
    status,
    queueSize,
    queueBlockedReason,
    deviceReadiness,
    deviceReadinessNoticeVisible,
    models,
    selectedModelId,
    selectedModelInstalled,
    selectedModelDownloading,
    selectedModelProgress,
    selectedModelError,
    audioReadiness,
    runTranscriptionProbe,
    manualCaptureEnabled,
    pushToRecordEnabled,
    wakeWordEnabled,
    lockScreenHeadsetTriggerEnabled,
    liteRtEnabled,
    refreshModels,
    startCapture,
    stopCapture,
    downloadModel,
    removeModel,
    selectModel,
    setCaptureSetting,
    queueJobs,
    currentThoughtId,
    isProcessing,
    queueClarification,
    removeQueuedThought,
    updateQueuedThought,
    resolveQueueClarification,
    queueInboxForSynthesis,
    dismissDeviceReadinessNotice,
    deleteRetainedAudioFromNote,
    retranscribeRetainedAudioFromNote,
    deleteUnsynthesizedNote,
    exportLibraryBackup,
    restoreLibraryBackup,
  } = useAppStore();
  const recentThreads = useMemo(() => selectRecentThreads(sections), [sections]);
  const noteSearchResults = useMemo(
    () => selectNoteSearchResults(sections, noteSearchQuery),
    [sections, noteSearchQuery],
  );
  const availableTopics = useMemo(
    () => sections.map(section => section.header).filter(header => header.trim().length > 0),
    [sections],
  );
  const queueJobsView = useMemo(
    () => selectQueueView(queueJobs, currentThoughtId, isProcessing, queueClarification?.thoughtId ?? null),
    [queueJobs, currentThoughtId, isProcessing, queueClarification],
  );
  const settingsView = useMemo(
    () =>
      selectSettingsViewModel({
        audioReadiness,
        liteRtEnabled,
        selectedModelInstalled,
        contextPath,
        sectionCount: sections.filter(section => section.header.trim().toLowerCase() !== 'inbox').length,
      }),
    [audioReadiness, liteRtEnabled, selectedModelInstalled, contextPath, sections],
  );

  useEffect(() => {
    if (!quickCaptureRequest) return;
    setRoute('reflections');
    setPrimaryRoute('reflections');
  }, [quickCaptureRequest]);

  useEffect(() => {
    if (!quickRecordRequest) return;
    setRoute('reflections');
    setPrimaryRoute('reflections');
    Keyboard.dismiss();
    startCapture();
  }, [quickRecordRequest, startCapture]);

  useEffect(() => {
    if (route !== 'settings') {
      return;
    }

    refreshModels().catch(error => {
      console.error('Failed to refresh models before opening settings:', error);
    });
  }, [refreshModels, route]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSubscription = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
      if (Platform.OS !== 'ios') setKeyboardVisible(true);
    });
    const didShowSubscription = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
      : null;
    const willHideSubscription = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0))
      : null;
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      didShowSubscription?.remove();
      willHideSubscription?.remove();
      hideSubscription.remove();
    };
  }, []);

  const backgroundQueueStatus = status.startsWith('Saved in Inbox. Android');
  const displayStatus =
    queueClarification
      ? 'Waiting for your topic choice'
      : backgroundQueueStatus && !isProcessing
        ? status
        : queueBlockedReason
          ? queueBlockedReason
          : queueSize > 0
            ? isProcessing
              ? `Organizing ${queueSize} note${queueSize === 1 ? '' : 's'}`
              : `Waiting to organize ${queueSize} note${queueSize === 1 ? '' : 's'}`
            : status || bootMessage;
  const canRecord = RELEASE_CAPABILITIES.voiceCapture && pushToRecordEnabled && audioReadiness.transcriptionReady;
  const selectedThread = useMemo(
    () => recentThreads.find(thread => thread.id === selectedThreadId) ?? null,
    [recentThreads, selectedThreadId],
  );
  const activeThreadTitle = selectedThread?.title ?? 'Topic';
  const activeModel = models.find(model => model.id === selectedModelId) ?? models[0];

  const threadDetailsView = useMemo(() => {
    if (!selectedThreadId) return null;
    const matchedSection = sections.find(section => {
      const thread = recentThreads.find(t => t.id === selectedThreadId);
      return thread ? thread.title === section.header : false;
    });
    return selectThreadDetailsView(matchedSection, selectedThreadId);
  }, [sections, selectedThreadId, recentThreads]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (previousRouteRef.current !== route) Keyboard.dismiss();
    previousRouteRef.current = route;
  }, [route]);

  const handleRouteChange = (nextRoute: PrimaryRoute) => {
    setPrimaryRoute(nextRoute);
    setRoute(nextRoute);
  };

  const handleKeyboardDone = () => {
    setKeyboardDismissRequest(request => request + 1);
    Keyboard.dismiss();
  };

  const handleOpenThread = (threadId: string, noteId?: string) => {
    setSelectedThreadId(threadId);
    setTargetNoteId(noteId ?? null);
    setRoute('threadDetails');
  };

  const handleBackFromThread = () => {
    setRoute(primaryRoute);
  };

  const handleCloseEditor = () => {
    if (editorState) {
      setRoute(editorState.returnRoute);
    }
    setEditorState(null);
  };

  const handleQueueInboxForSynthesis = () => {
    setRoute(primaryRoute);
    queueInboxForSynthesis().catch(error => {
      console.error('Failed to queue Inbox for synthesis:', error);
    });
  };

  const handleEditQueuedJob = (jobId: string) => {
    const job = queueJobsView.find(item => item.id === jobId);
    if (!job) {
      return;
    }

    setEditorState({
      mode: 'queue',
      returnRoute: 'queue',
      bodyLabel: 'Edit the note text',
      value: job.transcript,
      topic: job.selectedTopic ?? '',
      canEditTopic: true,
      metadataLines: [
        { label: 'Added', value: job.timestampLabel.replace(/^Queued/, 'Added') },
        { label: 'From', value: job.kind === 'voice' ? 'Voice note' : job.kind === 'image' ? 'Photo' : 'Typed note' },
      ],
      queueJobId: job.id,
    });
    setRoute('noteEditor');
  };

  const handleEditCapture = (captureId: string) => {
    if (!threadDetailsView) {
      return;
    }

    const capture = threadDetailsView.captures.find(item => item.id === captureId);
    if (!capture) {
      return;
    }

    setEditorState({
      mode: 'capture',
      returnRoute: 'threadDetails',
      bodyLabel: 'Edit the note text',
      value: capture.preview,
      topic: threadDetailsView.title,
      canEditTopic: false,
      metadataLines: [
        { label: 'Added', value: capture.timestampLabel },
        ...(capture.sourceTranscript ? [{ label: 'Words from recording', value: capture.sourceTranscript }] : []),
      ],
      sectionHeader: capture.sourceSectionHeader ?? threadDetailsView.title,
      noteId: capture.noteId,
      sourceKind: capture.icon === 'mic' ? 'voice' : capture.icon === 'image' ? 'image' : 'text',
      sourceTranscript: capture.sourceTranscript,
      originalSourceTranscript: capture.originalSourceTranscript,
      sourceAudioFilePath: capture.sourceMetadata?.audioFilePath ?? null,
    });
    setRoute('noteEditor');
  };

  const handleSaveEditor = async () => {
    if (!editorState) {
      return;
    }

    if (editorState.mode === 'queue') {
      const updated = updateQueuedThought(editorState.queueJobId, {
        transcript: editorState.value,
        selectedTopic: editorState.topic.trim() ? editorState.topic.trim() : null,
      });

      if (!updated) {
        return;
      }

      setRoute(editorState.returnRoute);
      setEditorState(null);
      return;
    }

    const sectionHeader = await ContextManager.updateThoughtAndResolveSection(editorState.sectionHeader, editorState.noteId, {
      text: editorState.value,
    });

    if (!sectionHeader) {
      return;
    }

    await useAppStore.getState().loadContext();

    const isInboxCapture = sectionHeader.trim().toLowerCase() === 'inbox';
    const selectedTopic = isInboxCapture ? null : sectionHeader;

    ProcessingQueueManager.addToQueue(
      editorState.value,
      editorState.sourceKind ?? 'text',
      {
        sectionHeader,
        thoughtText: editorState.value,
        noteId: editorState.noteId,
        sourceMetadata: {
          kind: editorState.sourceKind ?? 'text',
          transcript: editorState.originalSourceTranscript ?? editorState.sourceTranscript ?? editorState.value,
          noteId: editorState.noteId,
          sectionHeader,
          text: editorState.value,
          audioFilePath: editorState.sourceAudioFilePath ?? undefined,
        },
      },
      {
        noteId: editorState.noteId,
        selectedTopic,
      },
    );

    setRoute(editorState.returnRoute);
    setEditorState(null);
  };

  const handleShareThreadContext = () => {
    if (!threadDetailsView) {
      return;
    }

    shareThreadContext(threadDetailsView).catch(error => {
      console.error('Failed to share thread context:', error);
    });
  };

  const handleOpenThreadInAi = () => {
    if (!threadDetailsView) {
      return;
    }

    shareThreadWithAiPrompt(threadDetailsView).catch(error => {
      console.error('Failed to share thread with AI prompt:', error);
    });
  };

  const handlePlayCaptureAudio = (captureId: string) => {
    if (!threadDetailsView) {
      return;
    }

    const capture = threadDetailsView.captures.find(item => item.id === captureId);
    const audioFilePath = capture?.sourceMetadata?.audioFilePath;
    if (!audioFilePath) {
      return;
    }

    const url = audioFilePath.startsWith('file://') ? audioFilePath : `file://${audioFilePath}`;
    const { AudioPlayerModule } = NativeModules;
    if (AudioPlayerModule) {
      AudioPlayerModule.play(url)
        .then(() => {
          console.log('[AppShell] Native playback started successfully');
        })
        .catch((error: any) => {
          console.error('[AppShell] Native playback failed:', error);
        });
    } else {
      Linking.openURL(url).catch(error => {
        console.error('Failed to open retained audio file:', error);
      });
    }
  };

  const handleDeleteCaptureAudio = (captureId: string) => {
    if (!threadDetailsView) {
      return;
    }

    const capture = threadDetailsView.captures.find(item => item.id === captureId);
    const audioFilePath = capture?.sourceMetadata?.audioFilePath;
    if (!capture || !audioFilePath) {
      return;
    }

    Alert.alert(
      'Delete this recording?',
      'The note in Inbox will stay, but the original recording will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete recording',
          style: 'destructive',
          onPress: () => {
            deleteRetainedAudioFromNote({
              sectionHeader: capture.sourceSectionHeader ?? threadDetailsView.title,
              noteId: capture.noteId,
              thoughtText: capture.preview,
              audioFilePath,
              ...(capture.sourceMetadata?.transcriptionError
                ? { transcriptionError: capture.sourceMetadata.transcriptionError }
                : {}),
            }).catch(error => {
              console.error('Failed to delete retained audio:', error);
            });
          },
        },
      ],
    );
  };

  const handleTranscribeCapture = async (captureId: string) => {
    if (!threadDetailsView || threadDetailsView.title.trim().toLowerCase() !== 'inbox') {
      return;
    }

    const capture = threadDetailsView.captures.find(item => item.id === captureId);
    const audioFilePath = capture?.sourceMetadata?.audioFilePath;
    if (!capture || !capture.canDeleteRetainedAudio || !audioFilePath) {
      return;
    }

    try {
      await retranscribeRetainedAudioFromNote({
        sectionHeader: capture.sourceSectionHeader ?? threadDetailsView.title,
        noteId: capture.noteId,
        thoughtText: capture.preview,
        audioFilePath,
      });
    } catch (error) {
      console.error('Failed to retry transcription for retained audio:', error);
    }
  };

  const handleDeleteCapture = (captureId: string) => {
    if (!threadDetailsView || threadDetailsView.title.trim().toLowerCase() !== 'inbox') {
      return;
    }

    const capture = threadDetailsView.captures.find(item => item.id === captureId);
    if (!capture) {
      return;
    }

    const deletesOwnedAudio = capture.canDeleteRetainedAudio;
    Alert.alert(
      capture.icon === 'mic' ? 'Delete this voice note?' : 'Delete this note?',
      deletesOwnedAudio
        ? 'This deletes the note in Inbox and its recording. This cannot be undone.'
        : 'This deletes the note in Inbox. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete note',
          style: 'destructive',
          onPress: () => {
            deleteUnsynthesizedNote({
              sectionHeader: capture.sourceSectionHeader ?? threadDetailsView.title,
              noteId: capture.noteId,
              thoughtText: capture.preview,
              audioFilePath: capture.sourceMetadata?.audioFilePath ?? null,
            })
              .then(deleted => {
                if (!deleted) {
                  return;
                }

                const inboxStillExists = useAppStore.getState().sections.some(
                  section => section.header.trim().toLowerCase() === 'inbox',
                );
                if (!inboxStillExists) {
                  setSelectedThreadId(null);
                  setRoute(primaryRoute);
                }
              })
              .catch(error => {
                console.error('Failed to delete unsynthesized note:', error);
              });
          },
        },
      ],
    );
  };

  let mainContent: React.ReactNode;
  if (route === 'reflections') {
    mainContent = (
      <ReflectionsScreen
        threads={recentThreads}
        searchQuery={noteSearchQuery}
        searchResults={noteSearchResults}
        onSearchChange={setNoteSearchQuery}
        displayStatus={displayStatus}
        canRecord={canRecord}
        isRecording={isRecording}
        recordingState={recordingState}
        queueSize={queueSize}
        deviceReadiness={deviceReadiness}
        showDeviceReadinessNotice={deviceReadinessNoticeVisible}
        onDismissDeviceReadinessNotice={dismissDeviceReadinessNotice}
        isProcessing={isProcessing}
        liteRtEnabled={liteRtEnabled}
        selectedModelSizeBytes={activeModel?.sizeInBytes}
        selectedModelMinMemoryInGb={activeModel?.minDeviceMemoryInGb}
        selectedModelInstalled={selectedModelInstalled}
        selectedModelDownloading={selectedModelDownloading}
        selectedModelProgress={selectedModelProgress}
        onDownloadModel={() => {
          if (activeModel) {
            downloadModel(activeModel.id).catch(error => {
              console.error('Failed to download model from reflections:', error);
            });
          }
        }}
        onOpenModelInfo={() => {
          if (activeModel?.sourceUrl) {
            Linking.openURL(activeModel.sourceUrl).catch(error => {
              console.error('Failed to open model source URL:', error);
            });
          }
        }}
        onOpenCaptureSettings={() => handleRouteChange('settings')}
        onOpenQueue={() => handleRouteChange('queue')}
        onOpenThread={handleOpenThread}
      />
    );
  } else if (route === 'queue') {
    mainContent = (
      <QueueScreen
        jobs={queueJobsView}
        displayStatus={displayStatus}
        onEndJob={removeQueuedThought}
        onEditJob={handleEditQueuedJob}
        onResolveClarification={resolveQueueClarification}
      />
    );
  } else if (route === 'import') {
    mainContent = null;
  } else if (route === 'settings') {
    mainContent = (
      <SettingsScreen
        settingsView={settingsView}
        activeModel={activeModel}
        models={models}
        deviceReadiness={deviceReadiness}
        selectedModelDownloading={selectedModelDownloading}
        selectedModelError={selectedModelError}
        selectedModelId={selectedModelId}
        selectedModelInstalled={selectedModelInstalled}
        selectedModelProgress={selectedModelProgress}
        selectModel={selectModel}
        downloadModel={downloadModel}
        removeModel={removeModel}
        audioReadiness={audioReadiness}
        transcriptionProbeStatus={status}
        runTranscriptionProbe={runTranscriptionProbe}
        liteRtEnabled={liteRtEnabled}
        manualCaptureEnabled={manualCaptureEnabled}
        pushToRecordEnabled={pushToRecordEnabled}
        wakeWordEnabled={wakeWordEnabled}
        lockScreenHeadsetTriggerEnabled={lockScreenHeadsetTriggerEnabled}
        recordingState={recordingState}
        setCaptureSetting={setCaptureSetting}
        exportLibraryBackup={exportLibraryBackup}
        restoreLibraryBackup={restoreLibraryBackup}
      />
    );
  } else if (route === 'threadDetails') {
    mainContent = (
      <ThreadDetailsScreen
        threadDetails={threadDetailsView}
        targetNoteId={targetNoteId}
        onTargetLayout={y => scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: false })}
        onQueueInboxForSynthesis={handleQueueInboxForSynthesis}
        onOpenAgent={handleOpenThreadInAi}
        onEditCapture={handleEditCapture}
        onDeleteCapture={handleDeleteCapture}
        onPlayCaptureAudio={handlePlayCaptureAudio}
        onDeleteCaptureAudio={handleDeleteCaptureAudio}
        onTranscribeCapture={handleTranscribeCapture}
      />
    );
  } else {
    mainContent = (
      <NoteEditorScreen
        bodyLabel={editorState?.bodyLabel ?? 'Edit note'}
        value={editorState?.value ?? ''}
        topic={editorState?.topic ?? ''}
        availableTopics={availableTopics}
        canEditTopic={editorState?.canEditTopic ?? false}
        canSave={Boolean(editorState && editorState.value.trim())}
        metadataLines={editorState?.metadataLines ?? []}
        onChangeValue={nextValue => {
          setEditorState(current => (current ? { ...current, value: nextValue } : current));
        }}
        onChangeTopic={nextTopic => {
          setEditorState(current => (current && current.canEditTopic ? { ...current, topic: nextTopic } : current));
        }}
        onSave={() => {
          handleSaveEditor().catch(error => {
            console.error('Failed to save edited note:', error);
          });
        }}
        onCancel={handleCloseEditor}
      />
    );
  }

  return (
    <View style={styles.shell}>
      {route === 'queue' ? (
        <AppHeader
          variant="queue"
          title="Waiting"
          onMenuPress={() => {
            setRoute('reflections');
            setPrimaryRoute('reflections');
          }}
          onAccountPress={() => {
            setRoute('settings');
            setPrimaryRoute('settings');
          }}
        />
      ) : route === 'threadDetails' ? (
        <AppHeader
          variant="thread"
          title={activeThreadTitle}
          onBackPress={handleBackFromThread}
          onSharePress={handleShareThreadContext}
        />
      ) : route === 'noteEditor' ? (
        <AppHeader variant="brand" title="Edit note" subtitle={editorState?.mode === 'queue' ? 'Waiting note' : 'Saved note'} />
      ) : route === 'import' ? (
        <AppHeader
          variant="brand"
          title="Thought Notes"
          subtitle={RELEASE_CAPABILITIES.voiceImport ? "Text and voice notes" : "Add a note"}
          pillLabel="On this phone"
          keyboardVisible={keyboardVisible}
          onKeyboardDone={handleKeyboardDone}
        />
      ) : (
        <AppHeader
          variant="brand"
          title="Thought Notes"
          subtitle="Save and sort your notes"
          pillLabel="On this phone"
          keyboardVisible={keyboardVisible}
          onKeyboardDone={handleKeyboardDone}
        />
      )}

      <ScrollView
        ref={scrollRef}
        testID="context_scroll"
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          {
            paddingTop: insets.top + 64,
            paddingBottom:
              route === 'reflections'
                ? keyboardHeight > 0 ? keyboardHeight + spacing.xl : spacing.xl
                : insets.bottom + 90,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <View
          style={route === 'import' ? undefined : styles.hiddenRoute}
          accessibilityElementsHidden={route !== 'import'}
          importantForAccessibility={route === 'import' ? 'auto' : 'no-hide-descendants'}>
          <ImportScreen active={route === 'import'} keyboardDismissRequest={keyboardDismissRequest} />
        </View>
        {mainContent}
      </ScrollView>

      <View
        testID="composer_shell"
        accessibilityElementsHidden={route !== 'reflections'}
        importantForAccessibility={route === 'reflections' ? 'auto' : 'no-hide-descendants'}
        style={[
          styles.composerShell,
          route !== 'reflections' ? styles.hiddenRoute : null,
          keyboardHeight > 0
            ? [styles.composerFloating, { bottom: keyboardHeight + spacing.sm }]
            : styles.composerInline,
        ]}>
        <CaptureComposerContainer
          focusRequest={quickCaptureRequest}
          keyboardDismissRequest={keyboardDismissRequest}
        />
      </View>

      {recordingState === 'recording' && route !== 'reflections' ? (
        <View testID="active_recording_controls" style={styles.activeRecordingControls}>
          <RecordingIndicator recordingState={recordingState} message={status} />
          <Button
            label="Stop recording"
            onPress={() => { stopCapture().catch(error => console.error('Failed to stop voice note:', error)); }}
            testID="active_recording_stop"
            variant="secondary"
          />
        </View>
      ) : null}

      {route !== 'noteEditor' ? (
        <SafeAreaView edges={['bottom']} style={styles.bottomNavSafeArea}>
          <BottomNav activeRoute={primaryRoute} onChangeRoute={handleRouteChange} />
        </SafeAreaView>
      ) : null}
    </View>
  );
}



const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hiddenRoute: {
    display: 'none',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.lg,
  },
  reflectionsContent: {
  },
  sectionStack: {
    gap: spacing.sm,
  },
  composerShell: {
    zIndex: 40,
  },
  composerInline: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  composerFloating: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  activeRecordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  bottomNavSafeArea: {
    backgroundColor: colors.background,
  },
});
