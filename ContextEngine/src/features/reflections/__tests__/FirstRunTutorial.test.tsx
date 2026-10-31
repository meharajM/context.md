import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { FirstRunTutorial } from '../FirstRunTutorial';

const props = {
  modelInstalled: false,
  modelDownloading: false,
  modelProgress: 0,
  voiceModelDownloading: false,
  voiceModelProgress: 0,
  voiceModelReady: true,
  voiceModelError: null,
  onRetryVoiceModelDownload: jest.fn(),
  onFinish: jest.fn(),
};

describe('FirstRunTutorial', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  afterEach(() => {
    if (renderer) ReactTestRenderer.act(() => renderer.unmount());
    jest.clearAllMocks();
  });

  it('moves through all three pages and finishes from the last page', () => {
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<FirstRunTutorial {...props} />);
    });

    const press = (testID: string) => ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID }).props.onPress();
    });

    expect(renderer.root.findByProps({ accessibilityLabel: 'Step 1 of 3' })).toBeTruthy();
    press('first_run_next');
    expect(renderer.root.findByProps({ accessibilityLabel: 'Step 2 of 3' })).toBeTruthy();
    press('first_run_next');
    expect(renderer.root.findByProps({ accessibilityLabel: 'Step 3 of 3' })).toBeTruthy();
    press('first_run_start');
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });

  it('lets users skip while both model downloads run', () => {
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <FirstRunTutorial
          {...props}
          modelDownloading
          modelProgress={24}
          voiceModelDownloading
          voiceModelProgress={56}
          voiceModelReady={false}
        />,
      );
    });

    expect(renderer.root.findByProps({ accessibilityLabel: 'Topic organization download 24%' })).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: 'Voice notes download 56%' })).toBeTruthy();
    const skip = renderer.root.findByProps({ testID: 'first_run_skip' });
    expect(skip.props.disabled).not.toBe(true);
    ReactTestRenderer.act(() => skip.props.onPress());
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });

  it('can start capturing from the last step before voice setup finishes', () => {
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <FirstRunTutorial {...props} voiceModelDownloading voiceModelReady={false} />,
      );
    });

    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'first_run_next' }).props.onPress());
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'first_run_next' }).props.onPress());
    const start = renderer.root.findByProps({ testID: 'first_run_start' });
    expect(start.props.disabled).not.toBe(true);
    ReactTestRenderer.act(() => start.props.onPress());
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });
});
