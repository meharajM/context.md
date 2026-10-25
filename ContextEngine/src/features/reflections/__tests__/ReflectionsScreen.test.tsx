import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

import { ReflectionsScreen } from '../ReflectionsScreen';
import { RELEASE_CAPABILITIES } from '../../../core/releaseCapabilities';
import type { RecentThreadView } from '../reflectionTypes';
import type { DeviceReadinessAssessment } from '../../../modules/DeviceReadiness';

const thread = (id: string, title: string): RecentThreadView => ({
  id,
  title,
  preview: 'Saved note',
  noteCountLabel: '1 note',
  updatedAtLabel: 'Today',
  icon: 'document',
  sourceContent: '',
});

describe('ReflectionsScreen capture guidance', () => {
  it('hides passive ready guidance while keeping save confirmations visible', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen threads={[thread('work-1', 'Work')]} canRecord onOpenThread={() => undefined} />,
      );
    });
    expect(renderer.root.findAllByProps({ children: 'Ready for a note' })).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.update(
      <ReflectionsScreen threads={[thread('work-1', 'Work')]} displayStatus="Organized into Work" onOpenThread={() => undefined} />,
    ));
    expect(renderer.root.findByProps({ children: 'Note organized' })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('describes only capture modes enabled for this release', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<ReflectionsScreen threads={[]} onOpenThread={() => undefined} />);
    });

    const text = renderer.root.findAllByType(Text).map(node => node.props.children).join(' ');
    expect(text).toContain(RELEASE_CAPABILITIES.voiceCapture ? 'Write or record a note' : 'Write a note');
    expect(text.includes('Write or record a note')).toBe(RELEASE_CAPABILITIES.voiceCapture);
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('hides the duplicate download prompt while the first-run notice is visible', () => {
    const ready: DeviceReadinessAssessment = {
      checkAvailable: true,
      isSimulator: false,
      platform: 'android',
      osVersion: '16',
      totalMemoryBytes: 6 * 1024 ** 3,
      availableMemoryBytes: 3 * 1024 ** 3,
      freeStorageBytes: 5 * 1024 ** 3,
      lowMemory: false,
      thermalState: 'nominal',
      minimumMemoryBytes: 4 * 1024 ** 3,
      meetsSynthesisMinimum: true,
      resourcesAvailable: true,
      reason: 'ready',
    };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    for (const readiness of [ready, { ...ready, checkAvailable: false, meetsSynthesisMinimum: null, reason: 'unavailable' as const }, { ...ready, totalMemoryBytes: 2 * 1024 ** 3, meetsSynthesisMinimum: false, reason: 'minimum-memory' as const }]) {
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <ReflectionsScreen
            threads={[]}
            liteRtEnabled
            selectedModelInstalled={false}
            showDeviceReadinessNotice
            deviceReadiness={readiness}
            onOpenThread={() => undefined}
          />,
        );
      });
      expect(renderer.root.findAllByProps({ testID: 'model_prompt_install_button' })).toHaveLength(0);
      ReactTestRenderer.act(() => renderer.unmount());
    }
  });

  it('links queue work to Waiting, even when Inbox also exists', () => {
    const onOpenQueue = jest.fn();
    const onOpenThread = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[thread('inbox-0', 'Inbox')]}
          queueSize={1}
          displayStatus="Saved in Inbox. Android will retry when it can."
          onOpenQueue={onOpenQueue}
          onOpenThread={onOpenThread}
        />,
      );
    });

    const action = renderer.root.findByProps({ testID: 'capture_status_action' });
    expect(action.props.label).toBe('Open Waiting');
    ReactTestRenderer.act(() => action.props.onPress());
    expect(onOpenQueue).toHaveBeenCalledTimes(1);
    expect(onOpenThread).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('links a saved fallback to the existing Inbox and an organized note to its exact topic', () => {
    const onOpenThread = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[thread('inbox-0', 'Inbox'), thread('work-1', 'Work')]}
          displayStatus="Saved to Inbox: retry this note later."
          onOpenThread={onOpenThread}
        />,
      );
    });
    let action = renderer.root.findByProps({ testID: 'capture_status_action' });
    expect(action.props.label).toBe('Open Inbox');
    ReactTestRenderer.act(() => action.props.onPress());
    expect(onOpenThread).toHaveBeenLastCalledWith('inbox-0');

    ReactTestRenderer.act(() => renderer.update(
      <ReflectionsScreen
        threads={[thread('inbox-0', 'Inbox'), thread('work-1', 'Work')]}
        displayStatus="Organized into Work"
        onOpenThread={onOpenThread}
      />,
    ));
    action = renderer.root.findByProps({ testID: 'capture_status_action' });
    expect(action.props.label).toBe('Open Work');
    ReactTestRenderer.act(() => action.props.onPress());
    expect(onOpenThread).toHaveBeenLastCalledWith('work-1');
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('shows no destination action when Inbox or named topic is missing', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen threads={[]} displayStatus="Saved to Inbox: retry later." onOpenThread={jest.fn()} />,
      );
    });
    expect(renderer.root.findAllByProps({ testID: 'capture_status_action' })).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.update(
      <ReflectionsScreen threads={[thread('work-0', 'Work')]} displayStatus="Organized into Home" onOpenThread={jest.fn()} />,
    ));
    expect(renderer.root.findAllByProps({ testID: 'capture_status_action' })).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('opens a matching topic from note search', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const onOpenThread = jest.fn();
    const onSearchChange = jest.fn();

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          searchQuery="launch"
          searchResults={[{
            id: 'launch-note',
            threadId: 'atlas-0',
            topic: 'Atlas',
            text: 'Discuss launch timing.',
            dateLabel: 'Today',
          }]}
          onSearchChange={onSearchChange}
          onOpenThread={onOpenThread}
        />,
      );
    });

    const search = renderer.root.findByProps({ testID: 'note_search_input' });
    ReactTestRenderer.act(() => search.props.onChangeText('review'));
    expect(onSearchChange).toHaveBeenCalledWith('review');
    const result = renderer.root.findByProps({ testID: 'note_search_result_0' });
    ReactTestRenderer.act(() => result.props.onPress());
    expect(onOpenThread).toHaveBeenCalledWith('atlas-0', 'launch-note');

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('distinguishes an Inbox fallback from a categorized note', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const fallbackStatus = 'Saved to Inbox: download the writing assistant in Settings to organize this note.';

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord={true}
          displayStatus={fallbackStatus}
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Note saved in Inbox' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: fallbackStatus })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.unmount());

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord={true}
          displayStatus="Organized into Home"
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Note organized' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Organized into Home' })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('shows Android background retry state only while a note is waiting', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const retryStatus = 'Saved in Inbox. Android will retry when it can; timing depends on the system.';

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord={true}
          queueSize={1}
          isProcessing={false}
          displayStatus={retryStatus}
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Note saved in Inbox' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: retryStatus })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('offers model installation below its RAM minimum with a clear performance warning', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const onDownloadModel = jest.fn();

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          liteRtEnabled={true}
          selectedModelSizeBytes={584417280}
          selectedModelMinMemoryInGb={4}
          selectedModelInstalled={false}
          deviceReadiness={{
            checkAvailable: true,
            isSimulator: false,
            platform: 'android',
            osVersion: '16',
            apiLevel: 36,
            totalMemoryBytes: 2.4 * 1024 ** 3,
            availableMemoryBytes: 1.5 * 1024 ** 3,
            freeStorageBytes: 3.7 * 1024 ** 3,
            lowMemory: false,
            thermalState: 'nominal',
            minimumMemoryBytes: 4 * 1024 ** 3,
            meetsSynthesisMinimum: false,
            resourcesAvailable: true,
            reason: 'minimum-memory',
          }}
          onDownloadModel={onDownloadModel}
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Needs 4 GB phone memory' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'This phone has 2.4 GB of memory. It may run slowly or stop, but your notes stay saved in Inbox.' })).toBeTruthy();
    const installButton = renderer.root.findByProps({ testID: 'model_prompt_install_button' });
    expect(installButton.props.label).toBe('Download anyway · 557 MB');
    ReactTestRenderer.act(() => installButton.props.onPress());
    expect(onDownloadModel).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('warns that an installed below-minimum model will still be attempted when memory permits', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          liteRtEnabled
          selectedModelSizeBytes={584417280}
          selectedModelMinMemoryInGb={4}
          selectedModelInstalled
          deviceReadiness={{
            checkAvailable: true,
            isSimulator: false,
            platform: 'android',
            osVersion: '16',
            apiLevel: 36,
            totalMemoryBytes: 2.4 * 1024 ** 3,
            availableMemoryBytes: 1.5 * 1024 ** 3,
            freeStorageBytes: 3.7 * 1024 ** 3,
            lowMemory: false,
            thermalState: 'nominal',
            minimumMemoryBytes: 4 * 1024 ** 3,
            meetsSynthesisMinimum: false,
            resourcesAvailable: true,
            reason: 'minimum-memory',
          }}
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'This phone has less memory than recommended' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'This phone has 2.4 GB of memory. The assistant may run slowly or stop, and your notes stay saved in Inbox.' })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('shows actionable microphone guidance while preserving typed capture messaging', () => {
    const onOpenCaptureSettings = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord={false}
          displayStatus="Microphone access needed"
          onOpenCaptureSettings={onOpenCaptureSettings}
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Microphone access needed' })).toBeTruthy();
    expect(
      renderer.root.findByProps({
        children: 'Allow microphone access in your phone settings. You can still type a note.',
      }),
    ).toBeTruthy();

    const settingsButton = renderer.root.find(
      node => node.props.testID === 'capture_settings_button' && node.props.accessibilityRole === 'button',
    );
    ReactTestRenderer.act(() => settingsButton.props.onPress());
    expect(onOpenCaptureSettings).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('explains recording recovery without showing unrelated synthesis status', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord={true}
          recordingState="error"
          displayStatus="Downloading Gemma3-1B-IT (42%) before queued thoughts can be categorized"
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Voice recording needs attention' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'If you recorded audio, it is saved in Inbox. Check microphone access in Settings, then try again.' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ children: 'Downloading Gemma3-1B-IT (42%) before queued thoughts can be categorized' })).toHaveLength(0);

    ReactTestRenderer.act(() => renderer.unmount());
  });
});

// Future voice behavior requires explicit release capability opt-in.
jest.mock('../../../core/releaseCapabilities', () => ({
  RELEASE_CAPABILITIES: {
    voiceCapture: true, voiceImport: true, assistantCapture: true, headsetTrigger: true, wakeWord: true,
  },
}));
