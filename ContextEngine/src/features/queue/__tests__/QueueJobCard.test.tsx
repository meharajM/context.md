import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { QueueJobCard } from '../QueueJobCard';
import type { QueueJobView } from '../queueTypes';

describe('QueueJobCard', () => {
  const job: QueueJobView = {
    id: 'queued-1',
    noteId: 'note-queued-1',
    title: 'Edit this queued note',
    transcript: 'Edit this queued note',
    timestampLabel: 'Queued 10:00 AM',
    statusLabel: 'Queued',
    progress: null,
    kind: 'text',
    selectedTopic: 'Work',
    canEnd: true,
    canEdit: true,
    isActiveSlot: false,
  };

  it('exposes an edit action for pending queued notes', async () => {
    const onEdit = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<QueueJobCard job={job} onEdit={onEdit} />);
    });

    const openCard = renderer!.root.find(node => node.props.accessibilityLabel === 'Open waiting note: Edit this queued note');
    await ReactTestRenderer.act(async () => {
      openCard.props.onPress();
    });

    const editButton = renderer!.root.find(node => node.props.accessibilityLabel === 'Edit note: Edit this queued note');
    await ReactTestRenderer.act(async () => {
      editButton.props.onPress();
    });

    expect(onEdit).toHaveBeenCalledWith('queued-1');
  });

  it('labels the next queued note without claiming it is processing', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    const nextJob = { ...job, statusLabel: 'Pending...', isActiveSlot: true };

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<QueueJobCard job={nextJob} isActive />);
    });

    const labels = renderer!.root.findAllByType(Text).map(node => node.props.children).join(' ');
    expect(labels).toContain('Next note');
    expect(labels).toContain('Waiting');
    expect(labels).not.toContain('In progress');
    expect(labels).not.toContain('Organizing');
  });
});
