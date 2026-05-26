import React, { useEffect, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNFS from 'react-native-fs';

import { CaptureComposer } from './src/components/CaptureComposer';
import { BrandMark } from './src/components/BrandMark';
import { ScreenTabs } from './src/components/ScreenTabs';
import { useAppStore } from './src/core/store';
import { ContextManager } from './src/modules/ContextManager';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { palette, type AppScreen } from './src/ui/design';

const CONTEXT_PATH = `${RNFS.DocumentDirectoryPath}/context.md`;

function App(): React.JSX.Element {
  const [newThought, setNewThought] = useState('');
  const [bootMessage, setBootMessage] = useState('Preparing local context');
  const [activeScreen, setActiveScreen] = useState<AppScreen>('home');

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
    loadContext,
    addThought,
    startCapture,
    stopCapture,
    initializeEngine,
    refreshModels,
    downloadModel,
    removeModel,
    selectModel,
    setAppLifecycleState,
    setCaptureSetting,
  } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      ContextManager.setPath(CONTEXT_PATH);
      await loadContext();

      try {
        await initializeEngine();
        if (isMounted) {
          setBootMessage('Ready for local capture');
        }
      } catch {
        if (isMounted) {
          setBootMessage('Capture works; AI runtime unavailable');
        }
      }
    };

    boot();

    return () => {
      isMounted = false;
    };
  }, [initializeEngine, loadContext]);

  useEffect(() => {
    if (activeScreen !== 'settings') {
      return;
    }

    refreshModels().catch(error => {
      console.error('Failed to refresh models before opening settings:', error);
    });
  }, [activeScreen, refreshModels]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      setAppLifecycleState(nextState).catch(error => {
        console.error('Failed to sync app lifecycle state:', error);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [setAppLifecycleState]);

  const displayStatus =
    queueSize > 0 ? `Processing ${queueSize} thought${queueSize === 1 ? '' : 's'}` : status || bootMessage;
  const activeModel = models.find(model => model.id === selectedModelId) ?? models[0];
  const visibleScreen: AppScreen = activeScreen;
  const canRecord = pushToRecordEnabled && audioReadiness.transcriptionReady;
  const headerMeta =
    queueSize > 0 ? `Queue ${queueSize} · ${canRecord ? 'Voice ready' : 'Voice locked'}` : `Queue clear · ${canRecord ? 'Voice ready' : 'Voice locked'}`;

  const handleManualSave = async () => {
    const text = newThought.trim();
    if (!manualCaptureEnabled || !text) {
      return;
    }

    await addThought(text);
    setNewThought('');
  };

  const handleToggleRecording = async () => {
    if (!pushToRecordEnabled || !audioReadiness.transcriptionReady) {
      return;
    }

    if (isRecording) {
      await stopCapture();
      return;
    }

    await startCapture();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.shell}>
          <View style={[styles.header, { backgroundColor: palette.panel, borderBottomColor: palette.border }]}>
            <View style={styles.headerTopRow}>
              <View style={styles.brandBlock}>
                <BrandMark />
                <View style={styles.brandCopy}>
                  <Text testID="app_title" style={[styles.brandTitle, { color: palette.text }]}>
                    Context Engine
                  </Text>
                  <Text style={[styles.eyebrow, { color: palette.accent }]}>LOCAL MEMORY ENGINE</Text>
                </View>
              </View>
              <View style={[styles.statusPill, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Text style={[styles.statusLabel, { color: palette.muted }]}>Status</Text>
                <Text
                  testID="status_badge"
                  style={[styles.statusValue, { color: isRecording ? palette.danger : palette.text }]}>
                  {isRecording ? 'Recording' : displayStatus}
                </Text>
              </View>
            </View>
            <Text style={[styles.title, { color: palette.text }]}>Capture what should not be lost.</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Typed notes, push-to-record, and foreground wake word route into one local context file.
            </Text>
            <Text style={[styles.headerMeta, { color: palette.muted }]}>{headerMeta}</Text>
            <ScreenTabs activeScreen={visibleScreen} onHome={() => setActiveScreen('home')} onSettings={() => setActiveScreen('settings')} />
            <View style={[styles.headerDivider, { backgroundColor: palette.border }]} />
          </View>

          <ScrollView testID="context_scroll" style={styles.content} contentContainerStyle={styles.contentInner}>
            {visibleScreen === 'settings' ? (
              <SettingsScreen
                activeModel={activeModel}
                models={models}
                sections={sections}
                bootMessage={bootMessage}
                contextPath={CONTEXT_PATH}
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
              <HomeScreen
                displayStatus={displayStatus}
                canRecord={canRecord}
                isRecording={isRecording}
                sections={sections}
              />
            )}
          </ScrollView>

          {visibleScreen !== 'settings' ? (
            <CaptureComposer
              isRecording={isRecording}
              manualCaptureEnabled={manualCaptureEnabled}
              newThought={newThought}
              onChangeThought={setNewThought}
              onRecordPress={handleToggleRecording}
              onSavePress={handleManualSave}
              pushToRecordEnabled={canRecord}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  shell: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandBlock: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  brandCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  title: {
    marginTop: 14,
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 20,
  },
  headerMeta: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    maxWidth: 150,
  },
  statusLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusValue: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  headerDivider: {
    height: 1,
    marginTop: 14,
    opacity: 0.8,
  },
});

export default App;
