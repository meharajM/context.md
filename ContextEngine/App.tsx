import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [newThought, setNewThought] = useState('');
  const [bootMessage, setBootMessage] = useState('Preparing local context');

  const {
    sections,
    isRecording,
    status,
    queueSize,
    manualCaptureEnabled,
    pushToRecordEnabled,
    wakeWordEnabled,
    liteRtEnabled,
    loadContext,
    addThought,
    startCapture,
    stopCapture,
    initializeEngine,
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

  const handleManualSave = async () => {
    const text = newThought.trim();
    if (!manualCaptureEnabled || !text) {
      return;
    }

    await addThought(text);
    setNewThought('');
  };

  const handleToggleRecording = async () => {
    if (!pushToRecordEnabled) {
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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>LOCAL MEMORY ENGINE</Text>
          <View style={[styles.statusPill, { backgroundColor: palette.panel, borderColor: palette.border }]}>
            <Text style={[styles.statusLabel, { color: palette.muted }]}>Status</Text>
            <Text testID="status_badge" style={[styles.statusValue, { color: isRecording ? palette.danger : palette.text }]}>
              {isRecording ? 'Recording' : displayStatus}
            </Text>
          </View>
        </View>
        <Text style={[styles.title, { color: palette.text }]}>Capture what should not be lost.</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Typed notes, push-to-record, and foreground wake word all route into one local context file.
        </Text>
      </View>

      <ScrollView testID="context_scroll" style={styles.content} contentContainerStyle={styles.contentInner}>
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
            />
            <ModeTile
              label="Wake word"
              value={wakeWordEnabled}
              onPress={() => setCaptureSetting('wakeWordEnabled', !wakeWordEnabled)}
              palette={palette}
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
        </View>

        <View style={[styles.quickCapturePanel, { backgroundColor: palette.panel, borderColor: palette.border }]}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>Next capture</Text>
          <Text style={[styles.emptyText, { color: palette.muted }]}>
            Drop the thought now. The engine can organize it later.
          </Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Context sections</Text>
          <Text style={[styles.contextPath, { color: palette.muted }]}>{CONTEXT_PATH}</Text>
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
      </ScrollView>

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
          onChangeText={setNewThought}
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
            onPress={handleToggleRecording}
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
            onPress={handleManualSave}
            disabled={!manualCaptureEnabled || !newThought.trim()}>
            <Text style={[styles.actionButtonText, { color: palette.accentText }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

interface ModeTileProps {
  label: string;
  value: boolean;
  onPress: () => void;
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

function ModeTile({ label, value, onPress, palette }: ModeTileProps) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[
        styles.modeTile,
        {
          backgroundColor: value ? palette.accentWash : palette.panelAlt,
          borderColor: value ? palette.accent : palette.border,
        },
      ]}
      onPress={onPress}>
      <Text style={[styles.modeLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.modeState, { color: value ? palette.accent : palette.muted }]}>{value ? 'On' : 'Off'}</Text>
    </TouchableOpacity>
  );
}

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
  eyebrow: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
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
