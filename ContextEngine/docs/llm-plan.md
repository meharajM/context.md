# Gemma LLM Download and Invocation Plan

Date: 2026-05-27
Scope: iOS-first LiteRT-LM synthesis for Context Engine

## Goal

Set up a reliable local Gemma model path for Context Engine so captured thoughts can be synthesized on device into structured `context.md` entries.

The model pipeline must preserve the project invariant:

- Every non-empty captured thought is persisted.
- LiteRT-LM success may refine and categorize the thought.
- LiteRT-LM failure must fall back to raw `Inbox` persistence.
- UI, queue, settings, and persistence code must not call native LiteRT directly.

## Current Runtime Shape

LiteRT-LM should follow this flow:

1. Resolve a local `.litertlm` model path under app storage.
2. Build native `EngineConfig` with:
   - `modelPath`
   - `backend`
   - `maxNumTokens`
   - writable `cacheDir`
3. Initialize `Engine` off the UI thread.
4. Create a lightweight `Conversation` with:
   - `ConversationConfig`
   - system message
   - `SamplerConfig`
5. Invoke `conversation.sendMessage(...)`.
6. Parse model output as JSON.
7. Normalize malformed output to raw `Inbox` fallback.
8. Release the model safely when needed.

Relevant files:

- `src/modules/SynthesisEngine/models.ts`
- `src/modules/SynthesisEngine/modelManager.ts`
- `src/modules/SynthesisEngine/SynthesisService.ts`
- `src/modules/SynthesisEngine/runtimes/LiteRtSynthesisRuntime.ts`
- `src/modules/SynthesisEngine/runtimes/types.ts`
- `src/modules/SynthesisEngine/ProcessingQueueManager.ts`
- `ios/ContextEngine/LiteRtModule.swift`
- `docs/litert-evaluation.md`

## Phase 1 - Model Catalog Contract

Keep `src/modules/SynthesisEngine/models.ts` as the source of truth for model metadata.

Current default:

```ts
{
  id: 'gemma3-1b-it',
  name: 'Gemma3-1B-IT',
  modelId: 'lotapa/gemma3-1b-it-int4.litertlm',
  modelFile: 'gemma3-1b-it-int4.litertlm',
  sizeInBytes: 584417280,
  minDeviceMemoryInGb: 4,
  backend: 'cpu',
  maxTokens: 1024,
  topK: 64,
  topP: 0.95,
  temperature: 0.2,
  recommended: true,
}
```

Required metadata additions:

```ts
interface SynthesisModelDescriptor {
  id: string;
  name: string;
  modelId: string;
  modelFile: string;
  description: string;
  sizeInBytes: number;
  expectedSha256: string;
  sourceUrl: string;
  license: string;
  minDeviceMemoryInGb: number;
  backend: 'cpu' | 'gpu';
  maxTokens: number;
  topK: number;
  topP: number;
  temperature: number;
  taskTypes: string[];
  bestForTaskTypes?: string[];
  recommended?: boolean;
}
```

Implementation details:

- Add `expectedSha256`, `sourceUrl`, and `license` before marking model setup release-ready.
- Keep `Gemma3-1B-IT` as the only enabled model until download verification and crash-free synthesis pass.
- Add future Gemma variants behind capability gates, not as default visible options.
- Default to `cpu` on simulator. Treat simulator GPU as unsupported unless proven stable.
- Use `maxTokens: 1024` for now because the output contract is compact JSON and captured thoughts are short.

Future catalog order:

1. `Gemma3-1B-IT`: default, release target, low memory.
2. Larger Gemma text model: optional after device memory detection exists.
3. Multimodal Gemma: deferred until text-only MVP is stable.

Acceptance:

- The model catalog fully describes source, license, size, checksum, runtime config, and device requirements.
- Settings can display install status without hard-coded model details elsewhere.

## Phase 2 - Download and Verification

Update `src/modules/SynthesisEngine/modelManager.ts`.

Current behavior:

- Downloads to `<model>.download`.
- Checks HTTP status.
- Moves file to final path.

Required behavior:

1. Ensure `Documents/models` exists.
2. Remove stale `.download` file before fresh download.
3. Download to:

```text
Documents/models/<modelFile>.download
```

4. Show progress in settings.
5. Verify status code is 2xx.
6. Verify final downloaded byte size equals `sizeInBytes`.
7. Compute SHA-256 and compare with `expectedSha256`.
8. Move only verified files to:

```text
Documents/models/<modelFile>
```

9. Write install metadata to:

```text
Documents/models/manifest.json
```

Manifest shape:

```json
{
  "gemma3-1b-it": {
    "installedAt": "2026-05-27T00:00:00.000Z",
    "file": "gemma3-1b-it-int4.litertlm",
    "size": 584417280,
    "sha256": "<expected-sha256>",
    "sourceUrl": "https://huggingface.co/...",
    "license": "<license>",
    "verified": true
  }
}
```

Failure handling:

- If HTTP fails, delete the temp file and show a precise status.
- If size check fails, delete the temp file and report expected vs actual bytes.
- If SHA-256 fails, delete the temp file and report checksum mismatch.
- If manifest write fails after model verification, keep the model but mark settings status as `Installed; metadata incomplete`.

Implementation options:

- Prefer a small native hash helper if hashing a 557 MB file is too slow in JS.
- If no native hash helper is available, evaluate whether `react-native-fs` supports hashing in the installed version before adding a new dependency.
- Do not add broad dependencies for checksum only unless the native bridge route is more expensive.

Tests:

- Unit test successful download state transitions.
- Unit test HTTP failure.
- Unit test size mismatch.
- Unit test checksum mismatch.
- Unit test manifest write and read.

Acceptance:

- A downloaded model is not marked installed until size and checksum pass.
- App restart still detects the installed and verified model.
- Partial downloads never appear as usable models.

## Phase 3 - Invocation Pipeline

The invocation boundary remains:

```text
Queue -> SynthesisService -> LiteRtSynthesisRuntime -> LiteRtModule.swift -> LiteRT-LM
```

Do not let these call `LiteRtModule` directly:

- UI components
- settings screens
- queue screen
- `ContextManager`

TypeScript responsibilities:

- `SynthesisService.configure(...)` receives selected model config.
- `SynthesisService.initialize()` initializes LiteRT when enabled and installed.
- `SynthesisService.synthesize(...)` decides between LiteRT and raw fallback.
- `LiteRtSynthesisRuntime.initialize()` checks:
  - platform is iOS
  - native bridge exists
  - bridge reports available
  - model exists
  - native load succeeds
- `LiteRtSynthesisRuntime.synthesize(...)` invokes native synthesis and normalizes output.

Native responsibilities:

- `isAvailable()`: return whether LiteRT-LM is linked.
- `loadModel(config)`: initialize engine and conversation.
- `synthesize(input)`: send prompt and return parsed JSON dictionary.
- `benchmark(fixtures)`: report loaded state and basic config.
- `release()`: clear engine and conversation.

Required stability work:

- Keep all native engine/conversation calls serialized.
- Prevent `release()` from racing with `loadModel()` or `synthesize()`.
- Add native synthesis timeout.
- Add JS synthesis timeout.
- Mark runtime unready after native synthesis failure.
- Reinitialize cleanly after failure instead of reusing a possibly corrupt conversation.
- Keep raw `Inbox` fallback as the final safety net.

Tests:

- LiteRT available and model missing -> raw fallback.
- LiteRT disabled -> raw fallback.
- Native load failure -> raw fallback.
- Native synthesize rejection -> raw fallback.
- Native synthesize timeout -> raw fallback.
- Malformed model JSON -> normalized fallback.

Acceptance:

- A thought never disappears because model loading or invocation fails.
- Queue clears after success, rejection, malformed JSON, or timeout.
- 10 simulator captures create no new `ContextEngine` crash report.

## Phase 4 - Context Engine System Prompt

The model should not act as a general assistant. It should act as a private local filing engine for one captured thought at a time.

Recommended system prompt:

```text
You are Context Engine's private on-device synthesis unit.

Your job is to transform one captured thought into a durable entry for a local context.md knowledge file.

Rules:
- Return JSON only. No markdown, no prose, no code fences.
- Never invent facts, dates, people, links, or tasks that are not present in the input.
- Preserve the user's intent and wording when uncertain.
- Prefer an existing topic when it reasonably fits.
- Create a new topic only when none of the existing topics fit.
- Topic must be 1 to 5 words, title case, and not generic unless necessary.
- refinedText must be one clear sentence or short note.
- tags must be lowercase, short, and derived only from the input.
- If the input is unclear, keep topic as "Inbox" and preserve the raw thought.
- If the input contains sensitive personal context, do not summarize away important details.
- The output must match this exact JSON shape:
{"topic":"Topic","refinedText":"Clear thought","tags":["tag"]}
```

Recommended per-thought prompt:

```text
Existing topics:
<topic list>

Captured thought:
<transcript>

Return the JSON object now.
```

Implementation details:

- Move prompt strings out of inline Swift literals into a small prompt builder if they keep growing.
- Keep prompt construction native if the native conversation owns `systemMessage`.
- Keep prompt construction TypeScript-side if tests need easy prompt snapshots.
- Escape or delimit transcript and topic values to reduce prompt injection risk.
- Add a parser fallback for extra text around JSON, but the system prompt should still demand JSON only.

Prompt-specific rules:

- Do not ask the model to write markdown.
- Do not ask the model to infer tasks unless the user explicitly captured a task.
- Do not let the model create broad topics like `General`, `Notes`, or `Misc` unless fallback is unavoidable.
- Prefer `Inbox` over a bad invented topic.
- Keep `refinedText` close to the transcript.

Examples:

Input:

```text
Existing topics:
Inbox, Work, Family

Captured thought:
remember to ask Priya about the Q3 invoice tomorrow
```

Expected output:

```json
{"topic":"Work","refinedText":"Remember to ask Priya about the Q3 invoice tomorrow.","tags":["invoice","q3"]}
```

Input:

```text
Existing topics:
Inbox, Ideas

Captured thought:
blue thing near window maybe
```

Expected output:

```json
{"topic":"Inbox","refinedText":"blue thing near window maybe","tags":["unclear"]}
```

## Phase 5 - Settings UX for Model State

Settings must make model state clear without exposing implementation noise.

States:

- `Not downloaded`
- `Downloading <percent>%`
- `Verifying`
- `Ready on device`
- `Installed; metadata incomplete`
- `Download failed`
- `Verification failed`
- `Unsupported on this device`

Actions:

- `Install`
- `Cancel` if cancellation is implemented
- `Delete`
- `Use model`
- `Retry`

Rules:

- If the selected model is missing, manual capture stays enabled.
- If the selected model fails verification, synthesis should be unavailable and raw fallback should persist captures.
- If LiteRT is disabled in settings, do not initialize native LiteRT.
- If model is installed but native load fails, show `AI Offline` and keep capture usable.

Acceptance:

- Users can understand whether model setup is complete.
- Users can recover from failed download without manually deleting files.
- Capture remains usable in every model state.

## Phase 6 - Validation Gates

Before marking Gemma model setup complete:

- Fresh install with no model shows model missing and manual capture persists to `Inbox`.
- Gemma3-1B-IT download completes.
- Size verification passes.
- SHA-256 verification passes.
- Manifest is written.
- App restart detects verified model.
- Manual thought invokes Gemma and persists under a sensible topic.
- Malformed model output falls back to raw `Inbox`.
- Native LiteRT timeout falls back to raw `Inbox`.
- Native LiteRT rejection falls back to raw `Inbox`.
- 10 simulator captures produce no new `ContextEngine` crash report.
- `npm run typecheck -- --pretty false` passes.
- `npm run lint` passes.
- `npm test -- --runInBand` passes.
- Simulator smoke test passes once added.

## Implementation Order

1. Add model metadata fields and update model catalog tests.
2. Add verified download and manifest handling.
3. Harden LiteRT invocation timeout and fallback behavior.
4. Replace current system prompt with the Context Engine prompt contract.
5. Add prompt parser tests and malformed-output tests.
6. Update settings model states.
7. Add simulator smoke coverage for install, invoke, queue clear, and crash-free validation.
8. Update `README.md`, `docs/litert-evaluation.md`, and implementation tracker evidence only after gates pass.

## Non-Goals

- No cloud model fallback.
- No OpenAI or Ollama path.
- No Android NPU implementation in this phase.
- No background or lock-screen wake-word work.
- No committing `.litertlm` model binaries.
- No agent sync or external context upload.
