import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Linking, NativeModules, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '../core/store';
import { AppHeader } from '../shared/components/AppHeader';
import { BottomNav } from '../shared/components/BottomNav';
import { colors } from '../shared/design/colors';
import { spacing } from '../shared/design/spacing';
import { CaptureComposerContainer } from '../features/capture/CaptureComposerContainer';
import { ImportScreen } from '../features/import/ImportScreen';
import { ReflectionsScreen } from '../features/reflections/ReflectionsScreen';
import { selectRecentThreads } from '../features/reflections/reflectionsSelectors';
import { QueueScreen } from '../features/queue/QueueScreen';
import { selectQueueView } from '../features/queue/queueSelectors';
import { NoteEditorScreen, type NoteEditorMetadataLine } from '../features/noteEditor/NoteEditorScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { selectSettingsViewModel } from '../features/settings/settingsSelectors';
import { ThreadDetailsScreen } from '../features/threads/ThreadDetailsScreen';
import { selectThreadDetailsView } from '../features/threads/threadSelectors';
import { ContextManager } from '../modules/ContextManager';
import { ProcessingQueueManager } from '../modules/SynthesisEngine/ProcessingQueueManager';
import type { AppRoute, PrimaryRoute } from './navigation';
import { shareThreadContext, shareThreadWithAiPrompt } from '../shared/utils/share';

type NoteEditorState =
  | {
      mode: 'queue';
      returnRoute: Exclude<AppRoute, 'noteEditor'>;
      title: string;
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
      title: string;
      bodyLabel: string;
      value: string;
      topic: string;
      canEditTopic: boolean;
      metadataLines: NoteEditorMetadataLine[];
      sectionHeader: string;
      noteId: string;
      sourceKind?: 'voice' | 'text' | 'image';
      sourceTranscript?: string;
      sourceAudioFilePath?: string | null;
    };

export function AppShell({
  bootMessage,
  contextPath,
}: {
  bootMessage: string;
  contextPath: string;
}) {
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<AppRoute>('reflections');
  const [primaryRoute, setPrimaryRoute] = useState<PrimaryRoute>('reflections');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<NoteEditorState | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const {
    sections,
    isRecording,
    recordingState,
    status,
    queueSize,
    models,
    selectedModelId,
    selectedModelInstalled,
    selectedModelDownloading,
    selectedModelProgress,
    selectedModelError,
    selectedModelStatusMessage,
    audioReadiness,
    manualCaptureEnabled,
    pushToRecordEnabled,
    wakeWordEnabled,
    liteRtEnabled,
    refreshModels,
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
    deleteRetainedAudioFromNote,
    deleteUnsynthesizedNote,
  } = useAppStore();
  const recentThreads = useMemo(() => selectRecentThreads(sections), [sections]);
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
        sectionCount: sections.length,
      }),
    [audioReadiness, liteRtEnabled, selectedModelInstalled, contextPath, sections.length],
  );

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
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const displayStatus =
    queueClarification
      ? 'Waiting for your topic choice'
      : queueSize > 0
        ? `Processing ${queueSize} thought${queueSize === 1 ? '' : 's'}`
        : status || bootMessage;
  const canRecord = pushToRecordEnabled && audioReadiness.transcriptionReady;
  const selectedThread = useMemo(
    () => recentThreads.find(thread => thread.id === selectedThreadId) ?? null,
    [recentThreads, selectedThreadId],
  );
  const activeThreadTitle = selectedThread?.title ?? 'Thread';
  const composerBottom = keyboardHeight > 0 ? keyboardHeight + spacing.sm : insets.bottom + 76;
  const activeModel = models.find(model => model.id === selectedModelId) ?? models[0];

  const threadDetailsView = useMemo(() => {
    if (!selectedThreadId) return null;
    const matchedSection = sections.find(section => {
      const thread = recentThreads.find(t => t.id === selectedThreadId);
      return thread ? thread.title === section.header : false;
    });
    return selectThreadDetailsView(matchedSection, selectedThreadId);
  }, [sections, selectedThreadId, recentThreads]);

  const handleRouteChange = (nextRoute: PrimaryRoute) => {
    setPrimaryRoute(nextRoute);
    setRoute(nextRoute);
  };

  const handleOpenThread = (threadId: string) => {
    setSelectedThreadId(threadId);
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
      title: 'Edit queued note',
      bodyLabel: 'Type the queued note text',
      value: job.transcript,
      topic: job.selectedTopic ?? '',
      canEditTopic: true,
      metadataLines: [
        { label: 'Queued at', value: job.timestampLabel },
        { label: 'Source kind', value: job.kind === 'voice' ? 'Voice' : job.kind === 'image' ? 'Image' : 'Text' },
        { label: 'Queue note id', value: job.noteId },
        ...(job.sourceMetadata?.audioFilePath ? [{ label: 'Audio file', value: job.sourceMetadata.audioFilePath }] : []),
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
      title: 'Edit capture note',
      bodyLabel: 'Edit the persisted note text',
      value: capture.preview,
      topic: threadDetailsView.title,
      canEditTopic: false,
      metadataLines: [
        { label: 'Capture note id', value: capture.noteId },
        { label: 'Source thread', value: capture.sourceSectionHeader ?? threadDetailsView.title },
        { label: 'Source note id', value: capture.sourceNoteId ?? 'Unavailable' },
        { label: 'Created', value: capture.createdAt ?? 'Unavailable' },
        { label: 'Updated', value: capture.updatedAt ?? 'Unavailable' },
        { label: 'Transcript', value: capture.sourceTranscript ?? 'Unavailable' },
        ...(capture.sourceMetadata?.audioFilePath
          ? [{ label: 'Audio file', value: capture.sourceMetadata.audioFilePath }]
          : []),
      ],
      sectionHeader: capture.sourceSectionHeader ?? threadDetailsView.title,
      noteId: capture.noteId,
      sourceKind: capture.icon === 'mic' ? 'voice' : capture.icon === 'image' ? 'image' : 'text',
      sourceTranscript: capture.sourceTranscript,
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

    const updated = await ContextManager.updateThought(editorState.sectionHeader, editorState.noteId, {
      text: editorState.value,
    });

    if (!updated) {
      return;
    }

    await useAppStore.getState().loadContext();

    const isInboxCapture = editorState.sectionHeader.trim().toLowerCase() === 'inbox';
    const selectedTopic = isInboxCapture ? null : editorState.topic.trim() || editorState.sectionHeader;

    ProcessingQueueManager.addToQueue(
      editorState.value,
      editorState.sourceKind ?? 'text',
      {
        sectionHeader: editorState.sectionHeader,
        thoughtText: editorState.value,
        noteId: editorState.noteId,
        sourceMetadata: {
          kind: editorState.sourceKind ?? 'text',
          transcript: editorState.sourceTranscript ?? editorState.value,
          noteId: editorState.noteId,
          sectionHeader: editorState.sectionHeader,
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
      'Delete retained audio?',
      'The unsynthesized Inbox note will remain, but its original retained recording will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete audio',
          style: 'destructive',
          onPress: () => {
            deleteRetainedAudioFromNote({
              sectionHeader: capture.sourceSectionHeader ?? threadDetailsView.title,
              noteId: capture.noteId,
              thoughtText: capture.preview,
              audioFilePath,
            }).catch(error => {
              console.error('Failed to delete retained audio:', error);
            });
          },
        },
      ],
    );
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
      capture.icon === 'mic' ? 'Delete unsynthesized voice note?' : 'Delete unsynthesized note?',
      deletesOwnedAudio
        ? 'This permanently removes the Inbox note and its retained recording. This cannot be undone.'
        : 'This permanently removes the Inbox note. This cannot be undone.',
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
        displayStatus={displayStatus}
        canRecord={canRecord}
        isRecording={isRecording}
        recordingState={recordingState}
        queueSize={queueSize}
        isProcessing={isProcessing}
        liteRtEnabled={liteRtEnabled}
        selectedModelName={activeModel?.name}
        selectedModelInstalled={selectedModelInstalled}
        selectedModelDownloading={selectedModelDownloading}
        selectedModelProgress={selectedModelProgress}
        selectedModelStatusMessage={selectedModelStatusMessage}
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
        onOpenThread={handleOpenThread}
        onViewAll={() => {
          console.log('View all recent threads not wired yet.');
        }}
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
    mainContent = <ImportScreen />;
  } else if (route === 'settings') {
    mainContent = (
      <SettingsScreen
        settingsView={settingsView}
        activeModel={activeModel}
        models={models}
        selectedModelDownloading={selectedModelDownloading}
        selectedModelError={selectedModelError}
        selectedModelId={selectedModelId}
        selectedModelInstalled={selectedModelInstalled}
        selectedModelProgress={selectedModelProgress}
        selectedModelStatusMessage={selectedModelStatusMessage}
        selectModel={selectModel}
        downloadModel={downloadModel}
        removeModel={removeModel}
        audioReadiness={audioReadiness}
        liteRtEnabled={liteRtEnabled}
        manualCaptureEnabled={manualCaptureEnabled}
        pushToRecordEnabled={pushToRecordEnabled}
        wakeWordEnabled={wakeWordEnabled}
        setCaptureSetting={setCaptureSetting}
      />
    );
  } else if (route === 'threadDetails') {
    mainContent = (
      <ThreadDetailsScreen
        threadDetails={threadDetailsView}
        onQueueInboxForSynthesis={handleQueueInboxForSynthesis}
        onOpenAgent={handleOpenThreadInAi}
        onShareContext={handleShareThreadContext}
        onEditCapture={handleEditCapture}
        onDeleteCapture={handleDeleteCapture}
        onPlayCaptureAudio={handlePlayCaptureAudio}
        onDeleteCaptureAudio={handleDeleteCaptureAudio}
      />
    );
  } else {
    mainContent = (
      <NoteEditorScreen
        title={editorState?.title ?? 'Edit note'}
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
          title="Queue"
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
        <AppHeader variant="brand" title="Edit note" subtitle={editorState?.mode === 'queue' ? 'Queued item' : 'Persisted note'} pillLabel="Draft" />
      ) : route === 'import' ? (
        <AppHeader variant="brand" title="Import" subtitle="Text and voice" pillLabel="Local" />
      ) : (
        <AppHeader
          variant="brand"
          title="Context Engine"
          subtitle={route === 'settings' ? 'Settings' : 'Local memory engine'}
          pillLabel="Local"
        />
      )}

      <ScrollView
        key={route}
        testID="context_scroll"
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          {
            paddingTop: insets.top + 64,
            paddingBottom: route === 'reflections' ? insets.bottom + 220 : insets.bottom + 90,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        {mainContent}
      </ScrollView>

      {route === 'reflections' ? (
        <View testID="composer_shell" style={[styles.composerShell, { bottom: composerBottom }]}>
          <CaptureComposerContainer />
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
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
  },
  bottomNavSafeArea: {
    backgroundColor: colors.background,
  },
});
