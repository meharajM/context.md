import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';

import { SynthesisService } from '../SynthesisService';

describe('SynthesisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SynthesisService.resetForTests();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (NativeModules.LiteRtModule.isAvailable as jest.Mock).mockResolvedValue(false);
  });

  it('uses raw Inbox fallback when LiteRT is disabled', async () => {
    SynthesisService.configure({ liteRtEnabled: false });

    const thought = await SynthesisService.synthesize('remember to buy filters', []);

    expect(thought).toEqual({
      topic: 'Inbox',
      refinedText: 'remember to buy filters',
      tags: ['fallback'],
      source: 'raw-fallback',
    });
    expect(NativeModules.LiteRtModule.isAvailable).not.toHaveBeenCalled();
  });

  it('uses raw Inbox fallback when the LiteRT-LM model is missing', async () => {
    (NativeModules.LiteRtModule.isAvailable as jest.Mock).mockResolvedValue(true);
    (RNFS.exists as jest.Mock).mockResolvedValue(false);

    const readiness = await SynthesisService.initialize();
    const thought = await SynthesisService.synthesize('project status needs a short update', []);

    expect(readiness).toMatchObject({
      available: false,
      status: 'unavailable',
      missingModels: expect.any(Array),
    });
    expect(thought).toEqual({
      topic: 'Inbox',
      refinedText: 'project status needs a short update',
      tags: ['fallback'],
      source: 'raw-fallback',
    });
  });

  it('uses the bundled demo model when the downloaded model is missing', async () => {
    (NativeModules.LiteRtModule.isAvailable as jest.Mock).mockResolvedValue(true);
    (RNFS.exists as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    (NativeModules.LiteRtModule.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Demo',
      refinedText: 'Bundled fallback works.',
      tags: ['demo'],
    });

    const readiness = await SynthesisService.initialize();
    const thought = await SynthesisService.synthesize('bundled fallback works', []);

    expect(readiness).toMatchObject({
      available: true,
      status: 'ready',
      detail: 'LiteRT-LM model loaded from bundled demo fallback.',
      missingModels: expect.arrayContaining([expect.stringContaining('gemma3-1b-it-int4.litertlm')]),
    });
    expect(NativeModules.LiteRtModule.loadModel).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPath: expect.stringContaining('test_lm.litertlm'),
      }),
    );
    expect(thought).toEqual({
      topic: 'Demo',
      refinedText: 'Bundled fallback works.',
      tags: ['demo'],
      source: 'litert',
    });
  });

  it('uses LiteRT-LM output when the native runtime is available', async () => {
    (NativeModules.LiteRtModule.isAvailable as jest.Mock).mockResolvedValue(true);
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (NativeModules.LiteRtModule.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Tasks',
      refinedText: 'Remember to buy filters.',
      tags: ['task'],
    });

    const readiness = await SynthesisService.initialize();
    const thought = await SynthesisService.synthesize('remember to buy filters', []);

    expect(readiness).toMatchObject({
      available: true,
      status: 'ready',
    });
    expect(NativeModules.LiteRtModule.loadModel).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPath: expect.stringContaining('gemma3-1b-it-int4.litertlm'),
        backend: 'cpu',
      }),
    );
    expect(thought).toEqual({
      topic: 'Tasks',
      refinedText: 'Remember to buy filters.',
      tags: ['task'],
      source: 'litert',
    });
  });
});
