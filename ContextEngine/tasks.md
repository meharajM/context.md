# Task Backlog: Context Engine

## 🔴 High Priority (Phase 2)
- [x] Implement `AudioEngineImpl.ts` with native `whisper.rn` bindings.
- [x] Configure `Info.plist` with required permissions strings.
- [x] Create a `BackgroundService.ts` to manage persistent listening.
- [x] Setup asset management for model files (.bin).
- [x] Replace `react-native-whisper` placeholder with functional `whisper.rn`.

## 🟡 Phase 2 & Android Build (🔄 In Progress)
- [x] Configure Android environment (JDK 17, SDK 36, NDK 27.1).
- [x] Resolve Android package and namespace conflicts.
- [🔄] Generate Android Debug APK (Native linking in progress).
- [✅] **ANDROID**: Emulator online (`emulator-5554`).

## 🔵 Phase 3: The "Brain" (✅ Complete)
- [x] Install `llama.rn` for cross-platform local LLM inference.
- [x] Bundle TinyLlama-1.1B GGUF model (637MB).
- [x] Implement `SynthesisService` with ChatML prompt logic.
- [x] Update Store to use LLM for synthesis and categorization.
- [x] Verified binary stability and cross-platform asset mapping.
- [x] Run Headless E2E Tests (Verified on Simulator).
- [x] Run Headed Tests via Mobile MCP (Verified on Simulator).

## 🟢 Low Priority (Polishing)
- [ ] Implement multi-language support for Whisper.
- [ ] Add haptic feedback for wake-word detection.
