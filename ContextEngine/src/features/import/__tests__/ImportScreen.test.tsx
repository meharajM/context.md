import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

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
    useAppStore.setState({
      ...useAppStore.getInitialState(),
      sections: [{ header: 'Work', content: '- Work note' }],
      selectedModelInstalled: false,
      selectedModelDownloading: false,
    });
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
    expect(renderer.root.findByProps({ children: "Writing helper isn't ready" })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Install the writing helper in Settings; until then, notes stay in Inbox.' })).toBeTruthy();
  });

  it('hides an old Inbox result while shared text is waiting for review', () => {
    useAppStore.setState({
      ...useAppStore.getInitialState(),
      status: 'Saved to Inbox: download the writing helper in Settings to sort this note.',
    });
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ImportScreen pendingSharedContent={{ id: 'shared-pending', text: 'Current shared draft' }} />,
      );
    });
    expect(input('import_text_input').props.value).toBe('Current shared draft');
    expect(renderer.root.findAllByProps({ children: 'Status' })).toHaveLength(0);
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

  it.each(['litert', 'raw-fallback'] as const)('labels only model-backed summaries in %s previews', async source => {
    const analyzed = { ...preview, source, summary: 'Generated short summary' };
    useAppStore.setState({ analyzeImportDraft: jest.fn(async () => analyzed) });
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ImportScreen />); });
    ReactTestRenderer.act(() => input('import_text_input').props.onChangeText('Original draft'));
    await ReactTestRenderer.act(async () => button('import_analyze_button').props.onPress());
    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
    expect(labels).toContain('Original draft');
    expect(labels.includes('AI summary')).toBe(source === 'litert');
    expect(labels.includes('Generated short summary')).toBe(source === 'litert');
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

  it('reviews shared text, saves it with a stable id, and does not show save failure if acknowledgement fails', async () => {
    const shared = { id: 'shared-123', text: 'A useful idea from another app' };
    const onSharedContentSaved = jest.fn(async () => { throw new Error('outbox unavailable'); });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sharedPreview = { ...preview, transcript: shared.text, refinedText: shared.text, requiresApproval: false };
    const analyzeImportDraft = jest.fn(async () => sharedPreview);
    const queueImportedThought = jest.fn(async () => 'queued');
    useAppStore.setState({ analyzeImportDraft, queueImportedThought });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ImportScreen pendingSharedContent={shared} onSharedContentSaved={onSharedContentSaved} />,
      );
    });
    expect(input('import_text_input').props.value).toBe(shared.text);
    expect(queueImportedThought).not.toHaveBeenCalled();
    expect(onSharedContentSaved).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => button('import_analyze_button').props.onPress());
    expect(analyzeImportDraft).toHaveBeenCalledWith({ sourceKind: 'text', text: shared.text, selectedTopic: '' });
    await ReactTestRenderer.act(async () => button('import_submit_button').props.onPress());

    expect(queueImportedThought).toHaveBeenCalledWith(sharedPreview, {
      approvedTopic: undefined,
      sharedContentId: shared.id,
    });
    expect(onSharedContentSaved).toHaveBeenCalledWith(shared.id);
    expect(input('import_text_input').props.value).toBe(shared.text);
    expect(renderer.root.findByProps({ children: 'Your note is saved. Try again to clear the shared text.' })).toBeTruthy();
    expect(button('import_submit_button')).toBeTruthy();
    expect(renderer.root.findAllByProps({ children: "Couldn't save your note. Please try again." })).toHaveLength(0);
  });

  it('automatically files and acknowledges a shared reply when local AI is ready', async () => {
    const shared = { id: 'shared-auto-123', text: 'The assistant response with next steps' };
    const autoFileSharedContent = jest.fn(async () => true);
    const onSharedContentSaved = jest.fn(async () => true);
    const queueImportedThought = jest.fn(async () => 'unexpected-manual-save');
    useAppStore.setState({
      selectedModelInstalled: true,
      selectedModelDownloading: false,
      liteRtEnabled: true,
      autoFileSharedContent,
      queueImportedThought,
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ImportScreen
          appReady
          pendingSharedContent={shared}
          onSharedContentSaved={onSharedContentSaved}
        />,
      );
      await new Promise(resolve => setImmediate(resolve));
    });

    expect(autoFileSharedContent).toHaveBeenCalledWith(shared.text, shared.id);
    expect(onSharedContentSaved).toHaveBeenCalledWith(shared.id);
    expect(queueImportedThought).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: 'import_submit_button' })).toHaveLength(0);
  });
});
