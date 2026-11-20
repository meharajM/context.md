# `src/modules/ResearchHandoff` Architecture

This module prepares a user-mediated research request with the optional on-device FunctionGemma 270M model.

## Contract

- `functionGemmaResearch.ts` verifies the model is installed, calls the native bridge, parses the result, and allows only a non-empty `prepare_chatgpt_research` plan with bounded query and focus fields.
- The native platform bridges run a temporary CPU LiteRT-LM engine and expose only that allow-listed tool. The tool prepares text; it cannot open apps, access the network, or execute arbitrary actions.
- The app shares the task and selected thread context through the operating system. The user chooses ChatGPT, submits the request, then shares the reply back through the normal import flow.
- FunctionGemma is an auxiliary `function_calling` model. Its download must not select it for note synthesis.
- The current community model artifact, checksum, and license are documented in `docs/litert-evaluation.md`. Compatibility and real-device inference remain unvalidated.
