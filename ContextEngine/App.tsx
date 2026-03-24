import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { useAppStore } from './src/core/store';
import { requestAudioPermissions } from './src/shared/utils/permissions';
import { ContextManager } from './src/modules/ContextManager';
import RNFS from 'react-native-fs';
import { NativeEventEmitter, NativeModules } from 'react-native';

const CONTEXT_PATH = `${RNFS.DocumentDirectoryPath}/context.md`;

import { startBackgroundEar, stopBackgroundEar } from './src/modules/AudioEngine/BackgroundService';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#121212' : '#F8F9FA',
    flex: 1,
  };
  const { 
    sections, 
    isRecording, 
    status, 
    queueSize,
    loadContext, 
    addThought, 
    startCapture, 
    stopCapture,
    initializeEngine,
    setStatus 
  } = useAppStore();
// ...
        <View style={[styles.statusBadge, { backgroundColor: isRecording ? '#FF5252' : '#E0E0E0' }]}>
          <Text testID="status_badge" style={[styles.statusText, { color: isRecording ? '#FFF' : '#666' }]}>
            {queueSize > 0 ? `Processing (${queueSize})` : status}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isRecording ? '#FF5252' : '#E0E0E0' }]}>
          <Text testID="status_badge" style={[styles.statusText, { color: isRecording ? '#FFF' : '#666' }]}>{status}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={handleTestTranscription} style={{ padding: 10, backgroundColor: '#007AFF', margin: 20, borderRadius: 10 }}>
        <Text style={{ color: '#FFF', textAlign: 'center' }}>Test AI Engine (No Mock)</Text>
      </TouchableOpacity>

      <ScrollView testID="context_scroll" style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No context captured yet.</Text>
          </View>
        ) : (
          sections.map((section, index) => (
            <View key={index} testID={`section_${index}`} style={[styles.sectionCard, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF' }]}>
              <Text style={[styles.sectionHeader, { color: isDarkMode ? '#BB86FC' : '#6200EE' }]}>
                {section.header}
              </Text>
              <Text style={[styles.sectionBody, { color: isDarkMode ? '#B0B0B0' : '#444' }]}>
                {section.content}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View accessibilityLabel="Footer" style={[styles.footer, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF' }]}>
        <TextInput
          testID="thought_input"
          accessibilityLabel="Thought Input"
          style={[styles.input, { 
            color: isDarkMode ? '#FFF' : '#000', 
            borderColor: isDarkMode ? '#333' : '#E0E0E0',
            backgroundColor: isDarkMode ? '#2C2C2C' : '#F1F3F4' 
          }]}
          placeholder="What's on your mind?"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          value={newThought}
          onChangeText={setNewThought}
          multiline
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            testID="record_button"
            accessibilityLabel="Capture"
            style={[styles.recordButton, isRecording && styles.recordingActive]} 
            onPress={handleToggleRecording}
          >
            <Text style={styles.buttonText}>{isRecording ? 'Stop' : 'Capture'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            testID="save_button"
            accessibilityLabel="Save"
            style={[styles.sendButton, { opacity: newThought.trim() ? 1 : 0.5 }]} 
            onPress={handleManualSave}
            disabled={!newThought.trim()}
          >
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 20,
  },
  sectionCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  footer: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  input: {
    borderRadius: 12,
    padding: 16,
    maxHeight: 120,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  recordButton: {
    backgroundColor: '#000',
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingActive: {
    backgroundColor: '#FF5252',
  },
  sendButton: {
    backgroundColor: '#6200EE',
    width: 100,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default App;
