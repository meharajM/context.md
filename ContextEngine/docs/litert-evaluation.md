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
{"topic":"Topic","refinedText":"Clear thought","tags":["tag"]}
```

If LiteRT-LM is disabled, missing, not linked, missing its model, or fails at runtime, the app saves the raw transcript to `Inbox`. That fallback is persistence-only; it is not another model runtime.

When the downloadable Gemma3-1B-IT artifact is missing, the iOS app also falls back to a bundled demo LiteRT-LM model (`test_lm.litertlm`) so the device still has a working on-device synthesis path. The app continues to surface the missing downloadable model in settings, but capture and synthesis remain usable.

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

## Validation Blocker

The current machine has about 210MiB free. That is not enough to resolve or install large on-device model/runtime dependencies or place a real `.litertlm` model artifact.
