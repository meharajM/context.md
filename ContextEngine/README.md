# Context Engine

A local-first, voice-triggered memory synchronization app for humans and AI agents.

## 🚀 Features
- **Zero-Friction Capture**: Voice-first thought capture.
- **Local AI**: On-device Transcription (Whisper) and Wake-word detection (Sherpa-ONNX).
- **Master Context**: Automatically organizes thoughts into a structured `context.md` file.
- **Modular Architecture**: Built with React Native and Zustand.

## 🏗️ Architecture
The app follows a modular design:
- `ContextManager`: CRUD for the master markdown file.
- `AudioEngine`: Local STT and Wake-word detection.
- `SynthesisEngine`: AI-based routing and thought refinement.
- `Zustand Store`: Unified application state.

## 🛠️ Setup Instructions

### 1. Model Files
You need to place the following models in your app's assets:
- **Whisper**: `whisper-tiny.en.bin` (Download from [Whisper.cpp](https://github.com/ggerganov/whisper.cpp)).
- **Sherpa-ONNX**: ONNX models for keyword spotting ("Remember").

### 2. iOS Configuration
- Run `cd ios && pod install` to link native dependencies.
- Ensure `Info.plist` has `NSMicrophoneUsageDescription`.
- Add Background Modes for "Audio" in Xcode.

### 3. Hardware Triggers (iOS)
To bridge the **Action Button** (iPhone 15 Pro+) or **Back Tap** to the app:
1. Use **Siri Shortcuts**.
2. Create a shortcut that triggers the `InitiateCapture` App Intent (Swift bridge needed).

## 🚀 Getting Started
```sh
npm install
cd ios && pod install
npm run ios
```

## 📝 Change Log
- **Phase 1 Complete**: Scaffolding, Logic, State Management, and UI.

## 📝 License
MIT
