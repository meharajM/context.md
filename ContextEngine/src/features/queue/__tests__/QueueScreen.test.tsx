import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { QueueScreen } from '../QueueScreen';
import { QueueJobCard } from '../QueueJobCard';
import { selectQueueView } from '../queueSelectors';
import type { PendingThought } from '../../../modules/SynthesisEngine/ProcessingQueueManager';

const jobs: PendingThought[] = [
  { id: 'note-1', noteId: 'note-1', transcript: 'Background note', timestamp: '2026-05-26', attempts: 0, kind: 'text' },
  { id: 'note-2', noteId: 'note-2', transcript: 'Later note', timestamp: '2026-05-26', attempts: 0, kind: 'text' },
];

describe('QueueScreen', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  afterEach(() => ReactTestRenderer.act(() => renderer?.unmount()));

  it('shows one concise empty state when nothing is active or waiting', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<QueueScreen jobs={[]} displayStatus="Idle" />);
    });
    expect(renderer.root.findAllByType(QueueJobCard)).toHaveLength(0);
    const visibleText = renderer.root.findAllByType(Text).map(node => node.props.children).join(' ');
    expect(visibleText).toContain('Nothing waiting');
    expect(visibleText).not.toContain('In progress');
    expect(visibleText).not.toContain('No notes are waiting');
  });

  it('shows blocked work once in Waiting and exposes edit/remove for the first note', async () => {
    const status = 'Saved in Inbox. Android will retry when it can; timing depends on the system.';
    const onEditJob = jest.fn();
    const onEndJob = jest.fn();
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<QueueScreen jobs={selectQueueView(jobs, null, false)} displayStatus={status} onEditJob={onEditJob} onEndJob={onEndJob} />);
    });
    expect(renderer.root.findByProps({ testID: 'background_synthesis_status' }).props.children).toBe(status);
    expect(renderer.root.findAllByType(QueueJobCard).filter(node => node.props.job.id !== 'idle').map(node => node.props.job.id)).toEqual(['note-1', 'note-2']);
    ReactTestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: 'Open waiting note: Background note' }).props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: 'Edit note: Background note' }).props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: 'Remove waiting note: Background note' }).props.onPress());
    expect(onEditJob).toHaveBeenCalledWith('note-1');
    expect(onEndJob).toHaveBeenCalledWith('note-1');
    const visibleText = renderer.root.findAllByType(Text).map(node => node.props.children).join(' ');
    expect(visibleText).toContain('Waiting');
    expect(visibleText).not.toContain('Organizing');
  });

  it('shows clarification once with choices, edit, and cancel, without promoting another pending note', async () => {
    const clarification = { question: 'Which topic?', options: [{ topic: 'Work' }, { topic: 'Home' }] };
    const onEditJob = jest.fn();
    const onEndJob = jest.fn();
    const onResolveClarification = jest.fn();
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<QueueScreen jobs={selectQueueView([{ ...jobs[0], clarification }, jobs[1]], null, false, 'note-1')} displayStatus="Waiting for your topic choice" onEditJob={onEditJob} onEndJob={onEndJob} onResolveClarification={onResolveClarification} />);
    });
    expect(renderer.root.findAllByType(QueueJobCard).map(node => node.props.job.id)).toEqual(['note-1', 'note-2']);
    ReactTestRenderer.act(() => renderer.root.find(node => node.props.testID === 'clarification_edit_button' && node.props.accessibilityRole === 'button').props.onPress());
    ReactTestRenderer.act(() => renderer.root.find(node => node.props.testID === 'clarification_remove_button' && node.props.accessibilityRole === 'button').props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: 'Choose topic Work' }).props.onPress());
    expect(onEditJob).toHaveBeenCalledWith('note-1');
    expect(onEndJob).toHaveBeenCalledWith('note-1');
    expect(onResolveClarification).toHaveBeenCalledWith('note-1', 'Work');
  });

  it('protects the real active item until processing finishes', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<QueueScreen jobs={selectQueueView(jobs, 'note-1', true)} displayStatus="Organizing" />);
    });
    const cards = renderer.root.findAllByType(QueueJobCard);
    expect(cards.map(node => node.props.job.id)).toEqual(['note-1', 'note-2']);
    expect(cards[0].props.job).toMatchObject({ canEdit: false, canEnd: false });
    expect(renderer.root.findAllByProps({ testID: 'clarification_edit_button' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'clarification_remove_button' })).toHaveLength(0);
  });
});
