# Assistant Intents

Context Engine supports OS-level Siri and Shortcuts capture for plain text input.

## Supported invocation patterns

- "Add this to my context in Context Engine"
- "Capture thought with Context Engine"
- Any equivalent Siri or Shortcuts action that passes a text payload into the app action

## Behavior

- The intent accepts text content only.
- Payload text is normalized before it enters the app store.
- Assistant captures use the same persistence-safe queue flow as manual text capture.
- Empty or whitespace-only payloads are ignored.

## Platform limits

- No custom wake word is required or implemented for this path.
- Assistant capture is not free-form parsing of arbitrary assistant output.
- The user still has to bind the action in Shortcuts or the platform settings flow where required.
- Voice transcription, headset triggers, and assistant intents remain separate paths.
