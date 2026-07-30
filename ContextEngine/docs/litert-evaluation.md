# LiteRT-LM Evaluation

## Direction

Context Engine is LiteRT-only for synthesis. There is no OpenAI, Ollama, cloud API, or local HTTP server validation path.

This follows the same runtime shape used by Google AI Edge Gallery:

- Keep model metadata separate from runtime calls.
- Resolve a local model path under app storage.
- Initialize a LiteRT-LM engine with backend and cache settings.
- Create a conversation with sampler settings.
- Send text into the conversation and parse the model response.
- Keep all inference on device.
- Show a model catalog in the app and let the user download the selected model to the device.

Gallery's Android implementation uses `EngineConfig`, `Engine.initialize()`, `createConversation(...)`, and `conversation.sendMessageAsync(...)` from `com.google.ai.edge.litertlm`. The current LiteRT-LM Swift API exposes the same core concepts with `EngineConfig`, `Engine`, `ConversationConfig`, `SamplerConfig`, and `conversation.sendMessage(...)`.

Sources:

- Google AI Edge Gallery: https://github.com/google-ai-edge/gallery
- Gallery LLM helper: https://github.com/google-ai-edge/gallery/blob/main/Android/src/app/src/main/java/com/google/ai/edge/gallery/ui/llmchat/LlmChatModelHelper.kt
- LiteRT-LM Swift API: https://ai.google.dev/edge/litert-lm/swift

## Current App Contract

Recommended model:

```text
Gemma3-1B-IT
lotapa/gemma3-1b-it-int4.litertlm
gemma3-1b-it-int4.litertlm
```

Expected local synthesis model path:

```text
RNFS.DocumentDirectoryPath/models/gemma3-1b-it-int4.litertlm
```

Default runtime settings:

```text
backend: cpu
maxTokens: 1024
topK: 64
topP: 0.95
temperature: 0.2
cacheDir: RNFS.CachesDirectoryPath/litertlm-cache/gemma3-1b-it
```

The model must return JSON:

```json
{"topic":"Topic","refinedText":"Clear thought","tags":["tag"],"needsClarification":false,"clarification":null}
```

For ambiguous routing, LiteRT may instead return `topic: "Inbox"` plus a focused `clarification.question` and 2–3 `clarification.options`. The queue keeps the item pending until the user selects a topic; this is distinct from raw fallback, which persists without model-backed categorization.

If LiteRT-LM is disabled, missing, not linked, missing its model, or fails at runtime, the app saves the raw transcript to `Inbox`. That fallback is persistence-only; it is not another model runtime.

The iPhone 16 iOS 18.6 simulator currently has Gemma3-1B-IT installed and verified on device. The settings screen shows `Ready on device` for that model, and the app can complete a live manual capture through LiteRT synthesis.

## Runtime Failure Containment

The iOS bridge serializes all LiteRT-LM `Engine`, `Conversation`, `Conversation.sendMessage`, load, and release operations through one native execution queue. `release()` cannot overlap with model loading or synthesis.

Native synthesis has a release-budget timeout and rejects with `LITERT_SYNTHESIS_TIMEOUT` when exceeded. Rejections include model path, backend, max token count, and LiteRT state. After any native load or synthesis error, the bridge clears `conversation` and `engine` so a possibly corrupted native runtime is not reused.

The TypeScript runtime also wraps `LiteRtModule.synthesize(...)` in a JavaScript timeout. Any native synthesis failure marks LiteRT readiness as not available with crash-risk details, and the current thought is saved through raw `Inbox` fallback.

The processing queue keeps `MAX_ATTEMPTS = 2`, but each attempt now has its own timeout. A hanging synthesis call can therefore retry once, persist the raw transcript to `Inbox`, and return the queue to idle instead of staying in `PROCESSING`.

On iOS Simulator, the native bridge rejects the GPU backend with `LITERT_UNSUPPORTED_SIMULATOR_BACKEND`; CPU is the supported simulator backend for the current release gate.

## iOS Native Setup

The bridge is written against the LiteRT-LM Swift API and compiles conditionally with `canImport(LiteRTLM)`.

To enable real native synthesis:

1. Add the Swift package to the iOS app target in Xcode:

```text
https://github.com/google-ai-edge/LiteRT-LM
```

2. Select the `LiteRTLM` product for the `ContextEngine` target.

3. Place a compatible `.litertlm` model at:

```text
Documents/models/gemma3-1b-it-int4.litertlm
```

4. Or download the recommended model from inside the app into `Documents/models/gemma3-1b-it-int4.litertlm`.

5. Build and run on an iOS device with enough disk and memory for the selected model.

## Model Artifact Requirements

No model binary is committed. Before marking native LiteRT-LM validation complete, record:

- Source URL.
- License.
- File name.
- Expected size.
- SHA-256 checksum.
- Required iOS version and device memory.
- Whether GPU/Metal is supported.

## In-App Model Download

The app now surfaces one recommended device-sized model:

- `Gemma3-1B-IT` at `584,417,280` bytes with a `4 GB` minimum device-memory target.

That entry stays the default because it is the smallest practical option for this project and is already marked in the Gallery allowlist as best for chat/prompt-lab use. The app downloads it from a public LiteRT-LM mirror so the model flow works without Hugging Face auth.

## Current Simulator Validation

The iPhone 16 iOS 18.6 simulator has Gemma3-1B-IT installed at:

```text
Documents/models/gemma3-1b-it-int4.litertlm
```

Functional QA on 2026-05-26 verified that manual capture can queue a thought, complete LiteRT synthesis, persist the result, and clear the queue. The later 2026-05-27 recheck also confirmed the settings screen reports `Ready on device` for Gemma3-1B-IT and the simulator container still contains the verified model and manifest. Remaining release validation is tracked in `../implementation/index.md`.

After simulator synthesis testing, inspect crash reports before accepting the run:

```sh
xcrun simctl spawn booted log show --predicate 'process == "ContextEngine"' --last 10m
xcrun simctl diagnose booted
```

Acceptance for LiteRT release readiness remains: no new `ContextEngine` crash report after 10 simulator manual captures, native LiteRT errors surface as raw `Inbox` persistence rather than app crashes, and the queue returns to idle after success, rejection, or timeout.
