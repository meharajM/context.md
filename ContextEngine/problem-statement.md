# Problem Statement: The Distributed AI Context Dilemma

## Background
In the current digital ecosystem, capturing spontaneous ideas is highly frictionless in isolation (voice notes, to-do lists), but integrating these thoughts into a cohesive, structured "second brain" is largely a manual and tedious process. Additionally, the rise of specialized AI agents—used for coding, scheduling, reading, and research—has created "context silos." Each agent operates independently and must be repeatedly re-briefed on user goals, ongoing projects, and personal preferences.,

## The Problem
1. **Friction in Idea Capture**: Great ideas often occur when users are mobile (e.g., walking, commuting). Unlocking a phone, finding an app, and typing or organizing a note introduces enough friction that ideas are lost.
2. **Fragmented Agent Context**: AI agents lack a shared, persistent memory. A user's coding agent knows nothing about the project timeline discussed with a scheduling agent.
3. **One-Way Data Flow**: While humans prompt AI agents, the agents rarely "write back" to the user's central brain/memory to update the user's permanent context after a problem is solved.

## The Solution: "Context Engine" Application

Develop an intelligent, voice-first web application (designed specifically for mobile devices with earphone connectivity) that serves as a living, two-way memory sync for both the human user and their ecosystem of AI agents.

### Core Features

#### 1. Zero-Friction Voice Capture
- **Dual Trigger System (Wake Word & Hardware)**: 
  - **Wake Word**: The app detects earphone connections and uses an on-device wake-word engine to listen for the trigger: *"Remember"*.
  - **Hardware Shortcuts**: As a discreet alternative (e.g., in public spaces), users can map rapid hardware sequences—such as triple-clicking the "Volume Up" button, or using OS-level accessibility features like iPhone's "Back Tap"—to instantly bypass the wake word and initiate recording.
- **Intelligent Recording**: Upon activation, it records the user's thoughts and securely transcribes them into text entirely on-device.

#### 2. AI Synthesis & Categorization
- **LLM Processing**: The raw transcript is passed to an AI model to extract meaning, strip filler words, and identify the core subject matter.
- **Topic-Wise Organization (`context.md`)**: The synthesized thought is automatically routed to the correct markdown topic section (e.g., `# Ideas`, `# Project X`, `# Personal`) within the master context file. New topics are generated dynamically when required.

#### 3. Bidirectional AI Agent Ecosystem
- **Push to Agents**: The app allows seamless sharing of the structured `context.md` file with external AI agents. Agents receive immediate, holistic understanding of user priorities and project states.
- **Pull from Agents**: External AI agents can share updates or conversations back to the Context App via an API. The app's engine synthesizes the agent's output and patches the `context.md` file automatically, updating the relevant topic without human intervention.

#### 4. Local-First & Privacy by Default
- **Offline Processing**: The overarching philosophy is "everything local until the user opts for the cloud."
- **Target Audience & Hardware**: Designed explicitly for modern, premium smartphones equipped with dedicated Neural Processing Units (NPUs), specifically **iPhone 14 and above**, or the **Samsung Galaxy S-series**. These devices possess the necessary compute overhead to run local inference efficiently without drastically impacting battery life.
- **On-Device AI**: Local speech-to-text (STT) models (e.g., Whisper.cpp) and local Large Language Models (e.g., via MLX, MediaPipe, or WebNN) handle transcription and synthesis without relying on an internet connection or exposing private data to third-party cloud services.

## Market Research: Current Landscape
We researched existing applications to see if a similar "offline AI context generator" or "hardware-triggered dictation" exists. The current market state is as follows:

**1. Local-First Voice Memo Apps (Existing Competitors)**:
- **v2md / Markdown Voice Memos**: iOS apps that transcribe audio using AI and save directly locally in Markdown format with YAML frontmatter. Highly privacy-focused and built for connecting to tools like Obsidian. 
- **MacWhisper / Superwhisper (macOS)**: Provide local dictation using on-device Whisper models and support mapping to custom keyboard shortcuts.
- **AnyTalk / EchoType**: Offer fully local speech recognition and offline text summarization using small quantized LLMs on mobile.
- **Meetily**: An open-source, local-first meeting assistant relying entirely on local Whisper and Ollama for summarizations.

**2. Hardware & Setup Integrations**:
- Using physical hardware to trigger offline dictation is an emerging trend. Apple allows the **Action Button** (iPhone 15 Pro) or **Back Tap** (iOS accessibility) to trigger built-in dictation or Siri Shortcuts. 
- Desktop tools (Handy, WhisperNotes) aggressively use custom global keyboard shortcuts. However, mapping the volume keys on an arbitrary Android/iOS device explicitly for *background* locked-screen wake usually requires custom native accessibility services or specialized hardware (like the iFLYTEK Smart Recorder).

**3. The Gap in the Market (Our Unique Value Proposition)**:
While there are apps that do local *transcription* to Markdown (like v2md), and complex routing is possible via cloud automation (like Zapier/Make), **none of them act as a dynamic, bidirectional memory sync for an ecosystem of AI agents running entirely offline.** 
Existing tools are passive text creators. The "Context Engine" app actively organizes thoughts into a structured master knowledge graph (`context.md`), triggers via non-standard hardware hooks natively, and uniquely functions as a two-way API hub where external specialized AI agents can pull from and automatically push context back to a user's running local "brain."
