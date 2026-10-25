import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Keyboard, Platform } from 'react-native';

import { AppShell } from '../AppShell';
import { ImportScreen } from '../../features/import/ImportScreen';
import { AppHeader } from '../../shared/components/AppHeader';
import type { ImportPreview } from '../../core/importTypes';
import * as shareUtilities from '../../shared/utils/share';
import { useAppStore } from '../../core/store';
import { ContextManager } from '../../modules/ContextManager';
import { ProcessingQueueManager } from '../../modules/SynthesisEngine/ProcessingQueueManager';
import { useHeadsetTripleTapCapture } from '../../shared/hooks/useHeadsetTripleTapCapture';

jest.mock('../../shared/hooks/useHeadsetTripleTapCapture', () => ({
  useHeadsetTripleTapCapture: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../features/reflections/ReflectionsScreen', () => ({
  ReflectionsScreen: ({ threads, searchResults, onSearchChange, onOpenQueue, onOpenThread }: any) => {
    const mockReact = require('react');
    const { Pressable, Text } = require('react-native');
    return (
      mockReact.createElement(
        mockReact.Fragment,
        null,
        mockReact.createElement(
          Pressable,
          { testID: 'open_thread', onPress: () => onOpenThread(threads[0].id) },
          mockReact.createElement(Text, null, 'Open thread'),
        ),
        mockReact.createElement(
          Pressable,
          { testID: 'start_search', onPress: () => onSearchChange?.('Launch') },
          mockReact.createElement(Text, null, 'Search'),
        ),
        mockReact.createElement(
          Pressable,
          { testID: 'open_queue_status', onPress: onOpenQueue },
          mockReact.createElement(Text, null, 'Open Waiting'),
        ),
        searchResults?.[0] ? mockReact.createElement(
          Pressable,
          { testID: 'open_search_result', onPress: () => onOpenThread(searchResults[0].threadId, searchResults[0].id) },
          mockReact.createElement(Text, null, 'Open search result'),
        ) : null,
      )
    );
  },
}));

jest.mock('../../features/threads/ThreadDetailsScreen', () => ({
  ThreadDetailsScreen: ({ threadDetails, targetNoteId, onQueueInboxForSynthesis, onEditCapture, onDeleteCapture, onDeleteCaptureAudio, onTranscribeCapture }: any) => {
    const mockReact = require('react');
    const { Pressable, Text } = require('react-native');
    return (
      mockReact.createElement(
        mockReact.Fragment,
        null,
          mockReact.createElement(Text, { testID: 'target_note_id' }, targetNoteId ?? ''),
          mockReact.createElement(Text, { testID: 'thread_title' }, threadDetails?.title ?? ''),
        mockReact.createElement(
          Pressable,
          { testID: 'queue_inbox', onPress: onQueueInboxForSynthesis },
          mockReact.createElement(Text, null, 'Synthesize Inbox'),
        ),
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
        mockReact.createElement(
          Pressable,
          { testID: 'transcribe_capture_audio', onPress: () => onTranscribeCapture?.(threadDetails.captures[0].id) },
          mockReact.createElement(Text, null, 'Transcribe capture audio'),
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
  let updateThoughtSectionSpy: jest.SpyInstance;
  let addToQueueSpy: jest.SpyInstance;
  const loadContext = jest.fn(async () => undefined);

  beforeEach(() => {
    updateThoughtSectionSpy = jest.spyOn(ContextManager, 'updateThoughtAndResolveSection')
      .mockImplementation(async sectionHeader => sectionHeader);
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

  it('passes the matching note id when opening a search result', async () => {
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        ...useAppStore.getInitialState(),
        sections: [{
          header: 'Work',
          content: '- [2026-05-27T10:00:00.000Z] Launch review\n  Note id: note-123\n  Source kind: TEXT',
        }],
      });
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'start_search' }).props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'open_search_result' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'target_note_id' }).props.children).toBe('note-123');
  });

  it('retains home and import drafts, topic, and preview across navigation', async () => {
    const analyzeImportDraft = jest.fn(async () => ({
      sourceKind: 'text' as const, transcript: 'Import draft', refinedText: 'Import draft',
      suggestedTopic: 'Work', tags: [], source: 'raw-fallback' as const,
      selectedTopic: 'Work', mergeCandidate: false, requiresApproval: false,
    }));
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({ ...useAppStore.getInitialState(), analyzeImportDraft });
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'thought_input' }).props.onChangeText('Home draft'));
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'tab_import' }).props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'import_text_input' }).props.onChangeText('Import draft'));
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'import_topic_input' }).props.onChangeText('Work'));
    await ReactTestRenderer.act(async () => renderer.root.find(node => node.props.testID === 'import_analyze_button' && node.props.accessibilityRole === 'button').props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'tab_queue' }).props.onPress());
    expect(renderer.root.findByType(ImportScreen).props.active).toBe(false);
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'tab_reflections' }).props.onPress());
    expect(renderer.root.findByProps({ testID: 'thought_input' }).props.value).toBe('Home draft');
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'tab_import' }).props.onPress());
    expect(renderer.root.findByProps({ testID: 'import_text_input' }).props.value).toBe('Import draft');
    expect(renderer.root.findByProps({ testID: 'import_topic_input' }).props.value).toBe('Work');
    expect(renderer.root.findAllByProps({ testID: 'import_submit_button' }).length).toBeGreaterThan(0);
  });

  it('keeps the keyboard dismiss affordance until the native hide event completes', async () => {
    const listeners = new Map<string, (event?: any) => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event, listener) => {
      listeners.set(event, listener as (event?: any) => void);
      return { remove: jest.fn() } as any;
    }) as typeof Keyboard.addListener);

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });

    const fireKeyboardEvent = async (name: string, event?: any) => {
      await ReactTestRenderer.act(async () => listeners.get(name)?.(event));
    };
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    await fireKeyboardEvent(showEvent, { endCoordinates: { height: 300 } });
    if (Platform.OS === 'ios') {
      expect(renderer.root.findAllByProps({ testID: 'keyboard_done_button' })).toHaveLength(0);
      await fireKeyboardEvent('keyboardDidShow', { endCoordinates: { height: 300 } });
    }
    expect(renderer.root.findByProps({ testID: 'keyboard_done_button' })).toBeDefined();

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'keyboard_done_button' }).props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'keyboard_done_button' })).toBeDefined();

    await fireKeyboardEvent('keyboardWillHide');
    expect(renderer.root.findByProps({ testID: 'keyboard_done_button' })).toBeDefined();

    await fireKeyboardEvent('keyboardDidHide');
    expect(renderer.root.findAllByProps({ testID: 'keyboard_done_button' })).toHaveLength(0);
  });

  it('preserves open search topic and editor return when mtime changes reorder sections', async () => {
    const shareSpy = jest.spyOn(shareUtilities, 'shareThreadContext').mockResolvedValue(undefined);
    const work = { header: 'Work!', content: '- [2026-05-27T10:00:00.000Z] Launch work\n  Note id: work-note' };
    const other = { header: 'Work?', content: '- [2026-05-27T10:00:00.000Z] Other note\n  Note id: other-note' };
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({ ...useAppStore.getInitialState(), sections: [work, other], loadContext });
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'start_search' }).props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'open_search_result' }).props.onPress());
    ReactTestRenderer.act(() => useAppStore.setState({ sections: [other, work] }));
    expect(renderer.root.findByProps({ testID: 'thread_title' }).props.children).toBe('Work!');
    expect(renderer.root.findByProps({ testID: 'target_note_id' }).props.children).toBe('work-note');
    await ReactTestRenderer.act(async () => renderer.root.findByType(AppHeader).props.onSharePress());
    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Work!', captures: [expect.objectContaining({ noteId: 'work-note' })] }));
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'edit_capture' }).props.onPress());
    expect(renderer.root.findByProps({ testID: 'note_editor_input' }).props.value).toBe('Launch work');
    await ReactTestRenderer.act(async () => renderer.root.findByProps({ testID: 'save_note_editor' }).props.onPress());
    expect(updateThoughtSectionSpy).toHaveBeenCalledWith('Work!', 'work-note', { text: 'Launch work' });
    expect(renderer.root.findByProps({ testID: 'thread_title' }).props.children).toBe('Work!');
  });

  it('invalidates delayed import analysis after navigation and draft edits', async () => {
    let resolvePreview!: (preview: ImportPreview) => void;
    const analyzeImportDraft = jest.fn(() => new Promise<ImportPreview>(resolve => { resolvePreview = resolve; }));
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({ ...useAppStore.getInitialState(), analyzeImportDraft });
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'tab_import' }).props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'import_text_input' }).props.onChangeText('Old draft'));
    ReactTestRenderer.act(() => { renderer.root.find(node => node.props.testID === 'import_analyze_button' && node.props.accessibilityRole === 'button').props.onPress(); });
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'tab_queue' }).props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'tab_import' }).props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'import_text_input' }).props.onChangeText('Current draft'));
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'import_topic_input' }).props.onChangeText('Current topic'));
    await ReactTestRenderer.act(async () => resolvePreview({
      sourceKind: 'text', transcript: 'Old draft', refinedText: 'Old draft', suggestedTopic: 'Old topic',
      tags: [], source: 'raw-fallback', selectedTopic: null, mergeCandidate: true, requiresApproval: true,
    }));
    expect(renderer.root.findByProps({ testID: 'import_text_input' }).props.value).toBe('Current draft');
    expect(renderer.root.findByProps({ testID: 'import_topic_input' }).props.value).toBe('Current topic');
    expect(renderer.root.findAllByProps({ testID: 'import_approve_button' })).toHaveLength(0);
  });

  it.each([false, true])('edits a blocked first Waiting note (clarification=%s) through the real selector and screen', async clarification => {
    const updateQueuedThought = jest.fn(() => true);
    const job = {
      id: 'pending-job', noteId: 'pending-note', transcript: 'Editable pending text',
      timestamp: '2026-10-24T10:00:00.000Z', attempts: 0, kind: 'text' as const,
      ...(clarification ? { clarification: { question: 'Which topic?', options: [{ topic: 'Work' }, { topic: 'Home' }] } } : {}),
    };
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        ...useAppStore.getInitialState(), queueJobs: [job], queueSize: 1, currentThoughtId: null,
        isProcessing: false, updateQueuedThought,
        queueClarification: clarification ? { thoughtId: job.id, noteId: job.noteId, question: 'Which topic?', options: [{ topic: 'Work' }, { topic: 'Home' }] } : null,
      });
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'tab_queue' }).props.onPress());
    if (clarification) {
      ReactTestRenderer.act(() => renderer.root.find(node => node.props.testID === 'clarification_edit_button' && node.props.accessibilityRole === 'button').props.onPress());
    } else {
      ReactTestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: 'Open waiting note: Editable pending text' }).props.onPress());
      ReactTestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: 'Edit note: Editable pending text' }).props.onPress());
    }
    expect(renderer.root.findByProps({ testID: 'note_editor_input' }).props.value).toBe('Editable pending text');
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'note_editor_input' }).props.onChangeText('Updated pending text'));
    await ReactTestRenderer.act(async () => renderer.root.findByProps({ testID: 'save_note_editor' }).props.onPress());
    expect(updateQueuedThought).toHaveBeenCalledWith('pending-job', { transcript: 'Updated pending text', selectedTopic: null });
    expect(renderer.root.findByType(AppHeader).props.title).toBe('Waiting');
  });

  it('opens Waiting from the Home status action', async () => {
    await ReactTestRenderer.act(async () => {
      useAppStore.setState(useAppStore.getInitialState());
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });

    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'open_queue_status' }).props.onPress();
    });

    expect(renderer.root.findAllByProps({ testID: 'open_thread' })).toHaveLength(0);
    expect(renderer.root.findByProps({ title: 'Waiting' })).toBeDefined();
  });

  it('returns to the originating list after queuing Inbox for synthesis', async () => {
    const queueInboxForSynthesis = jest.fn(async () => 1);
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        ...useAppStore.getInitialState(),
        sections: [{ header: 'Inbox', content: '- [2026-05-27T10:00:00.000Z] Voice note\n  Note id: note-inbox-1\n  Source kind: VOICE' }],
        queueInboxForSynthesis,
      });
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'open_thread' }).props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'queue_inbox' }).props.onPress();
      await Promise.resolve();
    });

    expect(queueInboxForSynthesis).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByProps({ testID: 'open_thread' })).toBeDefined();
    expect(renderer.root.findAllByProps({ testID: 'edit_capture' })).toHaveLength(0);
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

    expect(updateThoughtSectionSpy).toHaveBeenCalledWith('Work', 'note-123', {
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

  it('queues an edit under the reconciled section after synthesis moves the note while the editor is open', async () => {
    let resolveUpdatedSection!: (sectionHeader: string | null) => void;
    const updateGate = new Promise<string | null>(resolve => { resolveUpdatedSection = resolve; });
    updateThoughtSectionSpy.mockImplementationOnce(async () => updateGate);

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        ...useAppStore.getInitialState(),
        sections: [{
          header: 'Inbox',
          content: `
- [2026-05-27T10:00:00.000Z] Inbox note
  Note id: note-moved-before-save
  Source kind: VOICE
  Source transcript: original voice transcript
        `.trim(),
        }],
        loadContext,
      });
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'open_thread' }).props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'edit_capture' }).props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'note_editor_input' }).props.onChangeText('Edited after topic move');
    });

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'save_note_editor' }).props.onPress();
      await Promise.resolve();
    });
    expect(updateThoughtSectionSpy).toHaveBeenCalledWith('Inbox', 'note-moved-before-save', {
      text: 'Edited after topic move',
    });
    expect(addToQueueSpy).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      resolveUpdatedSection('Work');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadContext).toHaveBeenCalled();
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'Edited after topic move',
      'voice',
      expect.objectContaining({
        sectionHeader: 'Work',
        thoughtText: 'Edited after topic move',
        noteId: 'note-moved-before-save',
        sourceMetadata: expect.objectContaining({
          noteId: 'note-moved-before-save',
          sectionHeader: 'Work',
          text: 'Edited after topic move',
          transcript: 'original voice transcript',
        }),
      }),
      expect.objectContaining({
        noteId: 'note-moved-before-save',
        selectedTopic: 'Work',
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
      'Delete this note?',
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
      'Delete this recording?',
      expect.stringContaining('The note in Inbox will stay'),
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

  it('routes retained Inbox audio retry to the matching persisted note', async () => {
    const retranscribeRetainedAudioFromNote = jest.fn(async () => true);
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        sections: [
          {
            header: 'Inbox',
            content: `
- [2026-05-27T10:00:00.000Z] Voice capture retained
  Note id: note-audio-retry
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
        retranscribeRetainedAudioFromNote,
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
      renderer.root.findByProps({ testID: 'transcribe_capture_audio' }).props.onPress();
      await Promise.resolve();
    });

    expect(retranscribeRetainedAudioFromNote).toHaveBeenCalledWith({
      sectionHeader: 'Inbox',
      noteId: 'note-audio-retry',
      thoughtText: 'Voice capture retained',
      audioFilePath: '/mock/path/retained-audio/contextengine-retained-owned.wav',
    });
  });

  it('opens the reflections composer when a home-screen capture request arrives', async () => {
    jest.mocked(useHeadsetTripleTapCapture).mockClear();
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AppShell bootMessage="Booted" contextPath="/mock/topics" quickCaptureRequest={0} />,
      );
    });
    expect(useHeadsetTripleTapCapture).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'tab_queue' }).props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'composer_shell' }).props.accessibilityElementsHidden).toBe(true);

    await ReactTestRenderer.act(async () => {
      renderer.update(
        <AppShell bootMessage="Booted" contextPath="/mock/topics" quickCaptureRequest={1} />,
      );
    });
    expect(renderer.root.findByProps({ testID: 'composer_shell' }).props.accessibilityElementsHidden).toBe(false);
  });

  it('starts voice capture from the widget Record action and returns to the composer', async () => {
    const startCapture = jest.fn(async () => undefined);
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    useAppStore.setState({
      startCapture,
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
    } as any);

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AppShell bootMessage="Booted" contextPath="/mock/topics" quickRecordRequest={0} />,
      );
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'tab_queue' }).props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'composer_shell' }).props.accessibilityElementsHidden).toBe(true);

    await ReactTestRenderer.act(async () => {
      renderer.update(
        <AppShell bootMessage="Booted" contextPath="/mock/topics" quickRecordRequest={1} />,
      );
    });

    expect(startCapture).toHaveBeenCalledTimes(1);
    expect(dismissKeyboard).toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'composer_shell' }).props.accessibilityElementsHidden).toBe(false);
    dismissKeyboard.mockRestore();
  });

  it('keeps a Stop action available after navigating away from the reflections composer', async () => {
    const stopCapture = jest.fn(async () => ({ text: '' }));
    useAppStore.setState({
      ...useAppStore.getInitialState(),
      recordingState: 'recording',
      isRecording: true,
      status: 'Listening... · stop from app',
      stopCapture,
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AppShell bootMessage="Booted" contextPath="/mock/topics" />);
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'tab_queue' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'active_recording_controls' })).toBeDefined();
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'active_recording_stop' }).props.onPress();
    });
    expect(stopCapture).toHaveBeenCalledTimes(1);
  });
});
