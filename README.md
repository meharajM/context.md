# Context Engine

> Capture thoughts locally. Organize them intelligently. Own your memory.

Context Engine is an iOS-first, local-first AI memory system built with React Native and LiteRT-LM.

The app captures typed and spoken thoughts, synthesizes them fully offline using on-device language models, and stores them in a structured `context.md` memory file.

## Why Context Engine?

Most AI memory tools are cloud-first.
Context Engine is designed around:

- privacy-first local inference
- offline thought capture
- local markdown persistence
- on-device LLM synthesis
- resilient fallback behavior
- transparent architecture

Even when AI synthesis fails, every non-empty thought is still persisted safely.

## Current MVP Features

- Manual typed thought capture
- Push-to-record voice capture
- Local Whisper transcription
- LiteRT-LM on-device synthesis
- Markdown-based memory persistence
- Queue retry + failure fallback system
- Runtime model download + management
- Foreground-only wake-word architecture
- iOS simulator validated MVP

## Architecture

```text
User Input
   ↓
Capture Layer
   ↓
Audio / Manual Queue
   ↓
Synthesis Engine (LiteRT-LM)
   ↓
Context Routing
   ↓
context.md Persistence
```

Core modules:

- `src/modules/ContextManager` → markdown parsing + persistence
- `src/modules/AudioEngine` → Whisper-backed recording
- `src/modules/SynthesisEngine` → LiteRT runtime + queue
- `src/core/store.ts` → lifecycle + runtime coordination

## Tech Stack

- React Native 0.84
- TypeScript
- Zustand
- whisper.rn
- LiteRT-LM
- React Native FS
- Jest + Detox

## Verified MVP Status

Validated flows include:

- app launch
- manual capture
- queue processing
- LiteRT synthesis
- model downloads
- persistence fallback
- recording start/stop reliability
- simulator smoke tests

The current MVP is validated primarily on iPhone 16 iOS simulator workflows.

## Known Limitations

Current intentional constraints:

- iOS-first architecture
- Android LiteRT/NPU deferred
- No background wake-word
- No lock-screen capture
- Runtime-only settings persistence
- No cloud sync yet
- No hardware trigger integration yet

## Local Setup

### Requirements

- Node.js >= 22
- Xcode
- CocoaPods
- iOS Simulator

### Install

```bash
cd ContextEngine
npm install
cd ios
bundle exec pod install
cd ..
```

### Run

```bash
npm run ios
```

## Validation

```bash
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
```

## Recommended LiteRT Model

Recommended model:

- Gemma3-1B-IT

Expected local model path:

```text
/Documents/models/gemma3-1b-it-int4.litertlm
```

The settings screen can download and activate the model directly on-device.

## Roadmap

### Completed

- Offline capture pipeline
- Queue reliability system
- LiteRT integration
- Local synthesis
- Model download flow
- Foreground wake-word architecture
- Release validation

### Planned

- Persistent settings
- Real-device performance benchmarks
- Android support
- Encrypted local memory
- Agent synchronization APIs
- Cross-device sync
- Hardware trigger support

## Open Source Contribution

Contributions are welcome.

Please read:

- `ContextEngine/AGENTS.md`
- `ContextEngine/implementation/README.md`
- `ContextEngine/implementation/status.json`

before making architectural changes.

## Project Vision

Context Engine is evolving toward:

> a local-first ambient AI memory operating system.

The current MVP intentionally focuses on:

- reliable capture
- safe persistence
- private local inference
- offline-first workflows

before expanding into passive intelligence or cloud synchronization.

## License

License has not yet been finalized.

## Repository Topics

Recommended GitHub topics:

`react-native` `local-ai` `offline-ai` `on-device-ai` `litert` `whisper` `ios` `mobile-ai` `markdown` `llm` `personal-knowledge` `ai-memory`
