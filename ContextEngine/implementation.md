# Implementation Plan: Context Engine

This document tracks the progress and architecture of the Context Engine mobile app.

## 🏗️ Architecture Overview

The app follows a modular architecture to ensure flexibility and local-first performance.

### Modules:
1. **Core**: State management, theme, and shared utilities.
2. **ContextManager**: Handles all operations related to `context.md` (read, write, append, search).
3. **AudioEngine**: Manages background recording, wake-word detection (Sherpa-ONNX), and STT (Whisper).
4. **SynthesisEngine**: Local LLM processing for thought categorization and summarization.
5. **Bridge**: App Intents and System Integration (Shortcuts, Action Button).

## 🚀 Roadmap

### Phase 1: Foundation (✅ Done)
- [x] Initialize Project Structure (Manual Scaffolding)
- [x] Implement `ContextManager` (CRUD for `context.md`)
- [x] Implement `SynthesisEngine` (Prompt Logic)
- [x] Initialize React Native Project
- [x] Basic UI: View Context, Manual Entry
- [x] Core Dependency Installation (RNFS, Permissions, Whisper, Sherpa)

### Phase 2: The "Ear" (🔄 In Progress)
- [x] Integrate `react-native-whisper` (Native Module Bridge)
- [x] Implement Native Bridge for Sherpa-ONNX (Wake Word skeleton)
- [x] Configure iOS permissions (Mic/Background)
- [ ] Model File Bundling

### Phase 3: The "Brain" (✅ Complete)
- [x] Install `llama.rn` for cross-platform local LLM inference.
- [x] Bundle TinyLlama-1.1B GGUF model (637MB).
- [x] Implement `SynthesisService` with ChatML prompt logic.
- [x] Implement **`ProcessingQueueManager`** for non-blocking AI synthesis.
- [x] Update UI to show "Processing (N)" status for background tasks.
- [x] Verified 100% offline synthesis loop.

### Phase 4: OS Integration (✅ Done)
- [x] App Intents for iOS 18+ (Swift implementation)
- [x] Shortcut Support (Hardware Trigger Bridge)

---

## 🛠️ Technical Stack
- **Framework**: React Native (iOS First)
- **State**: React Context / Zustand
- **Storage**: `react-native-fs`
- **STT**: `react-native-whisper` (C++ / ANE optimized)
- **Wake Word**: Sherpa-ONNX (ONNX runtime)
- **Synthesis**: Core ML / local LLM models

---

## 📝 Change Log
- **2024-03-17**: Initialized implementation plan and roadmap.
