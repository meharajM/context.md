import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockLoadContext = jest.fn(async () => undefined);
const mockInitializeEngine = jest.fn(async () => undefined);
const mockHydratePreferences = jest.fn(async () => undefined);
const mockSetCaptureSetting = jest.fn();
const mockStartCapture = jest.fn(async () => undefined);
const mockStopCapture = jest.fn(async () => undefined);
const mockSetPath = jest.fn();

jest.mock('../../core/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      loadContext: mockLoadContext,
      initializeEngine: mockInitializeEngine,
      hydratePreferences: mockHydratePreferences,
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

const {
  useAppBootstrap,
  CONTEXT_PATH,
  LEGACY_CONTEXT_PATH,
} = require('../AppBootstrap') as typeof import('../AppBootstrap');

function HookHarness() {
  useAppBootstrap();
  return null;
}

describe('useAppBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes synthesis and requeues Inbox without enabling or initializing voice', async () => {
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness />);
    });

    expect(mockSetPath).toHaveBeenCalledWith(CONTEXT_PATH, {
      legacyPath: LEGACY_CONTEXT_PATH,
    });
    expect(mockLoadContext).toHaveBeenCalledTimes(1);
    expect(mockHydratePreferences).toHaveBeenCalledTimes(1);
    expect(mockSetCaptureSetting).not.toHaveBeenCalled();
    expect(mockStartCapture).not.toHaveBeenCalled();
    expect(mockInitializeEngine).toHaveBeenCalledWith({
      eagerAudio: false,
      eagerSynthesis: true,
    });
  });
});
