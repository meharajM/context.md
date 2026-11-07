import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';

import { SynthesisService } from '../SynthesisService';
import { MAX_PROMPT_BYTES, utf8Length } from '../index';

const native = NativeModules.LiteRtModule;
const infer = native.synthesize as jest.Mock;
const summary = (text = 'Buy replacement filters.') => ({ topic: 'Water Filters', refinedText: text, tags: ['task'] });
const route = (topic: string) => ({ topic, refinedText: '-', tags: [] });
const raw = (text: string) => ({ topic: 'Inbox', refinedText: text, tags: ['fallback'], source: 'raw-fallback' });
const enable = () => {
  (native.isAvailable as jest.Mock).mockResolvedValue(true);
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
};

describe('SynthesisService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    SynthesisService.resetForTests();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (native.isAvailable as jest.Mock).mockResolvedValue(false);
  });

  it('keeps disabled captures raw even with a selected topic', async () => {
    SynthesisService.configure({ liteRtEnabled: false });
    await expect(SynthesisService.synthesize('buy filters', ['Work'], 'Work')).resolves.toEqual(raw('buy filters'));
    expect(native.isAvailable).not.toHaveBeenCalled();
  });

  it('runs reminder extraction through the existing loaded model without changing topic output', async () => {
    enable();
    native.extractReminder = jest.fn().mockResolvedValue('{"task":true,"title":"Buy eggs"}');
    expect(await SynthesisService.extractReminder('Extract reminder JSON')).toBe('{"task":true,"title":"Buy eggs"}');
    infer.mockResolvedValue(summary());
    expect(await SynthesisService.synthesize('buy filters', [])).toMatchObject({ refinedText: 'buy filters', summary: 'Buy replacement filters.' });
    expect(native.loadModel).toHaveBeenCalledTimes(1);
  });

  it('never overlaps reminder inference with ordinary topic inference', async () => {
    enable();
    let finish!: (value: string) => void;
    let started!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    native.extractReminder = jest.fn().mockImplementation(() => {
      started(); return new Promise<string>(resolve => { finish = resolve; });
    });
    const reminder = SynthesisService.extractReminder('Extract reminder JSON');
    await began;
    infer.mockResolvedValue(summary());
    const topic = SynthesisService.synthesize('buy filters', []);
    await Promise.resolve();
    expect(infer).not.toHaveBeenCalled();
    finish('{"task":false}');
    await reminder;
    expect(await topic).toMatchObject({ refinedText: 'buy filters', source: 'litert' });
  });

  it('reloads ordinary topic processing after reminder model failure', async () => {
    enable();
    native.extractReminder = jest.fn().mockRejectedValue(new Error('reminder inference failed'));
    await expect(SynthesisService.extractReminder('Extract reminder JSON')).rejects.toThrow('reminder inference failed');
    infer.mockResolvedValue(summary());
    await expect(SynthesisService.synthesize('buy filters', [])).resolves.toMatchObject({ refinedText: 'buy filters', source: 'litert' });
    expect(native.loadModel).toHaveBeenCalledTimes(2);
  });

  it('uses raw fallback when the model is missing', async () => {
    (native.isAvailable as jest.Mock).mockResolvedValue(true);
    await expect(SynthesisService.synthesize('buy filters', [])).resolves.toEqual(raw('buy filters'));
    expect(SynthesisService.getLiteRtReadiness()).toMatchObject({ available: false, missingModels: expect.any(Array) });
  });

  it('can load the bundled fallback and returns original plus a separate AI summary', async () => {
    enable();
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    infer.mockResolvedValue(summary());
    await expect(SynthesisService.synthesize('remember to buy replacement filters tomorrow', [])).resolves.toEqual({
      topic: 'Water Filters', refinedText: 'remember to buy replacement filters tomorrow',
      summary: 'Buy replacement filters.', tags: ['task'], source: 'litert',
    });
    expect(native.loadModel).toHaveBeenCalledWith(expect.objectContaining({ modelPath: expect.stringContaining('test_lm.litertlm'), maxTokens: 1024 }));
    expect(infer).toHaveBeenCalledTimes(1);
  });

  it('uses only the selected topic and its latest context in one short call', async () => {
    enable();
    infer.mockResolvedValue(summary('Finish the report.'));
    const thought = await SynthesisService.synthesize('finish the report', ['Work', 'Home'], 'Work', [
      { topic: 'Work', content: 'Quarterly report.' }, { topic: 'Home', content: 'Private unrelated context.' },
    ]);
    expect(thought).toMatchObject({ topic: 'Work', refinedText: 'finish the report', summary: 'Finish the report.' });
    expect(infer).toHaveBeenCalledTimes(1);
    expect(infer.mock.calls[0][0].existingTopics).toEqual(['Work']);
    expect(infer.mock.calls[0][0].prompt).toContain('Quarterly report.');
    expect(infer.mock.calls[0][0].prompt).not.toContain('Private unrelated context.');
  });

  it('accepts an unrouteable summary label before applying the selected topic', async () => {
    enable();
    infer.mockResolvedValue({ topic: 'Inbox', refinedText: 'Plan the garden visit.', tags: [] });
    await expect(SynthesisService.synthesize('Plan the garden visit.', [], 'Community Garden')).resolves.toMatchObject({
      topic: 'Community Garden',
      refinedText: 'Plan the garden visit.',
      summary: 'Plan the garden visit.',
      source: 'litert',
    });
  });

  it('summarizes before comparing existing topic context', async () => {
    enable();
    infer.mockResolvedValueOnce(summary()).mockResolvedValueOnce(route('T2'));
    const thought = await SynthesisService.synthesize('buy filters tomorrow', ['Home', 'Errands'], null, [
      { topic: 'Home', content: 'Repair kitchen faucet.' }, { topic: 'Errands', content: 'Buy groceries.' },
    ]);
    expect(thought).toMatchObject({ topic: 'Errands', refinedText: 'buy filters tomorrow', summary: 'Buy replacement filters.' });
    expect(infer).toHaveBeenCalledTimes(2);
    expect(infer.mock.calls[1][0].prompt).toContain('T2: Errands | Buy groceries.');
  });

  it('resolves an exact candidate name when the model returns it instead of its T identifier', async () => {
    enable();
    infer.mockResolvedValueOnce(summary('Organize the volunteer workday.'))
      .mockResolvedValueOnce(route('community garden'));

    const thought = await SynthesisService.synthesize(
      'Coordinate the garden volunteers.',
      ['Community Garden'],
      null,
      [{ topic: 'Community Garden', content: 'Prepare the garden for volunteers.' }],
    );

    expect(thought).toMatchObject({ topic: 'Community Garden', source: 'litert' });
  });

  it('covers every long-input byte before reducing summaries and retains the entire original', async () => {
    enable();
    const transcript = `FIRST ${'🌿漢字NoSpaces'.repeat(350)} LAST`;
    infer.mockResolvedValue(summary('Preserved intent.'));
    const progress = jest.fn();
    const thought = await SynthesisService.synthesize(transcript, [], null, [], { onProgress: progress });
    const originalChunks: string[] = [];
    let consumed = 0;
    for (const [call] of infer.mock.calls) {
      expect(utf8Length(call.prompt)).toBeLessThanOrEqual(MAX_PROMPT_BYTES);
      if (consumed < transcript.length) {
        originalChunks.push(call.transcript);
        consumed += call.transcript.length;
      }
    }
    expect(originalChunks.join('')).toBe(transcript);
    expect(infer.mock.calls.length).toBeGreaterThan(originalChunks.length);
    expect(thought).toMatchObject({ refinedText: transcript, summary: 'Preserved intent.', source: 'litert' });
    expect(progress.mock.calls.length).toBeGreaterThanOrEqual(infer.mock.calls.length + 3);
    expect(native.loadModel).toHaveBeenCalledTimes(1);
  });

  it('includes every generated chunk summary in subsequent reduction input', async () => {
    enable();
    const transcript = 'unbroken-source-'.repeat(200);
    const generated: string[] = [];
    let consumed = 0;
    infer.mockImplementation(async input => {
      if (consumed < transcript.length) {
        consumed += input.transcript.length;
        const text = `Chunk ${generated.length + 1} fact.`;
        generated.push(text);
        return summary(text);
      }
      return summary('Combined key facts.');
    });
    const thought = await SynthesisService.synthesize(transcript, []);
    const reductionInput = infer.mock.calls.slice(generated.length).map(([call]) => call.transcript).join('');
    generated.forEach(text => expect(reductionInput).toContain(text));
    expect(thought).toMatchObject({ refinedText: transcript, summary: 'Combined key facts.' });
  });

  it('scans all topics and can select a semantic match beyond the former first-ten cutoff', async () => {
    enable();
    const topics = Array.from({ length: 27 }, (_, index) => `Topic ${index}`);
    infer.mockImplementation(async input => {
      if (!input.existingTopics.length) return summary('Plan next milestone.');
      const index = input.existingTopics.indexOf('Topic 26');
      return route(index >= 0 ? `T${index + 1}` : 'NEW');
    });
    const thought = await SynthesisService.synthesize('Plan the next milestone.', topics, null,
      topics.map(topic => ({ topic, content: `Persisted ${topic}` })));
    const routeCalls = infer.mock.calls.map(([call]) => call).filter(call => call.existingTopics.length);
    expect(new Set(routeCalls.flatMap(call => call.existingTopics))).toEqual(new Set(topics));
    routeCalls.forEach(call => expect(utf8Length(call.prompt)).toBeLessThanOrEqual(MAX_PROMPT_BYTES));
    expect(thought.topic).toBe('Topic 26');
  });

  it('does not choose a proposed new topic until every existing topic was compared', async () => {
    enable();
    const topics = Array.from({ length: 30 }, (_, index) => `Topic ${index}`);
    infer.mockImplementation(async input => input.existingTopics.length ? route('NEW') : summary());
    const thought = await SynthesisService.synthesize('buy filters', ['Inbox', ...topics, 'topic 0']);
    expect(new Set(infer.mock.calls.flatMap(([call]) => call.existingTopics))).toEqual(new Set(topics));
    expect(thought.topic).toBe('Water Filters');
  });

  it('keeps a note in Inbox when routing rejects every topic but summary repeats an existing topic', async () => {
    enable();
    infer.mockResolvedValueOnce({ topic: 'Health', refinedText: 'Buy coffee tomorrow.', tags: ['task'] })
      .mockResolvedValueOnce(route('NEW'));

    const thought = await SynthesisService.synthesize(
      'Remember to buy coffee tomorrow.',
      ['Health', 'Home energy'],
      null,
      [
        { topic: 'Health', content: 'Exercise and wellbeing.' },
        { topic: 'Home energy', content: 'Compare solar panel costs.' },
      ],
    );

    expect(thought.topic).toBe('Inbox');
    expect(infer.mock.calls[1][0].prompt).toContain('Food/drink purchases are not Health without medical intent');
  });

  it('does not offer Health for a non-medical food purchase even if the model selects the first candidate', async () => {
    enable();
    infer.mockResolvedValueOnce({ topic: 'Health', refinedText: 'Buy coffee tomorrow.', tags: ['task'] })
      .mockResolvedValueOnce(route('T1'));

    const thought = await SynthesisService.synthesize('Remember to buy coffee tomorrow.', ['Health', 'Shopping']);

    expect(infer.mock.calls[1][0].existingTopics).toEqual(['Shopping']);
    expect(thought.topic).toBe('Shopping');
  });

  it('keeps Health eligible for food purchases with explicit medical intent', async () => {
    enable();
    infer.mockResolvedValueOnce({ topic: 'Health', refinedText: 'Buy tea for my migraine.', tags: ['task'] })
      .mockResolvedValueOnce(route('T1'));

    const thought = await SynthesisService.synthesize('Buy tea for my migraine.', ['Health', 'Shopping']);

    expect(infer.mock.calls[1][0].existingTopics).toEqual(['Health', 'Shopping']);
    expect(thought.topic).toBe('Health');
  });

  it('carries earlier matches forward for comparison with later candidates', async () => {
    enable();
    const topics = Array.from({ length: 50 }, (_, index) => `Topic ${index}`);
    infer.mockImplementation(async input => input.existingTopics.length ? route('T1') : summary());
    expect((await SynthesisService.synthesize('buy filters', topics)).topic).toBe('Topic 0');
    const calls = infer.mock.calls.slice(1);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every(([call]) => call.existingTopics[0] === 'Topic 0')).toBe(true);
  });

  it('preserves three-way clarification and still examines later candidates', async () => {
    enable();
    const topics = Array.from({ length: 17 }, (_, index) => `Topic ${index} ${'x'.repeat(30)}`);
    infer.mockImplementation(async input => input.existingTopics.length ? {
      ...route('Inbox'), needsClarification: true,
      clarification: { question: 'Which project?', options: ['T1', 'T2', 'T3'].map(topic => ({ topic })) },
    } : summary('Send project update.'));
    const thought = await SynthesisService.synthesize('send update', topics, null,
      topics.map(topic => ({ topic, content: 'x'.repeat(100) })));
    expect(thought).toMatchObject({ topic: 'Inbox', refinedText: 'send update', clarification: {
      question: 'Which project?', options: topics.slice(0, 3).map(topic => ({ topic })),
    } });
    expect(new Set(infer.mock.calls.flatMap(([call]) => call.existingTopics))).toEqual(new Set(topics));
  });

  it.each([
    { topic: 'Work', tags: [] },
    { ...summary(), source: 'raw-fallback' },
    summary('x'.repeat(241)),
  ])('returns full raw capture without a fake summary for invalid output: %j', async output => {
    enable();
    infer.mockResolvedValue(output);
    await expect(SynthesisService.synthesize('full original capture', ['Work'], 'Work')).resolves.toEqual(raw('full original capture'));
  });

  it('accepts a valid summary when the model omits optional tags', async () => {
    enable();
    infer.mockResolvedValue({ topic: 'Work', refinedText: 'Plan the next step.' });
    await expect(SynthesisService.synthesize('Plan the next step.', [], 'Work')).resolves.toMatchObject({
      topic: 'Work',
      refinedText: 'Plan the next step.',
      summary: 'Plan the next step.',
      tags: [],
      source: 'litert',
    });
  });

  it('discards partial summaries if any later chunk fails', async () => {
    enable();
    const transcript = 'Full original. '.repeat(300);
    infer.mockResolvedValueOnce(summary()).mockRejectedValueOnce(new Error('native bridge failed'));
    await expect(SynthesisService.synthesize(transcript, [])).resolves.toEqual(raw(transcript.trim()));
    expect(infer).toHaveBeenCalledTimes(2);
    expect(SynthesisService.getLiteRtReadiness()).toMatchObject({ available: false, status: 'error' });
  });

  it.each([
    route('Inbox'),
    route('General'),
    route('T999'),
    { ...route('Inbox'), needsClarification: true, clarification: { question: 'Which?', options: [{ topic: 'T1' }, { topic: 'T999' }] } },
    { ...route('T1'), needsClarification: true },
    { ...route('T1'), needsClarification: true, clarification: { question: 'Which?', options: [{ topic: 'T1' }] } },
  ])('rejects invented routing IDs and malformed clarification: %j', async output => {
    enable();
    infer.mockResolvedValueOnce(summary()).mockResolvedValueOnce(output);
    await expect(SynthesisService.synthesize('buy filters', ['Work'])).resolves.toEqual(raw('buy filters'));
  });

  it('splits and retries context-limit rejection without dropping any source data', async () => {
    enable();
    const transcript = 'abcd'.repeat(90);
    infer.mockRejectedValueOnce(new Error('Input token limit exceeded')).mockResolvedValue(summary('Key intent.'));
    const thought = await SynthesisService.synthesize(transcript, []);
    expect(thought).toMatchObject({ source: 'litert', refinedText: transcript, summary: 'Key intent.' });
    expect(infer.mock.calls[1][0].transcript + infer.mock.calls[2][0].transcript).toBe(transcript);
    expect(native.loadModel).toHaveBeenCalledTimes(2);
  });

  it('bounds repeated context-limit retries and retains the complete original', async () => {
    enable();
    infer.mockRejectedValue(new Error('Context size exceeded'));
    await expect(SynthesisService.synthesize('x'.repeat(400), [])).resolves.toEqual(raw('x'.repeat(400)));
    expect(infer).toHaveBeenCalledTimes(3);
  });

  it('keeps reconfiguration outside the complete multi-call operation', async () => {
    enable();
    infer.mockImplementationOnce(async () => {
      SynthesisService.configure({ liteRtEnabled: false });
      return summary();
    }).mockResolvedValueOnce(route('T1'));
    await expect(SynthesisService.synthesize('buy filters', ['Home'])).resolves.toMatchObject({ topic: 'Home', source: 'litert' });
    expect(infer).toHaveBeenCalledTimes(2);
    expect(SynthesisService.getLiteRtReadiness()).toBeNull();
    await expect(SynthesisService.synthesize('next capture', [])).resolves.toEqual(raw('next capture'));
  });

  it('serializes concurrent captures until all calls for the first capture finish', async () => {
    enable();
    let finish!: (result: ReturnType<typeof summary>) => void;
    infer.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(summary());
    await SynthesisService.initialize();
    const first = SynthesisService.synthesize('first', []);
    const second = SynthesisService.synthesize('second', []);
    await Promise.resolve();
    await Promise.resolve();
    expect(infer).toHaveBeenCalledTimes(1);
    finish(summary());
    await Promise.all([first, second]);
    expect(infer.mock.calls.map(([call]) => call.transcript)).toEqual(['first', 'second']);
  });

  it('ignores clarification when the native flag is false', async () => {
    enable();
    infer.mockResolvedValueOnce(summary()).mockResolvedValueOnce({
      ...route('T1'), needsClarification: false,
      clarification: { question: 'Which?', options: [{ topic: 'T1' }, { topic: 'T2' }] },
    });
    await expect(SynthesisService.synthesize('buy filters', ['Work', 'Home'])).resolves.toMatchObject({ topic: 'Work', source: 'litert' });
  });

  it('accepts a reasonable summary over the requested target', async () => {
    enable();
    infer.mockResolvedValue(summary('x'.repeat(180)));
    await expect(SynthesisService.synthesize('capture', [])).resolves.toMatchObject({ source: 'litert', summary: 'x'.repeat(180), refinedText: 'capture' });
  });

  it('keeps queue progress alive during a slow native inference', async () => {
    jest.useFakeTimers();
    try {
      enable();
      await SynthesisService.initialize();
      let finish!: (value: ReturnType<typeof summary>) => void;
      infer.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
      const progress = jest.fn();
      const result = SynthesisService.synthesize('capture', [], null, [], { onProgress: progress });
      await Promise.resolve();
      expect(infer).toHaveBeenCalledTimes(1);
      const initialProgressCount = progress.mock.calls.length;

      await jest.advanceTimersByTimeAsync(40000);

      expect(progress.mock.calls.length).toBeGreaterThan(initialProgressCount);
      finish(summary());
      await expect(result).resolves.toMatchObject({ source: 'litert', summary: 'Buy replacement filters.' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps waiters alive beyond two watchdog intervals and skips cancelled waiters', async () => {
    jest.useFakeTimers();
    try {
      enable();
      await SynthesisService.initialize();
      infer.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(summary('Short.')), 20000)));
      const first = SynthesisService.synthesize('long '.repeat(450), []);
      let cancelled = false;
      setTimeout(() => { cancelled = true; }, 35000);
      let waitingExpired = false;
      let watchdog: ReturnType<typeof setTimeout>;
      const progress = jest.fn(() => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => { waitingExpired = true; }, 35000);
      });
      progress();
      const expired = SynthesisService.synthesize('expired', [], null, [], { isCancelled: () => cancelled });
      const expiredResult = expired.catch(error => error);
      const waiting = SynthesisService.synthesize('waiting', [], null, [], { onProgress: progress, isCancelled: () => waitingExpired });
      await jest.advanceTimersByTimeAsync(71000);
      expect(progress.mock.calls.length).toBeGreaterThanOrEqual(7);
      expect(waitingExpired).toBe(false);
      await jest.advanceTimersByTimeAsync(300000);
      await first;
      expect((await expiredResult).message).toBe('Synthesis attempt cancelled');
      await waiting;
      clearTimeout(watchdog!);
      expect(infer.mock.calls.some(([input]) => input.transcript === 'expired')).toBe(false);
      expect(infer.mock.calls.some(([input]) => input.transcript === 'waiting')).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('bounds a stuck model load and retains the capture', async () => {
    jest.useFakeTimers();
    try {
      enable();
      (native.loadModel as jest.Mock).mockImplementation(() => new Promise(() => undefined));
      const result = SynthesisService.synthesize('capture', []);
      await jest.advanceTimersByTimeAsync(180001);
      await expect(result).resolves.toEqual(raw('capture'));
    } finally { jest.useRealTimers(); }
  });

  it('bounds a stuck release during reconfiguration', async () => {
    jest.useFakeTimers();
    try {
      (native.release as jest.Mock).mockImplementation(() => new Promise(() => undefined));
      SynthesisService.configure({ liteRtEnabled: false });
      const result = SynthesisService.synthesize('capture', []).catch(error => error);
      await jest.advanceTimersByTimeAsync(30001);
      expect((await result).message).toContain('release timed out');
    } finally { jest.useRealTimers(); }
  });

  it('retains raw data when availability probing throws', async () => {
    (native.isAvailable as jest.Mock).mockRejectedValue(new Error('bridge unavailable'));
    await expect(SynthesisService.synthesize('capture', [])).resolves.toEqual(raw('capture'));
  });

  it('times out a stuck native call and returns the original without a summary', async () => {
    jest.useFakeTimers();
    try {
      enable();
      infer.mockImplementation(() => new Promise(() => undefined));
      await SynthesisService.initialize();
      const result = SynthesisService.synthesize('capture', []);
      await jest.advanceTimersByTimeAsync(65001);
      await expect(result).resolves.toEqual(raw('capture'));
      expect(SynthesisService.getLiteRtReadiness()).toMatchObject({ available: false, status: 'unavailable' });
    } finally {
      jest.useRealTimers();
    }
  });
});
