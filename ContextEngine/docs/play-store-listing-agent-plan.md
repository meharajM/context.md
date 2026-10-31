# Thought Notes Play Store listing update plan

**Purpose:** hand off a precise, reviewable Play Console listing update to an AI agent.
**Last verified:** 2026-10-31.
**Status:** listing changes are saved in the English (United States) default listing draft. They are not sent to Google for review.
**Authority:** this file is the current source of truth for Play listing copy, asset order, and update steps. Older listing snippets in `store-listing-refresh-draft.md` and the historical section of `store-submission-package.md` are superseded.

## Current Play Console state

- App: Thought Notes, package `com.meharaj.contextengine`.
- Default store listing language: English (United States), `en-US`.
- Production: version **1.0.4**, version code **5**, marked Available on Google Play at **100% rollout** in **50/50 countries and regions**. It was released Oct 30 at 10:20 PM. The production track summary reports 0 installs.
- The current en-US listing draft contains the metadata and phone screenshot order below. Console showed “Changes ready to send for review”; it has not been sent for review.
- The app icon, feature graphic, and four phone screenshots are attached. All six assets are labeled as created or edited using AI. The store-listing promotional video field is blank; tablet, desktop, and Android XR assets are also blank.
- The separate foreground-service demonstration video belongs to App content; do not confuse it with the optional store-listing video field or change it as part of this listing update.
- No new AAB is needed to submit listing metadata and assets. The three illustrated first-use Home cards are a later source change and are not in the live 1.0.4 app; Android's first card explains adding the Record/Write widget. The cards need a future build and release before users see them.

## Positioning

Thought Notes helps people capture ideas from work, study, and daily life, then find them again as related topic threads. Its main differentiator is on-device AI that connects related captures and creates short summaries. Voice capture and ordinary note features support that organizing workflow.

Priority search themes, used naturally:

1. AI voice notes
2. On-device AI notes
3. Topic-based note organization
4. Private notes

The wording is based on product fit and qualitative competitor language, not search-volume or ranking data. Do not add repeated keyword variants, claims about search rank, ratings, meeting transcription, lecture recording, audio-file import, multilingual transcription, always-listening, or guaranteed offline behavior.

## Exact metadata to keep in the draft

**App name — 29/30 characters**

```text
Thought Notes: AI Voice Notes
```

This changes the Play Store title only. Keep the app’s Android launcher name and package ID unchanged.

**Short description — 57/80 characters**

```text
Capture the spark by voice. On-device AI finds its topic.
```

**Full description — 1,293/4,000 characters**

```text
Catch ideas while they’re fresh. Thought Notes is an on-device AI notes app that connects related ideas into searchable topics.

Voice notes, ready when ideas strike
Tap Record in Thought Notes or on the home-screen widget. Your voice is transcribed locally in English and saved as text. Recording can continue while you switch apps; stop it in the app, from the widget, or from its notification when available.

On-device AI, organized by topic
When the on-device model is ready, Thought Notes groups related captures into topic collections and creates short summaries. Your original notes stay available alongside summaries. On compatible devices, the local AI model downloads automatically when system resources and storage allow.

Bring assistant research back
Share a topic with ChatGPT or another assistant through Android’s share sheet. Share the response back to Thought Notes; when the on-device model is ready, it finds the related topic and files the response automatically.

Private by default
Your notes and transcription stay on your device. Share only what you choose, or export a JSON backup. No account, ads, or publisher analytics. An internet connection is needed to download the AI model.

For quick ideas, personal reminders, plans, and research threads worth building on.
```

The copy describes automatic AI organization and response filing only when the local model is ready. Keep those readiness qualifiers. Voice transcription is English-only; note text and transcripts stay on-device, while the user can share selected context. The optional model download needs internet and can depend on device resources and storage.

## Phone screenshot order

Keep the current four 1080 × 1920 JPEGs and use this order so the app’s main benefit appears first:

1. `android/store-assets/proposed-daily-notes/03-on-device-topic-organization.jpg` — related notes, on-device AI, and summary in a topic.
2. `android/store-assets/proposed-daily-notes/01-widget-voice-capture.jpg` — quick Record and Write from the home-screen widget.
3. `android/store-assets/proposed-daily-notes/02-background-recording.jpg` — user-started recording with a visible Stop action and local English transcription.
4. `android/store-assets/proposed-daily-notes/04-daily-notes-privacy.jpg` — everyday notes, topic preview, local storage, and sharing by choice.

All four are current-build, ready-to-use scenes; they do not show setup screens or model downloads. Keep the existing 512 × 512 PNG icon and 1024 × 500 PNG feature graphic. They meet the dimensions shown in Console. Do not upload duplicate assets or add a setup screenshot.

The user confirmed that both icon and feature graphic used AI. The screenshot compositions use AI-assisted layouts around genuine app/widget captures. Keep the “created or edited using AI” declaration selected for the icon, feature graphic, and all four screenshots; if any asset changes later, reassess its provenance instead of copying labels blindly.

## Console procedure for an AI agent

1. Open the [Thought Notes default store listing](https://play.google.com/console/u/0/developers/5767661347278295715/app/4973607399581591268/store-listings/default/edit). Confirm the app ID and `Default – English (United States) – en-US` language.
2. Compare the app name, short description, and full description with the exact strings above. If a field differs, replace it exactly and verify the Console character counter.
3. Confirm the screenshots are ordered **topic organization → widget capture → background recording → everyday notes/privacy**. Reorder only the existing assets if needed. Keep the icon and feature graphic attached; do not alter optional video, other form factors, category, pricing, country availability, app content, or release tracks.
4. On Review, confirm the AI-created/edited declaration and all six individual asset checkboxes remain selected. Review the en-US copy and asset preview for truncation, stale branding, or a misleading claim.
5. Save as draft and verify Console confirms the saved state. Leave the listing draft unsubmitted until the owner reviews this exact content and screenshot order.

After owner approval, submit the listing change through Publishing overview, then monitor automated checks and Google review. Do not upload a new AAB, change rollout or region settings, or treat saving the draft as submission. If Google requests changes, capture the exact request and update only the affected field or asset.

## First-run guidance recommendation

The best fit is the implemented compact Home guide: **Capture and add the Android widget → AI connects related notes → Share a topic and bring the reply back.** Small native illustrations make each card concrete without blocking the composer. The Android widget card explains **long-press Home → Widgets → Thought Notes → drag into place**. Active model notices show approximate size/progress and disclose possible mobile-data use; typing remains available while AI prepares. A full-screen carousel would add friction; a spotlight tour would require more maintenance and accessibility handling than this workflow needs. Consider persistent replayable help only if user feedback shows the cards are not enough.

This guide is currently source-only. Do not add it to store screenshots or claim it is available on the live build until a future Android release includes it.

## Measurement and references

The Play Console listing report showed **2 visitors and 0 unique install clicks** for 2026-09-29 through 2026-10-26; the public page showed `0+ downloads`. That sample is too small to identify a cause or support an experiment. Recheck acquisition data after the listing has enough traffic, then test one listing asset or text variant at a time and compare conversion rather than claiming ranking improvement.

Sources: [Google Play listing setup and metadata limits](https://support.google.com/googleplay/android-developer/answer/9859152), [metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842), [store listing experiments](https://support.google.com/googleplay/android-developer/answer/12053285). Competitor phrase examples and their limitations are recorded in [the discoverability review](play-store-discoverability-2026-10-31.md).
