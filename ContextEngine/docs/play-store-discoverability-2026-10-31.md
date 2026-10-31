# Thought Notes Play Store discoverability review

**Reviewed:** 2026-10-31

**Current listing state:** the revised English (United States) listing is saved as a draft in Play Console and has not been submitted for review.
**Source of truth:** [play-store-listing-agent-plan.md](play-store-listing-agent-plan.md) contains the exact metadata, current screenshot order, Console state, and safe update steps. This review records the research and reasoning behind that draft.

## Product and audience

Thought Notes is for people who want to capture ideas quickly and develop them later: people thinking through work or study, everyday plans and reminders, or research threads. Its strongest distinction is on-device AI that connects separate captures into topics and summarizes them. Voice capture is a fast input method; ordinary note editing and sharing support the central capture-and-organize workflow.

Use familiar, relevant search language naturally: AI voice notes, on-device AI notes, topic organization, and private notes. Do not imply meeting transcription, lecture recording, audio-file import, multilingual transcription, always-listening, guaranteed offline behavior, or cloud-model processing by the app.

## Listing decisions

- The current draft title is `Thought Notes: AI Voice Notes`; the brand remains first while the category is clearer in search.
- The short description leads with voice capture and says what local AI does, without repeating keyword variants.
- The full description explains English-only local transcription, topic organization, assistant sharing and return, local data handling, and model-download readiness. Its exact text is maintained in the agent plan to prevent drift.
- The four phone screenshots now lead with the product differentiator: topic organization, then widget capture, active recording, and everyday notes/privacy. They show ready-to-use scenes rather than setup.
- The app icon and feature graphic remain the current attached assets. The AI-created/edited declarations stay selected for the icon, feature graphic, and four screenshot assets, based on the owner's provenance confirmation.
- Do not localize beyond English until the product UI and transcription support the target languages.

## Research limits

Google Play's listing form allows a 30-character app name, an 80-character short description, and a 4,000-character full description. Metadata should be accurate and relevant; store-listing experiments can compare variants, but only with enough traffic to produce useful results. Sources: [listing setup and limits](https://support.google.com/googleplay/android-developer/answer/9859152), [metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842), and [store listing experiments](https://support.google.com/googleplay/android-developer/answer/12053285).

Qualitative competitor examples use familiar phrases such as “voice notes,” “voice to text,” and “AI notes”: [MoNote](https://play.google.com/store/apps/details?id=me.monote.app), [AssistantNotes](https://play.google.com/store/apps/details?id=com.webeuseful.assistantnotes), and [AI Notes: Voice to Text](https://play.google.com/store/apps/details?id=com.lamprof.voicescribe). These examples are not keyword-volume, ranking, or conversion evidence.

The last reviewed listing report showed 2 visitors and 0 unique user install clicks for 2026-09-29 through 2026-10-26; the public Play page showed `0+ downloads`. This sample is too small to diagnose performance or claim that a listing edit improved discoverability. Recheck acquisition data after enough traffic accumulates, then test one asset or copy variant at a time.

## Release boundary

The revised metadata and screenshots are saved but unsubmitted. They can be submitted as a listing-only change without a new AAB after owner review. The illustrated Home cards, including Android widget setup guidance, are source changes and are not in live version 1.0.4; they need a future app build and release. See the [agent plan](play-store-listing-agent-plan.md) for the precise current state and instructions.
