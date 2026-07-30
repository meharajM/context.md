import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';

import { AppShell } from '../AppShell';
import { useAppStore } from '../../core/store';
import { ContextManager } from '../../modules/ContextManager';
import { ProcessingQueueManager } from '../../modules/SynthesisEngine/ProcessingQueueManager';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../features/reflections/ReflectionsScreen', () => ({
  ReflectionsScreen: ({ threads, onOpenThread }: any) => {
    const mockReact = require('react');
    const { Pressable, Text } = require('react-native');
    return (
      mockReact.createElement(
        Pressable,
        { testID: 'open_thread', onPress: () => onOpenThread(threads[0].id) },
        mockReact.createElement(Text, null, 'Open thread'),
      )
    );
  },
}));

jest.mock('../../features/threads/ThreadDetailsScreen', () => ({
  ThreadDetailsScreen: ({ threadDetails, onEditCapture, onDeleteCapture, onDeleteCaptureAudio }: any) => {
    const mockReact = require('react');
    const { Pressable, Text } = require('react-native');
    return (
      mockReact.createElement(
        mockReact.Fragment,
        null,
        mockReact.createElement(
          Pressable,
          { testID: 'edit_capture', onPress: () => onEditCapture?.(threadDetails.captures[0].id) },
          mockReact.createElement(Text, null, 'Edit capture'),
        ),
        mockReact.createElement(
          Pressable,
          { testID: 'delete_capture', onPress: () => onDeleteCapture?.(threadDetails.captures[0].id) },
          mockReact.createElement(Text, null, 'Delete capture'),
        ),
        mockReact.createElement(
          Pressable,
          { testID: 'delete_capture_audio', onPress: () => onDeleteCaptureAudio?.(threadDetails.captures[0].id) },
          mockReact.createElement(Text, null, 'Delete capture audio'),
        ),
      )
    );
  },
}));

jest.mock('../../features/noteEditor/NoteEditorScreen', () => ({
  NoteEditorScreen: ({ value, onChangeValue, onSave }: any) => {
    const mockReact = require('react');
    const { Pressable, Text, TextInput } = require('react-native');
    return (
      mockReact.createElement(
        mockReact.Fragment,
        null,
        mockReact.createElement(TextInput, {
          testID: 'note_editor_input',
          value,
          onChangeText: onChangeValue,
        }),
        mockReact.createElement(
          Pressable,
          { testID: 'save_note_editor', onPress: onSave },
          mockReact.createElement(Text, null, 'Save'),
        ),
      )
    );
  },
}));

describe('AppShell persisted note editing', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  let updateThoughtSpy: jest.SpyInstance;
  let addToQueueSpy: jest.SpyInstance;
  const loadContext = jest.fn(async () => undefined);

  beforeEach(() => {
    updateThoughtSpy = jest.spyOn(ContextManager, 'updateThought').mockResolvedValue(true);
    addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-id');
  });

  afterEach(() => {
    if (renderer) {
      ReactTestRenderer.act(() => {
        renderer.unmount();
      });
    }
    jest.restoreAllMocks();
    loadContext.mockClear();
  });

  it('re-queues a persisted thread note against its current thread after save', async () => {
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        sections: [
          {
            header: 'Work',
            content: `
- [2026-05-27T10:00:00.000Z] Existing note
  Note id: note-123
  Source kind: TEXT
  Source transcript: original source transcript
  Source note id: source-789
  Source section: Inbox
  Source text: Original source text
        `.trim(),
          },
        ],
        isRecording: false,
        recordingState: 'idle',
        status: 'Idle',
        queueSize: 0,
        pendingCount: 0,
        isProcessing: false,
        currentThoughtId: null,
        lastQueueError: null,
        queueBlockedReason: null,
        models: [],
        selectedModelId: null,
        selectedModelInstalled: false,
        selectedModelDownloading: false,
        selectedModelProgress: 0,
        selectedModelError: null,
        selectedModelStatusMessage: null,
        audioReadiness: {
          transcriptionReady: true,
          wakeWordReady: false,
          missingModels: [],
          errors: [],
        },
        manualCaptureEnabled: true,
        pushToRecordEnabled: true,
        wakeWordEnabled: false,
        liteRtEnabled: true,
        refreshModels: jest.fn(async () => undefined),
        downloadModel: jest.fn(async () => undefined),
        removeModel: jest.fn(async () => undefined),
        selectModel: jest.fn(),
        setCaptureSetting: jest.fn(),
        queueJobs: [],
        removeQueuedThought: jest.fn(),
        updateQueuedThought: jest.fn(() => true),
        queueInboxForSynthesis: jest.fn(async () => 0),
        setStatus: jest.fn(),
        loadContext,
      } as any);
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'open_thread' }).props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'edit_capture' }).props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'note_editor_input' }).props.onChangeText('Edited persisted note');
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'save_note_editor' }).props.onPress();
    });

    expect(updateThoughtSpy).toHaveBeenCalledWith('Work', 'note-123', {
      text: 'Edited persisted note',
    });
    expect(loadContext).toHaveBeenCalled();
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'Edited persisted note',
      'text',
      expect.objectContaining({
        sectionHeader: 'Work',
        noteId: 'note-123',
        thoughtText: 'Edited persisted note',
        sourceMetadata: expect.objectContaining({
          noteId: 'note-123',
          sectionHeader: 'Work',
          text: 'Edited persisted note',
          transcript: 'original source transcript',
        }),
      }),
      expect.objectContaining({
        noteId: 'note-123',
        selectedTopic: 'Work',
      }),
    );
  });

  it('re-queues an edited Inbox note without forcing Inbox as the selected topic', async () => {
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        sections: [
          {
            header: 'Inbox',
            content: `
- [2026-05-27T10:00:00.000Z] Inbox note
  Note id: note-999
  Source kind: VOICE
  Source transcript: voice source transcript
        `.trim(),
          },
        ],
        isRecording: false,
        recordingState: 'idle',
        status: 'Idle',
        queueSize: 0,
        pendingCount: 0,
        isProcessing: false,
        currentThoughtId: null,
        lastQueueError: null,
        queueBlockedReason: null,
        models: [],
        selectedModelId: null,
        selectedModelInstalled: false,
        selectedModelDownloading: false,
        selectedModelProgress: 0,
        selectedModelError: null,
        selectedModelStatusMessage: null,
        audioReadiness: {
          transcriptionReady: true,
          wakeWordReady: false,
          missingModels: [],
          errors: [],
        },
        manualCaptureEnabled: true,
        pushToRecordEnabled: true,
        wakeWordEnabled: false,
        liteRtEnabled: true,
        refreshModels: jest.fn(async () => undefined),
        downloadModel: jest.fn(async () => undefined),
        removeModel: jest.fn(async () => undefined),
        selectModel: jest.fn(),
        setCaptureSetting: jest.fn(),
        queueJobs: [],
        removeQueuedThought: jest.fn(),
        updateQueuedThought: jest.fn(() => true),
        queueInboxForSynthesis: jest.fn(async () => 0),
        setStatus: jest.fn(),
        loadContext,
      } as any);
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'open_thread' }).props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'edit_capture' }).props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'note_editor_input' }).props.onChangeText('Edited inbox note');
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'save_note_editor' }).props.onPress();
    });

    expect(addToQueueSpy).toHaveBeenCalledWith(
      'Edited inbox note',
      'voice',
      expect.objectContaining({
        sectionHeader: 'Inbox',
        noteId: 'note-999',
      }),
      expect.objectContaining({
        noteId: 'note-999',
        selectedTopic: null,
      }),
    );
  });

  it('requires destructive confirmation before deleting an unsynthesized Inbox note', async () => {
    const deleteUnsynthesizedNote = jest.fn(async () => true);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        sections: [
          {
            header: 'Inbox',
            content: `
- [2026-05-27T10:00:00.000Z] Raw Inbox note
  Note id: note-delete-1
  Source kind: TEXT
  Source transcript: Raw Inbox note
            `.trim(),
          },
        ],
        isRecording: false,
        recordingState: 'idle',
        status: 'Idle',
        queueSize: 0,
        pendingCount: 0,
        isProcessing: false,
        currentThoughtId: null,
        lastQueueError: null,
        queueBlockedReason: null,
        models: [],
        selectedModelId: null,
        selectedModelInstalled: false,
        selectedModelDownloading: false,
        selectedModelProgress: 0,
        selectedModelError: null,
        selectedModelStatusMessage: null,
        audioReadiness: {
          transcriptionReady: true,
          wakeWordReady: false,
          missingModels: [],
          errors: [],
        },
        manualCaptureEnabled: true,
        pushToRecordEnabled: true,
        wakeWordEnabled: false,
        liteRtEnabled: true,
        refreshModels: jest.fn(async () => undefined),
        downloadModel: jest.fn(async () => undefined),
        removeModel: jest.fn(async () => undefined),
        selectModel: jest.fn(),
        setCaptureSetting: jest.fn(),
        queueJobs: [],
        removeQueuedThought: jest.fn(),
        updateQueuedThought: jest.fn(() => true),
        queueInboxForSynthesis: jest.fn(async () => 0),
        deleteRetainedAudioFromNote: jest.fn(async () => true),
        deleteUnsynthesizedNote,
        loadContext,
      } as any);
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'open_thread' }).props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'delete_capture' }).props.onPress();
    });

    expect(deleteUnsynthesizedNote).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete unsynthesized note?',
      expect.stringContaining('cannot be undone'),
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0][2] ?? [];
    const destructiveButton = buttons.find(button => button.style === 'destructive');
    await ReactTestRenderer.act(async () => {
      destructiveButton?.onPress?.();
      await Promise.resolve();
    });

    expect(deleteUnsynthesizedNote).toHaveBeenCalledWith({
      sectionHeader: 'Inbox',
      noteId: 'note-delete-1',
      thoughtText: 'Raw Inbox note',
      audioFilePath: null,
    });
  });

  it('requires confirmation before deleting retained audio while keeping its Inbox note', async () => {
    const deleteRetainedAudioFromNote = jest.fn(async () => true);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        sections: [
          {
            header: 'Inbox',
            content: `
- [2026-05-27T10:00:00.000Z] Voice capture retained
  Note id: note-audio-1
  Source kind: VOICE
  Source audio file: /mock/path/retained-audio/contextengine-retained-owned.wav
            `.trim(),
          },
        ],
        status: 'Idle',
        queueSize: 0,
        queueJobs: [],
        currentThoughtId: null,
        isProcessing: false,
        models: [],
        selectedModelId: null,
        refreshModels: jest.fn(async () => undefined),
        queueInboxForSynthesis: jest.fn(async () => 0),
        deleteRetainedAudioFromNote,
        deleteUnsynthesizedNote: jest.fn(async () => true),
        loadContext,
      } as any);
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'open_thread' }).props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'delete_capture_audio' }).props.onPress();
    });

    expect(deleteRetainedAudioFromNote).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete retained audio?',
      expect.stringContaining('Inbox note will remain'),
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0][2] ?? [];
    const destructiveButton = buttons.find(button => button.style === 'destructive');
    await ReactTestRenderer.act(async () => {
      destructiveButton?.onPress?.();
      await Promise.resolve();
    });

    expect(deleteRetainedAudioFromNote).toHaveBeenCalledWith({
      sectionHeader: 'Inbox',
      noteId: 'note-audio-1',
      thoughtText: 'Voice capture retained',
      audioFilePath: '/mock/path/retained-audio/contextengine-retained-owned.wav',
    });
  });
});
