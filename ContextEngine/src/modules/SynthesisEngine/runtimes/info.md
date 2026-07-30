# `src/modules/SynthesisEngine/runtimes` Architecture

This directory defines runtime-neutral synthesis contracts and implementations.

## Files

- `types.ts`: `SynthesisRuntime`, `RuntimeReadiness`, `SynthesizedThought`, `TopicContext`, LiteRT config, and output normalization helpers.
- `LiteRtSynthesisRuntime.ts`: TypeScript wrapper around `NativeModules.LiteRtModule`.
- `RawFallbackSynthesisRuntime.ts`: returns raw transcript under `Inbox`.

## LiteRT Runtime

- iOS-only at this stage.
- Requires `NativeModules.LiteRtModule`.
- Checks primary downloaded model path first.
- May use bundled `test_lm.litertlm` as a demo fallback when present.
- Calls native `loadModel`, `synthesize`, `benchmark`, and `release`.
- Builds prompts from candidate topic names and the persisted content of the relevant selected/identified topic.
- The prompt requires semantic comparison against persisted topic context and supports a clarification contract: `needsClarification` plus a focused question and 2–3 topic options.
- Wraps native synthesis in a JavaScript timeout as a second line of defense.
- Marks the runtime unready after native synthesis failure or timeout. `SynthesisService` then persists the thought through raw `Inbox` fallback and exposes error/crash-risk details through `RuntimeReadiness`.

## Output Contract

Model output should normalize to:

```ts
{
  topic: string;
  refinedText: string;
  tags: string[];
  source: 'litert' | 'raw-fallback';
  clarification?: {
    question: string;
    options: Array<{ topic: string; reason?: string }>;
  };
}
```

Invalid or incomplete output should not block persistence.
`raw-fallback` output is always the original trimmed transcript under `Inbox`; it is not a heuristic synthesis result.
