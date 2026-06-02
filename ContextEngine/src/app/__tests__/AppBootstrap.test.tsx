import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockLoadContext = jest.fn(async () => undefined);
const mockInitializeEngine = jest.fn(async () => undefined);
const mockSetCaptureSetting = jest.fn();
const mockStartCapture = jest.fn(async () => undefined);
const mockStopCapture = jest.fn(async () => undefined);
const mockSetPath = jest.fn();

jest.mock('../../core/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      loadContext: mockLoadContext,
      initializeEngine: mockInitializeEngine,
      startCapture: mockStartCapture,
      stopCapture: mockStopCapture,
      setCaptureSetting: mockSetCaptureSetting,
    }),
}));

jest.mock('../../modules/ContextManager', () => ({
  ContextManager: {
    setPath: mockSetPath,
  },
}));

const { useAppBootstrap, CONTEXT_PATH } = require('../AppBootstrap') as typeof import('../AppBootstrap');

function HookHarness() {
  useAppBootstrap();
  return null;
}

describe('useAppBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('eagerly initializes audio while keeping synthesis lazy during boot', async () => {
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness />);
    });

    expect(mockSetPath).toHaveBeenCalledWith(CONTEXT_PATH);
    expect(mockLoadContext).toHaveBeenCalledTimes(1);
    expect(mockSetCaptureSetting).toHaveBeenCalledWith('pushToRecordEnabled', true);
    expect(mockInitializeEngine).toHaveBeenCalledWith({
      eagerAudio: true,
      eagerSynthesis: false,
    });
  });
});
