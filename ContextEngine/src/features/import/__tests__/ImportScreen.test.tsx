import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { useAppStore } from '../../../core/store';
import type { ImportPreview } from '../../../core/importTypes';
import { ImportScreen } from '../ImportScreen';

jest.mock('../../../core/releaseCapabilities', () => ({
  RELEASE_CAPABILITIES: { voiceImport: true },
}));

const preview: ImportPreview = {
  sourceKind: 'text', transcript: 'Original draft', refinedText: 'Original draft',
  suggestedTopic: 'Work', selectedTopic: null, tags: [], source: 'raw-fallback',
  mergeCandidate: true, requiresApproval: true,
};

describe('ImportScreen draft revisions', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  const button = (testID: string) => renderer.root.find(node => node.props.testID === testID && node.props.accessibilityRole === 'button');
  const input = (testID: string) => renderer.root.findByProps({ testID });

  beforeEach(() => {
    useAppStore.setState({ ...useAppStore.getInitialState(), sections: [{ header: 'Work', content: '- Work note' }] });
  });

  afterEach(() => {
    ReactTestRenderer.act(() => renderer?.unmount());
    jest.restoreAllMocks();
  });

  it('hides routine status and repeated Inbox guidance, but keeps assistant warnings', () => {
    useAppStore.setState({
      ...useAppStore.getInitialState(),
      sections: [{ header: 'Work', content: '- Work note' }],
      status: 'Idle',
    });
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ImportScreen />); });
    expect(renderer.root.findAllByProps({ children: 'Status' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ children: 'What happens' })).toHaveLength(0);

    ReactTestRenderer.act(() => {
      useAppStore.setState({ status: 'Model missing', queueSize: 0, queueBlockedReason: null });
    });
    expect(renderer.root.findByProps({ children: "Writing assistant isn't ready" })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Your note will be saved in Inbox. Download the writing assistant from Settings to sort it into a topic.' })).toBeTruthy();
  });

  it.each(['text', 'topic', 'source'])('discards a delayed preview after %s changes', async field => {
    let resolvePreview!: (value: ImportPreview) => void;
    const analyzeImportDraft = jest.fn(() => new Promise<ImportPreview>(resolve => { resolvePreview = resolve; }));
    const queueImportedThought = jest.fn(async () => 'queued');
    useAppStore.setState({ analyzeImportDraft, queueImportedThought });
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ImportScreen />); });
    ReactTestRenderer.act(() => input('import_text_input').props.onChangeText('Original draft'));
    ReactTestRenderer.act(() => button('import_analyze_button').props.onPress());
    ReactTestRenderer.act(() => {
      if (field === 'text') input('import_text_input').props.onChangeText('New draft');
      if (field === 'topic') input('import_topic_input').props.onChangeText('New topic');
      if (field === 'source') button('import_source_voice_button').props.onPress();
    });
    await ReactTestRenderer.act(async () => resolvePreview(preview));
    expect(renderer.root.findAllByProps({ testID: 'import_approve_button' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'import_submit_button' })).toHaveLength(0);
    expect(queueImportedThought).not.toHaveBeenCalled();
    if (field === 'text') expect(input('import_text_input').props.value).toBe('New draft');
    if (field === 'topic') expect(input('import_topic_input').props.value).toBe('New topic');
  });

  it('keeps source selection and analysis across inactive navigation, then approves that exact preview', async () => {
    let resolvePreview!: (value: ImportPreview) => void;
    const analyzeImportDraft = jest.fn(() => new Promise<ImportPreview>(resolve => { resolvePreview = resolve; }));
    const queueImportedThought = jest.fn(async () => 'queued');
    useAppStore.setState({ analyzeImportDraft, queueImportedThought });
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ImportScreen />); });
    ReactTestRenderer.act(() => button('import_source_voice_button').props.onPress());
    ReactTestRenderer.act(() => button('import_voice_sample_button').props.onPress());
    ReactTestRenderer.act(() => button('import_analyze_button').props.onPress());
    ReactTestRenderer.act(() => renderer.update(<ImportScreen active={false} />));
    const voicePreview = { ...preview, sourceKind: 'voice' as const };
    expect(analyzeImportDraft).toHaveBeenCalledWith({ sourceKind: 'voice', voiceFile: expect.anything(), selectedTopic: '' });
    await ReactTestRenderer.act(async () => resolvePreview(voicePreview));
    ReactTestRenderer.act(() => renderer.update(<ImportScreen active />));
    expect(button('import_source_voice_button').props.disabled).toBe(false);
    expect(renderer.root.findAllByProps({ testID: 'import_voice_sample_button' }).length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => button('import_approve_button').props.onPress());
    expect(queueImportedThought).toHaveBeenCalledWith(voicePreview, { approvedTopic: 'Work' });
  });

  it('prevents the draft from changing while an approved preview is saving', async () => {
    let resolveSave!: (value: string) => void;
    const queueImportedThought = jest.fn(() => new Promise<string>(resolve => { resolveSave = resolve; }));
    useAppStore.setState({ analyzeImportDraft: jest.fn(async () => preview), queueImportedThought });
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ImportScreen />); });
    ReactTestRenderer.act(() => input('import_text_input').props.onChangeText('Original draft'));
    await ReactTestRenderer.act(async () => button('import_analyze_button').props.onPress());
    ReactTestRenderer.act(() => button('import_approve_button').props.onPress());
    expect(input('import_text_input').props.editable).toBe(false);
    ReactTestRenderer.act(() => input('import_text_input').props.onChangeText('New unsaved draft'));
    await ReactTestRenderer.act(async () => resolveSave('queued'));
    expect(queueImportedThought).toHaveBeenCalledWith(preview, { approvedTopic: 'Work' });
    expect(input('import_text_input').props.value).toBe('Original draft');
    expect(renderer.root.findAllByProps({ testID: 'import_approve_button' })).toHaveLength(0);
  });
});
