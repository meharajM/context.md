# Context Master File

> This is a living document maintained by the Context App. It serves as the central brain synced across human thoughts and AI agents.

## 🧠 Personal Philosophy & Preferences
- Prefers concise, direct communication from AI agents.
- Core focus right now: Building robust and scalable web applications, mastering AI agent integrations.

## 💡 Ideas & Brainstorms

### Context Engine Web App
- A web app that dynamically detects when earphones are connected to a mobile device.
- Uses an on-device wake-word engine to listen for the word "remember."
- Transcribes and synthesizes thoughts using an AI model.
- Appends the generated context into this very file automatically, under to the most relevant topic.
- Provides a bidirectional sharing system with external AI agents (pull & push context).

## 🚀 Projects

### Project: Context Engine App
**Status**: Brainstorming phase
**Current Considerations**:
- **Target Hardware Focus**: Premium smartphones (e.g., iPhone 14+, Samsung S-series) equipped with dedicated NPUs/GPUs, capable of sustaining local AI inference models (LLMs/STTs) without experiencing thermal throttling or severe battery drain.
- **Technology Stack**: Progressive Web App (PWA) vs. Native. Web browsers cannot globally intercept physical hardware events like triple volume clicks, nor can they reliably sustain background microphone recording while locked. Thus, a Native App (or React Native/Flutter with native modules) is heavily preferred for deep OS integration.
- **Trigger Mechanisms**:
  - **Voice (Primary)**: Using WebAssembly or native C++ libraries (e.g., Picovoice Porcupine) for highly efficient, offline wake-word ("Remember") detection.
  - **Hardware (Power User)**: OS hooks mapping hardware interactions (e.g., 3x Volume Up clicks, active edge squeezes, or iOS Back Tap) to bypass voice activation.
- **Offline Processing Pipelines**:
  - **Transcription (STT)**: Integration of lightweight Whisper models utilizing `whisper.cpp` or WebGPU alternatives to transcribe audio directly on-device.
  - **LLM Context Synthesis**: Using small, quantized on-device models via local inference engines (like Ollama if running a local desktop sync agent alongside the mobile, or WebNN/MLX for mobile platforms) for 100% offline JSON-based routing of the generated context.
- **Agent Integration Local-API Check**: Establishing an isolated background socket/service for local agents to push data back into this file so the Context App can synthesize insights without cloud relays.

## 📝 Tasks & Actionable Items
- [ ] Research wake-word libraries suitable for browser/PWA.
- [ ] Diagram the architecture for the "Agent -> Context App" API hook.
- [ ] Define the prompt structure used by the backend LLM to correctly route incoming context to the matching headers in this document.

## 🤖 Agent Interaction Logs
*(Synthesized summaries from external AI conversations will be sorted above into respective projects, or logged here if uncategorized.)*
