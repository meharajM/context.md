import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNFS from 'react-native-fs';

import { useAppStore } from './src/core/store';
import { ContextManager } from './src/modules/ContextManager';
import { requestAudioPermissions } from './src/shared/utils/permissions';

const CONTEXT_PATH = `${RNFS.DocumentDirectoryPath}/context.md`;
type AppScreen = 'welcome' | 'home' | 'settings';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [newThought, setNewThought] = useState('');
  const [bootMessage, setBootMessage] = useState('Preparing local context');
  const [activeScreen, setActiveScreen] = useState<AppScreen>('welcome');

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
    downloadModel,
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
    if (sections.length > 0 && activeScreen === 'welcome') {
      setActiveScreen('home');
    }
  }, [activeScreen, sections.length]);

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

  const palette = useMemo(
    () => ({
      background: isDarkMode ? '#111111' : '#F4F1EA',
      panel: isDarkMode ? '#1B1B1B' : '#FFFCF4',
      panelAlt: isDarkMode ? '#242424' : '#ECE6D8',
      text: isDarkMode ? '#F6F1E8' : '#171717',
      muted: isDarkMode ? '#B9B1A5' : '#6C665C',
      border: isDarkMode ? '#37322D' : '#D9D0BF',
      accent: '#0F766E',
      accentWash: isDarkMode ? '#163A36' : '#DCEFEB',
      accentText: '#FFFFFF',
      danger: '#B42318',
      disabled: isDarkMode ? '#363636' : '#D8D0C1',
    }),
    [isDarkMode],
  );

  const displayStatus =
    queueSize > 0 ? `Processing ${queueSize} thought${queueSize === 1 ? '' : 's'}` : status || bootMessage;
  const activeModel = models.find(model => model.id === selectedModelId) ?? models[0];
  const hasContext = sections.length > 0;
  const visibleScreen: AppScreen = activeScreen;
  const canRecord = pushToRecordEnabled && audioReadiness.transcriptionReady;

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

    const hasPermission = await requestAudioPermissions();
    if (!hasPermission) {
      Alert.alert('Microphone access needed', 'Enable microphone access to use push-to-record capture.');
      return;
    }

    await startCapture();
  };

  const openHome = () => setActiveScreen('home');
  const openSettings = () => setActiveScreen('settings');
  const openWelcome = () => setActiveScreen('welcome');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.brandBlock}>
            <BrandMark palette={palette} />
            <View style={styles.brandCopy}>
              <Text testID="app_title" style={[styles.brandTitle, { color: palette.text }]}>
                Context Engine
              </Text>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>LOCAL MEMORY ENGINE</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: palette.panel, borderColor: palette.border }]}>
            <Text style={[styles.statusLabel, { color: palette.muted }]}>Status</Text>
            <Text testID="status_badge" style={[styles.statusValue, { color: isRecording ? palette.danger : palette.text }]}>
              {isRecording ? 'Recording' : displayStatus}
            </Text>
          </View>
        </View>
        <Text style={[styles.title, { color: palette.text }]}>Capture what should not be lost.</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Typed notes, push-to-record, and foreground wake word route into one local context file.
        </Text>
        <ScreenTabs
          activeScreen={visibleScreen}
          hasContext={hasContext}
          palette={palette}
          onHome={openHome}
          onSettings={openSettings}
          onWelcome={openWelcome}
        />
      </View>

      <ScrollView testID="context_scroll" style={styles.content} contentContainerStyle={styles.contentInner}>
        {visibleScreen === 'settings' ? (
          <SettingsScreen
            activeModel={activeModel}
            models={models}
            palette={palette}
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
            onHomePress={openHome}
            onWelcomePress={openWelcome}
          />
        ) : visibleScreen === 'home' ? (
          <HomeScreen
            activeModel={activeModel}
            bootMessage={bootMessage}
            contextPath={CONTEXT_PATH}
            displayStatus={displayStatus}
            models={models}
            palette={palette}
            queueSize={queueSize}
            sections={sections}
            selectedModelDownloading={selectedModelDownloading}
            selectedModelError={selectedModelError}
            selectedModelId={selectedModelId}
            selectedModelInstalled={selectedModelInstalled}
            selectedModelProgress={selectedModelProgress}
            onOpenSettings={openSettings}
          />
        ) : (
          <WelcomeScreen
            activeModel={activeModel}
            bootMessage={bootMessage}
            canRecord={canRecord}
            contextPath={CONTEXT_PATH}
            displayStatus={displayStatus}
            onHomePress={openHome}
            onOpenSettings={openSettings}
            palette={palette}
            sections={sections}
            selectedModelDownloading={selectedModelDownloading}
            selectedModelError={selectedModelError}
            selectedModelId={selectedModelId}
            selectedModelInstalled={selectedModelInstalled}
            selectedModelProgress={selectedModelProgress}
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
          palette={palette}
          pushToRecordEnabled={canRecord}
        />
      ) : null}
    </SafeAreaView>
  );
}

interface ModeTileProps {
  label: string;
  value: boolean;
  onPress: () => void;
  disabled?: boolean;
  palette: {
    text: string;
    muted: string;
    accent: string;
    accentWash: string;
    panelAlt: string;
    border: string;
    disabled: string;
  };
}

function ModeTile({ label, value, onPress, palette, disabled = false }: ModeTileProps) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.modeTile,
        {
          backgroundColor: disabled ? palette.disabled : value ? palette.accentWash : palette.panelAlt,
          borderColor: disabled ? palette.border : value ? palette.accent : palette.border,
        },
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.modeLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.modeState, { color: disabled ? palette.muted : value ? palette.accent : palette.muted }]}>
        {disabled ? 'Unavailable' : value ? 'On' : 'Off'}
      </Text>
    </TouchableOpacity>
  );
}

interface BrandMarkProps {
  palette: {
    background: string;
    panel: string;
    panelAlt: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    accentWash: string;
    accentText: string;
    danger: string;
    disabled: string;
  };
}

function BrandMark({ palette }: BrandMarkProps) {
  return (
    <View
      accessibilityLabel="Context Engine logo"
      accessibilityRole="image"
      style={[styles.brandMark, { backgroundColor: palette.panel, borderColor: palette.border }]}>
      <View style={[styles.brandMarkCore, { backgroundColor: palette.accent }]}>
        <View style={[styles.brandMarkPage, { backgroundColor: palette.accentWash }]}>
          <View style={[styles.brandMarkLine, { backgroundColor: palette.accent }]} />
          <View style={[styles.brandMarkLineShort, { backgroundColor: palette.accent }]} />
        </View>
      </View>
      <View style={[styles.brandMarkDot, { backgroundColor: palette.accent }]} />
    </View>
  );
}

function formatModelSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

type Palette = {
  background: string;
  panel: string;
  panelAlt: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentWash: string;
  accentText: string;
  danger: string;
  disabled: string;
};

function ScreenTabs({
  activeScreen,
  hasContext,
  palette,
  onHome,
  onSettings,
  onWelcome,
}: {
  activeScreen: AppScreen;
  hasContext: boolean;
  palette: Palette;
  onHome: () => void;
  onSettings: () => void;
  onWelcome: () => void;
}) {
  return (
    <View style={[styles.screenTabs, { borderColor: palette.border, backgroundColor: palette.panel }]}>
      {!hasContext ? (
        <TabButton
          label="First time"
          active={activeScreen === 'welcome'}
          onPress={onWelcome}
          palette={palette}
          testID="tab_welcome"
        />
      ) : null}
      <TabButton
        label="Home"
        active={activeScreen === 'home'}
        onPress={onHome}
        palette={palette}
        testID="tab_home"
      />
      <TabButton
        label="Settings"
        active={activeScreen === 'settings'}
        onPress={onSettings}
        palette={palette}
        testID="tab_settings"
      />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  palette,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: Palette;
  testID: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.tabButton,
        {
          borderColor: active ? palette.accent : palette.border,
          backgroundColor: active ? palette.accentWash : palette.panel,
        },
      ]}
      onPress={onPress}>
      <Text style={[styles.tabButtonText, { color: active ? palette.accent : palette.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ModelSummaryCard({
  activeModel,
  palette,
  selectedModelDownloading,
  selectedModelError,
  selectedModelInstalled,
  selectedModelProgress,
  selectedModelId,
  onSelect,
  onDownload,
}: {
  activeModel: {
    id: string;
    name: string;
    description: string;
    sizeInBytes: number;
    minDeviceMemoryInGb: number;
    backend: string;
    recommended?: boolean;
  };
  palette: Palette;
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
  selectedModelId: string;
  onSelect: (modelId: string) => void;
  onDownload: (modelId: string) => void;
}) {
  return (
    <View style={[styles.modelCard, { borderColor: palette.border, backgroundColor: palette.panelAlt }]}>
      <View style={styles.modelCardHeader}>
        <View style={styles.modelCardTitleBlock}>
          <Text style={[styles.modelCardTitle, { color: palette.text }]}>{activeModel.name}</Text>
          <Text style={[styles.modelCardSubtitle, { color: palette.muted }]}>{activeModel.description}</Text>
        </View>
        <View
          style={[
            styles.modelBadge,
            {
              borderColor: activeModel.recommended ? palette.accent : palette.border,
              backgroundColor: activeModel.recommended ? palette.accentWash : palette.panel,
            },
          ]}>
          <Text style={[styles.modelBadgeText, { color: activeModel.recommended ? palette.accent : palette.muted }]}>
            {activeModel.recommended ? 'Recommended' : 'Option'}
          </Text>
        </View>
      </View>
      <View style={styles.modelMetaRow}>
        <Text style={[styles.modelMeta, { color: palette.muted }]}>{formatModelSize(activeModel.sizeInBytes)}</Text>
        <Text style={[styles.modelMeta, { color: palette.muted }]}>{activeModel.minDeviceMemoryInGb} GB min</Text>
        <Text style={[styles.modelMeta, { color: palette.muted }]}>{activeModel.backend.toUpperCase()}</Text>
      </View>
      <Text style={[styles.modelStatusLine, { color: selectedModelError ? palette.danger : palette.muted }]}>
        {selectedModelError
          ? selectedModelError
          : selectedModelDownloading
            ? `Downloading ${selectedModelProgress}%`
            : selectedModelInstalled
              ? 'Ready on device'
              : 'Not downloaded'}
      </Text>
      <View style={styles.modelActionRow}>
        <TouchableOpacity
          testID="model_select_button"
          accessibilityRole="button"
          style={[
            styles.secondaryButton,
            {
              backgroundColor: selectedModelId === activeModel.id ? palette.accentWash : palette.panel,
              borderColor: palette.border,
            },
          ]}
          onPress={() => onSelect(activeModel.id)}>
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
            {selectedModelId === activeModel.id ? 'Selected' : 'Use model'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="model_download_button"
          accessibilityRole="button"
          style={[styles.actionButton, { backgroundColor: selectedModelInstalled ? palette.disabled : palette.accent }]}
          onPress={() => onDownload(activeModel.id)}
          disabled={selectedModelInstalled || selectedModelDownloading}>
          <Text style={styles.actionButtonText}>
            {selectedModelDownloading ? `Downloading ${selectedModelProgress}%` : selectedModelInstalled ? 'Installed' : 'Download'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CaptureModesCard({
  audioReadiness,
  liteRtEnabled,
  manualCaptureEnabled,
  palette,
  pushToRecordEnabled,
  setCaptureSetting,
  wakeWordEnabled,
}: {
  audioReadiness: {
    transcriptionReady: boolean;
    wakeWordReady: boolean;
    missingModels: string[];
    errors: string[];
  };
  liteRtEnabled: boolean;
  manualCaptureEnabled: boolean;
  palette: Palette;
  pushToRecordEnabled: boolean;
  setCaptureSetting: CaptureSettingSetter;
  wakeWordEnabled: boolean;
}) {
  return (
    <View style={[styles.modePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
      <View style={styles.modePanelHeader}>
        <Text style={[styles.panelTitle, { color: palette.text }]}>Capture modes</Text>
        <Text style={[styles.helperTextInline, { color: palette.muted }]}>Runtime only</Text>
      </View>
      <View style={styles.modeGrid}>
        <ModeTile
          label="Manual"
          value={manualCaptureEnabled}
          onPress={() => setCaptureSetting('manualCaptureEnabled', !manualCaptureEnabled)}
          palette={palette}
        />
        <ModeTile
          label="Record"
          value={pushToRecordEnabled}
          onPress={() => setCaptureSetting('pushToRecordEnabled', !pushToRecordEnabled)}
          palette={palette}
          disabled={!audioReadiness.transcriptionReady}
        />
        <ModeTile
          label="Wake word"
          value={wakeWordEnabled}
          onPress={() => setCaptureSetting('wakeWordEnabled', !wakeWordEnabled)}
          palette={palette}
          disabled={!audioReadiness.wakeWordReady}
        />
        <ModeTile
          label="LiteRT"
          value={liteRtEnabled}
          onPress={() => setCaptureSetting('liteRtEnabled', !liteRtEnabled)}
          palette={palette}
        />
      </View>
      <Text style={[styles.helperText, { color: palette.muted }]}>
        If synthesis is unavailable, captured thoughts are kept in Inbox.
      </Text>
      {!audioReadiness.transcriptionReady ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Record stays disabled until `whisper-tiny.en.bin` is bundled for this platform.
        </Text>
      ) : null}
      {!audioReadiness.wakeWordReady ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Wake word is foreground-only and remains off until a keyword-spotter model is bundled.
        </Text>
      ) : null}
    </View>
  );
}

function ContextSections({
  contextPath,
  palette,
  sections,
}: {
  contextPath: string;
  palette: Palette;
  sections: { header: string; content: string }[];
}) {
  return (
    <>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Context sections</Text>
        <Text style={[styles.contextPath, { color: palette.muted }]}>{contextPath}</Text>
      </View>
      {sections.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: palette.panel, borderColor: palette.border }]}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No captured context yet</Text>
          <Text style={[styles.emptyText, { color: palette.muted }]}>
            Save a typed thought or record one to start building the local context file.
          </Text>
        </View>
      ) : (
        sections.map((section, index) => (
          <View
            key={`${section.header}-${index}`}
            testID={`section_${index}`}
            style={[styles.sectionCard, { backgroundColor: palette.panel, borderColor: palette.border }]}>
            <Text style={[styles.sectionHeaderText, { color: palette.accent }]}>{section.header}</Text>
            <Text style={[styles.sectionBody, { color: palette.text }]}>{section.content}</Text>
          </View>
        ))
      )}
    </>
  );
}

function CaptureComposer({
  isRecording,
  manualCaptureEnabled,
  newThought,
  onChangeThought,
  onRecordPress,
  onSavePress,
  palette,
  pushToRecordEnabled,
}: {
  isRecording: boolean;
  manualCaptureEnabled: boolean;
  newThought: string;
  onChangeThought: (value: string) => void;
  onRecordPress: () => void;
  onSavePress: () => void;
  palette: Palette;
  pushToRecordEnabled: boolean;
}) {
  return (
    <View style={[styles.composer, { backgroundColor: palette.panel, borderColor: palette.border }]}>
      <TextInput
        testID="thought_input"
        accessibilityLabel="Thought Input"
        style={[
          styles.input,
          {
            color: palette.text,
            borderColor: palette.border,
            backgroundColor: manualCaptureEnabled ? palette.panelAlt : palette.disabled,
          },
        ]}
        placeholder="What should the engine remember?"
        placeholderTextColor={palette.muted}
        value={newThought}
        onChangeText={onChangeThought}
        editable={manualCaptureEnabled}
        multiline
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity
          testID="record_button"
          accessibilityLabel="Capture"
          style={[
            styles.actionButton,
            {
              backgroundColor: pushToRecordEnabled ? (isRecording ? palette.danger : '#1F2937') : palette.disabled,
            },
          ]}
          onPress={onRecordPress}
          disabled={!pushToRecordEnabled}>
          <Text style={styles.actionButtonText}>{isRecording ? 'Stop' : 'Record'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="save_button"
          accessibilityLabel="Save"
          style={[
            styles.saveButton,
            {
              backgroundColor: manualCaptureEnabled && newThought.trim() ? palette.accent : palette.disabled,
            },
          ]}
          onPress={onSavePress}
          disabled={!manualCaptureEnabled || !newThought.trim()}>
          <Text style={[styles.actionButtonText, { color: palette.accentText }]}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function WelcomeScreen({
  activeModel,
  bootMessage,
  canRecord,
  contextPath,
  displayStatus,
  onHomePress,
  onOpenSettings,
  palette,
  sections,
  selectedModelDownloading,
  selectedModelError,
  selectedModelId,
  selectedModelInstalled,
  selectedModelProgress,
}: {
  activeModel: {
    id: string;
    name: string;
    description: string;
    sizeInBytes: number;
    minDeviceMemoryInGb: number;
    backend: string;
    recommended?: boolean;
  };
  bootMessage: string;
  canRecord: boolean;
  contextPath: string;
  displayStatus: string;
  onHomePress: () => void;
  onOpenSettings: () => void;
  palette: Palette;
  sections: { header: string; content: string }[];
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
}) {
  return (
    <>
      <View style={[styles.modePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <View style={styles.modePanelHeader}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>First run</Text>
          <Text style={[styles.helperTextInline, { color: palette.muted }]}>Start here</Text>
        </View>
        <Text style={[styles.emptyText, { color: palette.text }]}>Set up the model, record a thought, and create your first context.</Text>
        <View style={styles.welcomeActionRow}>
          <TouchableOpacity
            testID="welcome_home_button"
            accessibilityRole="button"
            style={[styles.secondaryButton, { backgroundColor: palette.panelAlt, borderColor: palette.border }]}
            onPress={onHomePress}>
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>Open home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="welcome_settings_button"
            accessibilityRole="button"
            style={[styles.actionButton, { backgroundColor: palette.accent }]}
            onPress={onOpenSettings}>
            <Text style={styles.actionButtonText}>Open settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.modePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <View style={styles.modePanelHeader}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>Local model</Text>
          <Text style={[styles.helperTextInline, { color: palette.muted }]}>
            {selectedModelInstalled ? 'Ready' : 'Download needed'}
          </Text>
        </View>
        <ModelSummaryCard
          activeModel={activeModel}
          palette={palette}
          selectedModelDownloading={selectedModelDownloading}
          selectedModelError={selectedModelError}
          selectedModelId={selectedModelId}
          selectedModelInstalled={selectedModelInstalled}
          selectedModelProgress={selectedModelProgress}
          onDownload={onOpenSettings}
          onSelect={onOpenSettings}
        />
      </View>

      <View style={[styles.quickCapturePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <Text style={[styles.panelTitle, { color: palette.text }]}>First thought</Text>
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          {canRecord
            ? 'Type it now, or use the record button below to test the capture path.'
            : 'Type it now. Record stays disabled until the local Whisper model is bundled.'}
        </Text>
        <Text style={[styles.helperTextInline, styles.spaceTop8, { color: palette.muted }]}>Status: {displayStatus}</Text>
        <Text style={[styles.helperTextInline, styles.spaceTop6, { color: palette.muted }]}>Boot: {bootMessage}</Text>
        <Text style={[styles.contextPath, styles.spaceTop10, { color: palette.muted }]}>{contextPath}</Text>
      </View>

      <ContextSections contextPath={contextPath} palette={palette} sections={sections} />
    </>
  );
}

function HomeScreen({
  activeModel,
  bootMessage,
  contextPath,
  displayStatus,
  models,
  palette,
  queueSize,
  sections,
  selectedModelDownloading,
  selectedModelError,
  selectedModelId,
  selectedModelInstalled,
  selectedModelProgress,
  onOpenSettings,
}: {
  activeModel: {
    id: string;
    name: string;
    description: string;
    sizeInBytes: number;
    minDeviceMemoryInGb: number;
    backend: string;
    recommended?: boolean;
  };
  bootMessage: string;
  contextPath: string;
  displayStatus: string;
  models: { id: string; name: string; installed: boolean; sizeInBytes: number; minDeviceMemoryInGb: number; backend: string }[];
  palette: Palette;
  queueSize: number;
  sections: { header: string; content: string }[];
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
  onOpenSettings: () => void;
}) {
  return (
    <>
      <View style={[styles.quickCapturePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <View style={styles.modePanelHeader}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>Home</Text>
          <Text style={[styles.helperTextInline, { color: palette.muted }]}>Capture first, sort later</Text>
        </View>
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          {queueSize > 0 ? `Processing ${queueSize} thought${queueSize === 1 ? '' : 's'}.` : displayStatus}
        </Text>
        <Text style={[styles.helperTextInline, styles.spaceTop8, { color: palette.muted }]}>Boot: {bootMessage}</Text>
        <TouchableOpacity
          testID="home_settings_button"
          accessibilityRole="button"
          style={[styles.secondaryButton, styles.spaceTop12, { backgroundColor: palette.panelAlt, borderColor: palette.border }]}
          onPress={onOpenSettings}>
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>Open settings</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.modePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <View style={styles.modePanelHeader}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>Active model</Text>
          <Text style={[styles.helperTextInline, { color: palette.muted }]}>
            {selectedModelInstalled ? 'Installed' : 'Missing'}
          </Text>
        </View>
        <ModelSummaryCard
          activeModel={activeModel}
          palette={palette}
          selectedModelDownloading={selectedModelDownloading}
          selectedModelError={selectedModelError}
          selectedModelId={selectedModelId}
          selectedModelInstalled={selectedModelInstalled}
          selectedModelProgress={selectedModelProgress}
          onDownload={onOpenSettings}
          onSelect={onOpenSettings}
        />
      </View>

      <ContextSections contextPath={contextPath} palette={palette} sections={sections} />

      <View style={[styles.quickCapturePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <Text style={[styles.panelTitle, { color: palette.text }]}>Queue</Text>
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          {models.filter(model => model.installed).length} model{models.filter(model => model.installed).length === 1 ? '' : 's'} available on device.
        </Text>
      </View>
    </>
  );
}

function SettingsScreen({
  activeModel,
  audioReadiness,
  liteRtEnabled,
  manualCaptureEnabled,
  models,
  palette,
  pushToRecordEnabled,
  selectedModelDownloading,
  selectedModelError,
  selectedModelId,
  selectedModelInstalled,
  selectedModelProgress,
  setCaptureSetting,
  selectModel,
  downloadModel,
  wakeWordEnabled,
  onHomePress,
  onWelcomePress,
}: {
  activeModel: {
    id: string;
    name: string;
    description: string;
    sizeInBytes: number;
    minDeviceMemoryInGb: number;
    backend: string;
    recommended?: boolean;
  };
  audioReadiness: {
    transcriptionReady: boolean;
    wakeWordReady: boolean;
    missingModels: string[];
    errors: string[];
  };
  liteRtEnabled: boolean;
  manualCaptureEnabled: boolean;
  models: {
    id: string;
    name: string;
    description: string;
    sizeInBytes: number;
    minDeviceMemoryInGb: number;
    backend: string;
    installed: boolean;
    downloading: boolean;
    progress: number;
    error: string | null;
    recommended?: boolean;
  }[];
  palette: Palette;
  pushToRecordEnabled: boolean;
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
  setCaptureSetting: CaptureSettingSetter;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  wakeWordEnabled: boolean;
  onHomePress: () => void;
  onWelcomePress: () => void;
}) {
  return (
    <>
      <View style={[styles.quickCapturePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <View style={styles.modePanelHeader}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>Settings</Text>
          <Text style={[styles.helperTextInline, { color: palette.muted }]}>Capture and model options</Text>
        </View>
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          Keep the capture switches here. Home stays focused on the actual thought flow.
        </Text>
        <View style={styles.settingsActionRow}>
          <TouchableOpacity
            testID="settings_home_button"
            accessibilityRole="button"
            style={[styles.secondaryButton, { backgroundColor: palette.panelAlt, borderColor: palette.border }]}
            onPress={onHomePress}>
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>Open home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="settings_welcome_button"
            accessibilityRole="button"
            style={[styles.actionButton, { backgroundColor: palette.accent }]}
            onPress={onWelcomePress}>
            <Text style={styles.actionButtonText}>First time</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.modePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <View style={styles.modePanelHeader}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>Local model</Text>
          <Text style={[styles.helperTextInline, { color: palette.muted }]}>
            {selectedModelInstalled ? 'Installed' : 'Needs download'}
          </Text>
        </View>
        <ModelSummaryCard
          activeModel={activeModel}
          palette={palette}
          selectedModelDownloading={selectedModelDownloading}
          selectedModelError={selectedModelError}
          selectedModelId={selectedModelId}
          selectedModelInstalled={selectedModelInstalled}
          selectedModelProgress={selectedModelProgress}
          onSelect={selectModel}
          onDownload={downloadModel}
        />
        <View style={styles.modelList}>
          {models.map(model => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelListItem,
                {
                  backgroundColor: selectedModelId === model.id ? palette.accentWash : palette.panel,
                  borderColor: selectedModelId === model.id ? palette.accent : palette.border,
                },
              ]}
              onPress={() => selectModel(model.id)}>
              <View style={styles.modelListHeader}>
                <Text style={[styles.modelListName, { color: palette.text }]}>{model.name}</Text>
                <Text style={[styles.modelListStatus, { color: model.installed ? palette.accent : palette.muted }]}>
                  {model.installed ? 'Installed' : 'Missing'}
                </Text>
              </View>
              <Text style={[styles.modelListMeta, { color: palette.muted }]}>
                {formatModelSize(model.sizeInBytes)} · {model.minDeviceMemoryInGb} GB · {model.backend.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <CaptureModesCard
        audioReadiness={audioReadiness}
        liteRtEnabled={liteRtEnabled}
        manualCaptureEnabled={manualCaptureEnabled}
        palette={palette}
        pushToRecordEnabled={pushToRecordEnabled}
        setCaptureSetting={setCaptureSetting}
        wakeWordEnabled={wakeWordEnabled}
      />
    </>
  );
}

type CaptureSettingSetter = (
  key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'liteRtEnabled',
  value: boolean,
) => void;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 56,
    paddingBottom: 12,
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
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandMarkCore: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  brandMarkPage: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkLine: {
    width: 11,
    height: 2,
    borderRadius: 1,
    marginBottom: 3,
  },
  brandMarkLineShort: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  brandMarkDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
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
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 33,
  },
  subtitle: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 18,
  },
  spaceTop6: {
    marginTop: 6,
  },
  spaceTop8: {
    marginTop: 8,
  },
  spaceTop10: {
    marginTop: 10,
  },
  spaceTop12: {
    marginTop: 12,
  },
  screenTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '900',
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
    padding: 16,
    paddingBottom: 26,
  },
  modePanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  modePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  helperTextInline: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelStack: {
    gap: 10,
  },
  modelCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  modelCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modelCardTitleBlock: {
    flex: 1,
    gap: 4,
  },
  modelCardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  modelCardSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  modelBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  modelBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modelMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  modelMeta: {
    fontSize: 11,
    fontWeight: '700',
  },
  modelStatusLine: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  modelActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  welcomeActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  settingsActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  modelList: {
    gap: 8,
  },
  modelListItem: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modelListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modelListName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  modelListStatus: {
    fontSize: 11,
    fontWeight: '800',
  },
  modelListMeta: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
  },
  modeTile: {
    width: '48.8%',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  modeState: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
  },
  helperText: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(120, 113, 108, 0.28)',
    marginTop: 12,
    paddingTop: 10,
    fontSize: 12,
    lineHeight: 17,
  },
  quickCapturePanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  contextPath: {
    marginTop: 4,
    fontSize: 11,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 22,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  composer: {
    borderTopWidth: 1,
    padding: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 58,
    maxHeight: 104,
    padding: 12,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    width: 112,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});

export default App;
