import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsScreen } from '../screens/SettingsScreen';
import { useAppStore } from '../core/store';
import { Card } from '../shared/components/Card';
import { Pill } from '../shared/components/Pill';
import { SectionHeader } from '../shared/components/SectionHeader';
import { AppHeader } from '../shared/components/AppHeader';
import { BottomNav } from '../shared/components/BottomNav';
import { colors } from '../shared/design/colors';
import { radius } from '../shared/design/radius';
import { spacing } from '../shared/design/spacing';
import { typography } from '../shared/design/typography';
import { CaptureComposerContainer } from '../features/capture/CaptureComposerContainer';
import { ReflectionsScreen } from '../features/reflections/ReflectionsScreen';
import { selectRecentThreads } from '../features/reflections/reflectionsSelectors';
import { formatSectionPreview } from '../ui/design';
import type { AppRoute, PrimaryRoute } from './navigation';

export function AppShell({
  bootMessage,
  contextPath,
}: {
  bootMessage: string;
  contextPath: string;
}) {
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
  } = useAppStore();
  const recentThreads = useMemo(() => selectRecentThreads(sections), [sections]);

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
        contentContainerStyle={[styles.contentInner, route === 'reflections' ? styles.reflectionsContent : null]}
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
          <QueueScreen displayStatus={displayStatus} queueSize={queueSize} />
        ) : route === 'settings' ? (
          <SettingsScreen
            activeModel={models.find(model => model.id === selectedModelId) ?? models[0]}
            models={models}
            sections={sections}
            bootMessage={bootMessage}
            contextPath={contextPath}
            displayStatus={displayStatus}
            isRecording={isRecording}
            selectedModelDownloading={selectedModelDownloading}
            selectedModelError={selectedModelError}
            selectedModelId={selectedModelId}
            selectedModelInstalled={selectedModelInstalled}
            selectedModelProgress={selectedModelProgress}
            liteRtEnabled={liteRtEnabled}
            manualCaptureEnabled={manualCaptureEnabled}
            pushToRecordEnabled={pushToRecordEnabled}
            wakeWordEnabled={wakeWordEnabled}
            audioReadiness={audioReadiness}
            setCaptureSetting={setCaptureSetting}
            selectModel={selectModel}
            downloadModel={downloadModel}
            removeModel={removeModel}
          />
        ) : (
          <ThreadDetailsScreen threadTitle={activeThreadTitle} threadContent={selectedThread?.sourceContent ?? selectedThread?.preview ?? ''} />
        )}
      </ScrollView>

      {route === 'reflections' ? (
        <View style={styles.composerShell}>
          <CaptureComposerContainer />
        </View>
      ) : null}

      <SafeAreaView edges={['bottom']} style={styles.bottomNavSafeArea}>
        <BottomNav activeRoute={primaryRoute} onChangeRoute={handleRouteChange} />
      </SafeAreaView>
    </View>
  );
}

function QueueScreen({
  displayStatus,
  queueSize,
}: {
  displayStatus: string;
  queueSize: number;
}) {
  return (
    <View style={styles.sectionStack}>
      <Card variant="default" style={styles.queueCard}>
        <View style={styles.queueCardTop}>
          <View style={styles.queueCardTitleBlock}>
            <Text style={styles.queueCardLabel}>Active job</Text>
            <Text style={styles.queueCardTitle}>{queueSize > 0 ? 'Synthesizing local thought' : 'Queue clear'}</Text>
            <Text style={styles.queueCardCopy}>{displayStatus}</Text>
          </View>
          <Pill label={queueSize > 0 ? `${queueSize} pending` : 'Idle'} variant={queueSize > 0 ? 'progress' : 'installed'} />
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, queueSize > 0 ? styles.progressFillActive : null]} />
        </View>
      </Card>

      <View style={styles.sectionStack}>
        <SectionHeader title="Pending" />
        <Card variant="inset" style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>{queueSize > 0 ? 'Queued thoughts will resolve in order.' : 'No thoughts waiting right now.'}</Text>
          <Text style={styles.pendingCopy}>
            {queueSize > 0
              ? 'Detailed queue metadata lands in the next phase once the queue manager exposes item snapshots.'
              : 'New captures will appear here as they are stored for synthesis.'}
          </Text>
        </Card>
      </View>
    </View>
  );
}

function ThreadDetailsScreen({
  threadTitle,
  threadContent,
}: {
  threadTitle: string;
  threadContent: string;
}) {
  return (
    <View style={styles.sectionStack}>
      <Card variant="default" style={styles.threadSummaryCard}>
        <Text style={styles.threadSummaryLabel}>Summary</Text>
        <Text style={styles.threadSummaryTitle}>{threadTitle}</Text>
        <Text style={styles.threadSummaryCopy}>
          {threadContent ? formatSectionPreview(threadContent) : 'No thread selected yet.'}
        </Text>
      </Card>

      <View style={styles.sectionStack}>
        <SectionHeader title="Source captures" />
        <Card variant="inset" style={styles.sourceCard}>
          {threadContent ? (
            <Text style={styles.sourceCopy}>{threadContent}</Text>
          ) : (
            <Text style={styles.sourceCopy}>Open a recent thread from Reflections to inspect its source notes.</Text>
          )}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: 300,
    gap: spacing.lg,
  },
  reflectionsContent: {
    paddingTop: 0,
  },
  sectionStack: {
    gap: spacing.sm,
  },
  composerShell: {
    paddingTop: spacing.sm,
  },
  bottomNavSafeArea: {
    backgroundColor: colors.background,
  },
  queueCard: {
    gap: spacing.md,
    borderRadius: radius.xxl,
  },
  queueCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  queueCardTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  queueCardLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  queueCardTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  queueCardCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  progressFill: {
    width: '32%',
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  progressFillActive: {
    backgroundColor: colors.primaryContainer,
  },
  pendingCard: {
    gap: spacing.xs,
  },
  pendingTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  pendingCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  threadSummaryCard: {
    gap: spacing.xs,
  },
  threadSummaryLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  threadSummaryTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  threadSummaryCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  sourceCard: {
    gap: spacing.xs,
  },
  sourceCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
});
