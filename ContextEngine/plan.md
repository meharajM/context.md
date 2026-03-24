# Context Engine - Development Plan (MVP)

## 🎯 Goal
Build a local-first, voice-triggered memory sync app for iOS that captures thoughts via wake-word ("Remember") or hardware shortcuts, synthesizes them using local AI, and organizes them into a master `context.md` file.

## 🏗️ Architecture
- **State**: Zustand (Store-driven UI)
- **FileSystem**: React Native FS (`context.md` operations)
- **Audio**: React Native Whisper (STT) + Sherpa-ONNX (Wake-word)
- **Synthesis**: Local LLM prompt logic + JSON parsing
- **OS Bridge**: App Intents (iOS 18) + Siri Shortcuts

## 🛤️ Implementation Phases

### Phase 1: Core Foundation (✅ COMPLETED)
- [x] Project Scaffolding (RN 0.84)
- [x] Modular Directory Structure
- [x] ContextManager (Markdown parsing/editing)
- [x] Basic UI (Manual thought entry + Section view)

### Phase 2: Audio & Trigger Integration (🔄 IN PROGRESS)
- [ ] Native Permissions (Microphone & Background Audio)
- [ ] Whisper STT Integration (AudioEngine Implementation)
- [ ] Sherpa-ONNX Wake-word Integration
- [ ] Background Listening Service Logic

### Phase 3: AI Synthesis & Routing (⏳ PENDING)
- [ ] Local LLM Inference Bridge
- [ ] Prompt Engineering for Section Routing
- [ ] Metadata Extraction (Tags, Timestamps)

### Phase 4: OS & Hardware Bridging (⏳ PENDING)
- [ ] iOS App Intents for Shortcut integration
- [ ] Action Button / Back Tap support documentation

## ✅ Verification Protocol
- All file operations must be atomic to prevent `context.md` corruption.
- Audio recording must handle interruptions (calls, backgrounding).
- Synthesis must fallback gracefully if local LLM fails.
