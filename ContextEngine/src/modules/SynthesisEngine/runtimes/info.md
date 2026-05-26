# `src/modules/SynthesisEngine/runtimes` Architecture

This directory defines runtime-neutral synthesis contracts and implementations.

## Files

- `types.ts`: `SynthesisRuntime`, `RuntimeReadiness`, `SynthesizedThought`, LiteRT config, and output normalization helpers.
- `LiteRtSynthesisRuntime.ts`: TypeScript wrapper around `NativeModules.LiteRtModule`.
- `RawFallbackSynthesisRuntime.ts`: returns raw transcript under `Inbox`.

## LiteRT Runtime

- iOS-only at this stage.
- Requires `NativeModules.LiteRtModule`.
- Checks primary downloaded model path first.
- May use bundled `test_lm.litertlm` as a demo fallback when present.
- Calls native `loadModel`, `synthesize`, `benchmark`, and `release`.

## Output Contract

Model output should normalize to:

```ts
{
  topic: string;
  refinedText: string;
  tags: string[];
  source: 'litert' | 'raw-fallback';
}
```

Invalid or incomplete output should not block persistence.
