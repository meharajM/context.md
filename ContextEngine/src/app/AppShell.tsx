import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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

  const {
    sections,
    isRecording,
    status,
    queueSize,
    models,
    selectedModelId,
    selectedModelInstalled,
    selectedModelDownloading,
    selectedModelProgress,
    selectedModelError,
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

  const displayStatus =
    queueSize > 0 ? `Processing ${queueSize} thought${queueSize === 1 ? '' : 's'}` : status || bootMessage;
  const canRecord = pushToRecordEnabled && audioReadiness.transcriptionReady;
  const selectedThread = useMemo(
    () => recentThreads.find(thread => thread.id === selectedThreadId) ?? null,
    [recentThreads, selectedThreadId],
  );
  const activeThreadTitle = selectedThread?.title ?? 'Thread';

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
          onSharePress={() => {
            console.log('Share thread action not wired yet.');
          }}
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
            onOpenThread={handleOpenThread}
            onViewAll={() => {
              console.log('View all recent threads not wired yet.');
            }}
          />
        ) : route === 'queue' ? (
          <QueueScreen jobs={queueJobsView} displayStatus={displayStatus} />
        ) : route === 'settings' ? (
          <SettingsScreen
            settingsView={settingsView}
            activeModel={models.find(model => model.id === selectedModelId) ?? models[0]}
            models={models}
            selectedModelDownloading={selectedModelDownloading}
            selectedModelError={selectedModelError}
            selectedModelId={selectedModelId}
            selectedModelInstalled={selectedModelInstalled}
            selectedModelProgress={selectedModelProgress}
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
            onOpenAgent={() => console.log('Open with AI Agent pressed')}
            onShareContext={() => console.log('Share Context pressed')}
          />
        )}
      </ScrollView>

      {route === 'reflections' ? (
        <View style={[styles.composerShell, { bottom: insets.bottom + 76 }]}>
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
