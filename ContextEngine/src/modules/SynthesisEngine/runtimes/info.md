# `src/modules/SynthesisEngine/runtimes` Architecture

This directory defines runtime-neutral synthesis contracts and implementations.

## Files

- `types.ts`: `SynthesisRuntime`, `RuntimeReadiness`, `SynthesizedThought`, `TopicContext`, LiteRT config, and output normalization helpers.
- `LiteRtSynthesisRuntime.ts`: TypeScript wrapper around `NativeModules.LiteRtModule`.
- `RawFallbackSynthesisRuntime.ts`: returns raw transcript under `Inbox`.

## LiteRT Runtime

- Native iOS and Android bridges; Android pins LiteRT-LM 0.14.0.
- Requires `NativeModules.LiteRtModule`.
- Checks primary downloaded model path first.
- May use bundled `test_lm.litertlm` as a demo fallback when present.
- Calls native `loadModel`, `synthesize`, `benchmark`, and `release`.
- Runs separate bounded summary and routing prompts built by `SynthesisEngine`; `SynthesisService` owns complete-input chunking, reduction, and all-topic comparisons. It rejects prompts above 640 UTF-8 bytes (or configured context minus 384) before calling native code.
- Routing prompts require semantic comparison against numbered candidates and bounded persisted topic context. `needsClarification` plus a focused question and 2–3 candidate IDs supports ambiguity; the service resolves IDs back to complete original topic names.
- Wraps native synthesis in a JavaScript timeout as a second line of defense.
- Marks the runtime unready after native synthesis failure or timeout. `SynthesisService` then persists the thought through raw `Inbox` fallback and exposes error/crash-risk details through `RuntimeReadiness`.

## Output Contract

Model output should normalize to:

```ts
{
  topic: string;
  refinedText: string; // complete original capture
  summary?: string; // successful concise model output only
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

## Bounds and bridge compatibility

The existing native JSON `refinedText` field carries the model's short summary on summary calls. The TypeScript boundary translates that wire field into `summary` and always puts original input into public `refinedText`. Routing calls use `refinedText: "-"` solely to preserve the existing native schema; this value never becomes a stored summary.

A successful summary must be nonempty and no larger than 240 UTF-8 bytes (the prompt requests 120). Invalid native results, including explicit `source: "raw-fallback"`, cannot produce a public summary. The native parser requires nonempty topic and summary fields; omitted optional tags become an empty array.

The default 1,024 `maxNumTokens` covers input **plus output**. The 640-byte prompt envelope reserves 128 tokens for the concise native system instruction/template and 256 for JSON output. LiteRT-LM 0.14.0 has no `ConversationConfig.maxOutputToken` or preflight tokenizer exposed by the pinned Android API; the output allowance is a prompt budget, not a native decode cap. Overlong, malformed, truncated, or failed responses safely return raw input; context-limit exceptions can trigger bounded split retries. Neither context size nor device RAM recommendations were raised.

Large captures/libraries require many serial calls, potentially minutes. Model initialization begins after the note is durable in Inbox and has a 180-second native and JavaScript limit; native inference times out after 60 seconds per call, with a 65-second JavaScript guard. Availability checks and release keep their 30-second limit. Lock wait and completed initialization steps refresh the queue’s 35-second idle watchdog; expired attempts are skipped after acquiring the lock. OS process termination still recovers from durable Inbox notes, and real-device output quality/latency needs hardware validation.
