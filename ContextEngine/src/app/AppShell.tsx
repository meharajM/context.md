import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '../core/store';
import { AppHeader } from '../shared/components/AppHeader';
import { BottomNav } from '../shared/components/BottomNav';
import { colors } from '../shared/design/colors';
import { spacing } from '../shared/design/spacing';
import { CaptureComposerContainer } from '../features/capture/CaptureComposerContainer';
import { ReflectionsScreen } from '../features/reflections/ReflectionsScreen';
import { selectRecentThreads } from '../features/reflections/reflectionsSelectors';
import { QueueScreen } from '../features/queue/QueueScreen';
import { selectQueueView } from '../features/queue/queueSelectors';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { selectSettingsViewModel } from '../features/settings/settingsSelectors';
import { ThreadDetailsScreen } from '../features/threads/ThreadDetailsScreen';
import { selectThreadDetailsView } from '../features/threads/threadSelectors';
import type { AppRoute, PrimaryRoute } from './navigation';
import { shareThreadContext, shareThreadWithAiPrompt } from '../shared/utils/share';

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
    removeQueuedThought,
    queueInboxForSynthesis,
  } = useAppStore();
  const recentThreads = useMemo(() => selectRecentThreads(sections), [sections]);
  const queueJobsView = useMemo(
    () => selectQueueView(queueJobs, currentThoughtId, isProcessing),
    [queueJobs, currentThoughtId, isProcessing],
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
    queueSize > 0 ? `Processing ${queueSize} thought${queueSize === 1 ? '' : 's'}` : status || bootMessage;
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

  const handleQueueInboxForSynthesis = () => {
    queueInboxForSynthesis().catch(error => {
      console.error('Failed to queue Inbox for synthesis:', error);
    });
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

  return (
    <View style={styles.shell}>
      {/* Ambient background decoration orbs for visual depth */}
      <View style={styles.ambientOrb1} pointerEvents="none" />
      <View style={styles.ambientOrb2} pointerEvents="none" />

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
      ) : (
        <AppHeader
          variant="brand"
          title="Context Engine"
          subtitle={route === 'settings' ? 'Settings' : 'Local memory engine'}
          pillLabel="Local"
        />
      )}

      <ScrollView
        testID="context_scroll"
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          {
            paddingTop: insets.top + 64,
            paddingBottom: route === 'reflections' ? insets.bottom + 150 : insets.bottom + 90,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        {route === 'reflections' ? (
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
            onOpenThread={handleOpenThread}
            onViewAll={() => {
              console.log('View all recent threads not wired yet.');
            }}
          />
        ) : route === 'queue' ? (
          <QueueScreen jobs={queueJobsView} displayStatus={displayStatus} onEndJob={removeQueuedThought} />
        ) : route === 'settings' ? (
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
        ) : (
          <ThreadDetailsScreen
            threadDetails={threadDetailsView}
            onQueueInboxForSynthesis={handleQueueInboxForSynthesis}
            onOpenAgent={handleOpenThreadInAi}
            onShareContext={handleShareThreadContext}
          />
        )}
      </ScrollView>

      {route === 'reflections' ? (
        <View testID="composer_shell" style={[styles.composerShell, { bottom: composerBottom }]}>
          <CaptureComposerContainer />
        </View>
      ) : null}

      <SafeAreaView edges={['bottom']} style={styles.bottomNavSafeArea}>
        <BottomNav activeRoute={primaryRoute} onChangeRoute={handleRouteChange} />
      </SafeAreaView>
    </View>
  );
}



const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  ambientOrb1: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(205, 230, 244, 0.3)',
    zIndex: -1,
  },
  ambientOrb2: {
    position: 'absolute',
    bottom: 120,
    right: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(221, 227, 235, 0.45)',
    zIndex: -1,
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
