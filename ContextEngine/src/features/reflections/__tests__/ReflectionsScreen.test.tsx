import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { ReflectionsScreen } from '../ReflectionsScreen';
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
  it('keeps the first-run empty topics message compact', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<ReflectionsScreen threads={[]} onOpenThread={() => undefined} />);
    });

    expect(renderer.root.findByProps({ testID: 'empty_topics_state' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'No topics yet' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Add a thought below to get started.' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ children: 'Nothing captured yet' })).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.unmount());
  });

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

  it('keeps on-device topic organization visible and describes the safe fallback', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          liteRtEnabled
          selectedModelInstalled
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'On-device AI keeps related thoughts together.' })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.update(
      <ReflectionsScreen threads={[]} onOpenThread={() => undefined} />,
    ));
    expect(renderer.root.findByProps({ children: 'Notes stay here; on-device AI organizes them when ready.' })).toBeTruthy();
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

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          liteRtEnabled
          selectedModelInstalled={false}
          deviceReadiness={ready}
          deviceReadinessNoticeDismissed
          onOpenThread={() => undefined}
        />,
      );
    });
    expect(renderer.root.findAllByProps({ testID: 'model_prompt_install_button' })).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.update(
      <ReflectionsScreen
        threads={[]}
        liteRtEnabled
        selectedModelInstalled={false}
        selectedModelDownloading
        selectedModelProgress={42}
        deviceReadiness={ready}
        deviceReadinessNoticeDismissed
        onOpenThread={() => undefined}
      />,
    ));
    expect(renderer.root.findByProps({ testID: 'model_prompt_install_button' }).props.label).toBe('Downloading 42%');
    ReactTestRenderer.act(() => renderer.unmount());
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
          displayStatus="Saved in Inbox. It will be sorted when your device is ready."
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
    const fallbackStatus = 'Saved to Inbox: download the writing helper in Settings to sort this note.';

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
    expect(renderer.root.findByProps({ children: 'AI will sort it when ready.' })).toBeTruthy();
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

  it('shows a simple retry message only while a note is waiting', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const retryStatus = 'Saved in Inbox. It will be sorted when your device is ready.';
    const simpleRetryStatus = 'Saved in Inbox. It will be sorted when your device is ready.';

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
    expect(renderer.root.findByProps({ children: simpleRetryStatus })).toBeTruthy();
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

    expect(renderer.root.findByProps({ children: 'The writing helper may be slow here' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Your notes will still be saved if you choose to download it.' })).toBeTruthy();
    const installButton = renderer.root.findByProps({ testID: 'model_prompt_install_button' });
    expect(installButton.props.label).toBe('Download · 557 MB');
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

    expect(renderer.root.findByProps({ children: 'The writing helper may be slow here' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Your notes will still be saved, and you can keep using the app.' })).toBeTruthy();
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
        children: 'Allow microphone access in your device settings. You can still type a note.',
      }),
    ).toBeTruthy();

    const settingsButton = renderer.root.find(
      node => node.props.testID === 'capture_settings_button' && node.props.accessibilityRole === 'button',
    );
    ReactTestRenderer.act(() => settingsButton.props.onPress());
    expect(onOpenCaptureSettings).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('distinguishes disabled voice capture from voice setup in progress', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord={false}
          pushToRecordEnabled
          voiceModelDownloading
          onOpenThread={() => undefined}
        />,
      );
    });
    expect(renderer.root.findByProps({ children: 'Preparing voice notes' })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.update(
      <ReflectionsScreen
        threads={[]}
        canRecord={false}
        pushToRecordEnabled={false}
        onOpenThread={() => undefined}
      />,
    ));
    expect(renderer.root.findByProps({ children: 'Voice notes are off' })).toBeTruthy();
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
    expect(renderer.root.findByProps({ children: 'Your notes are safe. Try recording again, or type a note.' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ children: 'Downloading Gemma3-1B-IT (42%) before queued thoughts can be categorized' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'capture_settings_button' })).toHaveLength(0);

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('opens Inbox when a recording was saved but no words were recognized', () => {
    const onOpenThread = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[thread('inbox', 'Inbox')]}
          canRecord
          recordingState="error"
          displayStatus="Audio retained in Inbox"
          onOpenThread={onOpenThread}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Recording saved in Inbox' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: "We couldn't get words from this recording. You can listen to it in Inbox and try again later." })).toBeTruthy();
    const inboxButton = renderer.root.findByProps({ testID: 'capture_status_action' });
    expect(inboxButton.props.label).toBe('Open Inbox');
    ReactTestRenderer.act(() => inboxButton.props.onPress());
    expect(onOpenThread).toHaveBeenCalledWith('inbox');
    expect(renderer.root.findAllByProps({ testID: 'capture_settings_button' })).toHaveLength(0);

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('shows a waiting note issue instead of a stale recording error', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord
          recordingState="error"
          queueSize={1}
          displayStatus="Synthesis unavailable on this device: LiteRT timed out"
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Writing helper is not ready' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ children: 'Voice recording needs attention' })).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.unmount());
  });
});

// Future voice behavior requires explicit release capability opt-in.
jest.mock('../../../core/releaseCapabilities', () => ({
  RELEASE_CAPABILITIES: {
    voiceCapture: true, voiceImport: true, assistantCapture: true, headsetTrigger: true, wakeWord: true,
  },
}));
