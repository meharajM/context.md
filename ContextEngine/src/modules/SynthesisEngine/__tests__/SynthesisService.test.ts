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

  it('uses heuristic synthesis when LiteRT is disabled', async () => {
    SynthesisService.configure({ liteRtEnabled: false });

    const readiness = await SynthesisService.initialize();
    const thought = await SynthesisService.synthesize('remember to buy filters', []);

    expect(readiness).toMatchObject({
      available: true,
      status: 'ready',
      detail: 'Heuristic offline synthesis is active.',
    });
    expect(thought).toEqual({
      topic: 'Errands',
      refinedText: 'Remember to buy filters.',
      tags: ['errands', 'shopping', 'remember'],
      source: 'raw-fallback',
    });
    expect(NativeModules.LiteRtModule.isAvailable).not.toHaveBeenCalled();
  });

  it('uses heuristic synthesis when the LiteRT-LM model is missing', async () => {
    SynthesisService.configure({ liteRtEnabled: true });
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
      topic: 'Work',
      refinedText: 'Project status needs a short update.',
      tags: ['work', 'project', 'status'],
      source: 'raw-fallback',
    });
  });

  it('uses the bundled demo model when the downloaded model is missing', async () => {
    SynthesisService.configure({ liteRtEnabled: true });
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
    SynthesisService.configure({ liteRtEnabled: true });
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
    expect(NativeModules.LiteRtModule.synthesize).toHaveBeenCalledTimes(1);
    expect(NativeModules.LiteRtModule.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: 'remember to buy filters',
        existingTopics: [],
      }),
    );
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

  it('uses a second refinement pass when existing topics are available', async () => {
    SynthesisService.configure({ liteRtEnabled: true });
    (NativeModules.LiteRtModule.isAvailable as jest.Mock).mockResolvedValue(true);
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (NativeModules.LiteRtModule.synthesize as jest.Mock)
      .mockResolvedValueOnce({
        topic: 'Tasks',
        refinedText: 'Remember to buy filters.',
        tags: ['task'],
      })
      .mockResolvedValueOnce({
        topic: 'Errands',
        refinedText: 'Buy replacement water filters tomorrow.',
        tags: ['task', 'errands'],
      });

    await SynthesisService.initialize();
    const thought = await SynthesisService.synthesize('remember to buy filters', ['Home', 'Errands']);

    expect(NativeModules.LiteRtModule.synthesize).toHaveBeenCalledTimes(2);
    expect(NativeModules.LiteRtModule.synthesize).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        transcript: 'remember to buy filters',
        existingTopics: ['Home', 'Errands'],
      }),
    );
    expect(NativeModules.LiteRtModule.synthesize).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        transcript: 'Remember to buy filters.',
        existingTopics: ['Tasks', 'Home', 'Errands'],
      }),
    );
    expect(thought).toEqual({
      topic: 'Errands',
      refinedText: 'Buy replacement water filters tomorrow.',
      tags: ['task', 'errands'],
      source: 'litert',
    });
  });

  it('uses the selected topic in a single synthesis pass when one is provided', async () => {
    SynthesisService.configure({ liteRtEnabled: true });
    (NativeModules.LiteRtModule.isAvailable as jest.Mock).mockResolvedValue(true);
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (NativeModules.LiteRtModule.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Work',
      refinedText: 'Finish the report.',
      tags: ['work'],
    });

    await SynthesisService.initialize();
    const thought = await SynthesisService.synthesize('finish the report', ['Home', 'Errands'], 'Work');

    expect(NativeModules.LiteRtModule.synthesize).toHaveBeenCalledTimes(1);
    expect(NativeModules.LiteRtModule.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: 'finish the report',
        existingTopics: ['Work', 'Home', 'Errands'],
      }),
    );
    expect(thought).toEqual({
      topic: 'Work',
      refinedText: 'Finish the report.',
      tags: ['work'],
      source: 'litert',
    });
  });

  it('falls back to heuristic synthesis and marks LiteRT not ready after native synthesis rejects', async () => {
    SynthesisService.configure({ liteRtEnabled: true });
    (NativeModules.LiteRtModule.isAvailable as jest.Mock).mockResolvedValue(true);
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (NativeModules.LiteRtModule.synthesize as jest.Mock).mockRejectedValue(new Error('native bridge failed'));

    const readiness = await SynthesisService.initialize();
    const thought = await SynthesisService.synthesize('capture survives native failure', []);

    expect(readiness).toMatchObject({
      available: true,
      status: 'ready',
    });
    expect(thought).toEqual({
      topic: 'Capture Survives',
      refinedText: 'Capture survives native failure.',
      tags: ['capture', 'survives', 'native'],
      source: 'raw-fallback',
    });
    expect(SynthesisService.getLiteRtReadiness()).toMatchObject({
      available: false,
      status: 'error',
      nativeState: {
        crashRisk: true,
        code: 'LITERT_SYNTHESIS_FAILED',
      },
    });
  });
});
