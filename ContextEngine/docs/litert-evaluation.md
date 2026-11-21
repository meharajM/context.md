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
- Show a model catalog and offer an explicit first-run or Settings download when the physical device meets its resource and storage requirements. Startup checks readiness and initializes installed models without downloading a missing model.

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

Automatic voice setup uses device RAM and free storage on physical iOS and Android devices. Devices with at least the Gemma 3n 8 GiB RAM target and enough space for its 3.66 GB model plus 512 MiB headroom use Gemma 3n E2B for transcription and note organization. Lower-memory or storage-constrained devices and simulators use the separate Whisper tiny.en transcription model and a text-only writing model. Gemma 3n uses LiteRT-LM's CPU audio backend and 20-second WAV segments on both platforms; Whisper supports the same meeting chunks and retained-WAV retries. Prompts request verbatim English across regional accents, including Indian English; physical accuracy and latency remain unverified.

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

4. Choose the recommended model from the first-run notice or Settings to download it into `Documents/models/gemma3-1b-it-int4.litertlm`.

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

The app automatically selects a recommended iOS model and leaves other catalog models optional:

- `Gemma3-1B-IT` at `584,417,280` bytes with a `4 GB` minimum device-memory target.
- `Gemma 3n E2B` at `3,655,827,456` bytes with an `8 GB` minimum device-memory target and audio input enabled on Android and iOS.

Gemma3-1B-IT stays the lightweight writing model because it is the smallest practical option for this project and is already marked in the Gallery allowlist as best for chat/prompt-lab use. On Android and iOS, automatic selection prefers Gemma 3n only when RAM and free storage meet its target; otherwise the app pairs the text model with Whisper. Other catalog models remain optional. The app downloads these artifacts from pinned public model mirrors so the model flow works without Hugging Face auth.

Gemma 3n E2B artifact:

```text
Model card: https://huggingface.co/google/gemma-3n-E2B-it-litert-lm
Public mirror: https://huggingface.co/warped-community/gemma-3n-E2B-it-litert-lm
File: gemma-3n-E2B-it-int4.litertlm
Size: 3,655,827,456 bytes
SHA-256: 2ed7bc3a0026c93d5b8a4544b352d9d00cd66ff0bac3ef6a20ac3d2cba4010d6
License: Gemma Terms
Backend: CPU, with LiteRT-LM audio backend also on CPU
Minimum catalog RAM: 8 GB
```

On Android, the app downloads 16 MiB byte ranges, retries a failed range up to three times, then verifies the assembled file size and SHA-256 before installation. iOS continues to use its background download path.

## FunctionGemma Research Handoff (source implementation; validation pending)

FunctionGemma 270M is an auxiliary tool-call planner, not a writing/synthesis model. Settings downloads it separately, and its `function_calling` task type keeps it out of writing-model selection and recommendations. The current artifact is a pinned community `.litertlm` conversion of Google's `google/functiongemma-270m-it`; it is not committed to the repository.

```text
Model card: https://huggingface.co/sasha-denisov/function-gemma-270M-it/tree/5576af584d75618cdf0cd07b5e79c6fd9ac0ace5
Artifact: functiongemma-270M-it.litertlm
Size: 284,426,240 bytes
SHA-256: 680fead1cca41a23220c904500a515d06e41f5c66d130aa4a9cc5905ec529a8e
License: Gemma Terms
Backend: CPU
Minimum catalog RAM: 4 GB
```

At runtime the model can return only one `prepare_chatgpt_research` call with a query and focus. The app validates the call, then shares the user's task and current thread context using the OS share sheet. The user chooses ChatGPT and sends the request; sharing the response back uses the existing import flow. FunctionGemma itself does not browse, and the app does not open, inspect, or control ChatGPT. Neither platform's model inference, the artifact's compatibility, nor the share round trip has been validated for this feature yet.

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
