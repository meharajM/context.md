# Thought Notes Play Store listing update plan

**Purpose:** hand off a precise, reviewable Play Console listing update to an AI agent.
**Last verified:** 2026-11-11.
**Status:** Android 1.0.8 / code 9 is published. On November 11, the AI-led short description and full-description opening were sent to Google Play for review. Automated checks are running; the public listing remains on its last approved copy until Google approves the update.
**Authority:** this file records the public Play listing, latest saved listing draft, asset order, and safe procedure for future updates. The release and discoverability plan is in marketing-and-release-plan.md. Older listing snippets in `store-listing-refresh-draft.md` and the historical section of `store-submission-package.md` are superseded.

## Current Play Console state

- App: Thought Notes, package `com.meharaj.contextengine`.
- Default store listing language: English (United States), `en-US`.
- Production: version **1.0.8**, version code **9**, published November 9, 2026. The public listing says “Updated on Nov 9, 2026” and offers Install; the public download badge reads **1+**.
- At the November 11 Console check, the live listing showed the Meeting-ready and recording screenshots first, followed by topic organization, widget capture, background recording, and privacy. The live short and full descriptions led with meeting notes.
- The published icon, feature graphic, and six phone screenshots are labeled individually as created or edited using AI. The store-listing promotional video field is blank; tablet, desktop, and Android XR assets are also blank.
- The wide 1024 × 500 feature graphic is uploaded in Console, but it is not a card in the phone screenshot gallery. Google Play uses feature graphics in broader promotional placements and as a preview-video cover when a video is present; this listing has no preview video.
- The separate foreground-service demonstration video belongs to App content; do not confuse it with the optional store-listing video field or change it as part of this listing update.
- The Android app update is live. The November 11 draft changes only the short description and full-description opening; no AAB, store assets, or rollout setting changed.

## Positioning

Thought Notes now leads its Play listing with on-device AI meeting notes, English transcription, suggested action items, and summaries when the optional model is ready. Everyday voice capture and searchable topic organization remain supporting features.

Priority search themes, used naturally:

1. On-device AI meeting notes
2. English meeting transcription
3. Meeting action items and summaries
4. Private voice notes and topic organization

The wording is based on product fit and qualitative competitor language, not search-volume or ranking data. Do not add repeated keyword variants, claims about search rank, ratings, lecture recording, audio-file import, multilingual transcription, always-listening, or guaranteed offline behavior.

## Earlier voice/topic listing copy (superseded)

The following short and full descriptions were used before Meeting mode was added. The published Meeting-first copy is in the Meeting-mode section below; do not put this older copy back into the listing.

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

## Earlier Android 1.0.8 phone screenshot order (superseded)

This older six-image order was replaced by the Meeting-first sequence below:

1. android/store-assets/proposed-daily-notes/03-on-device-topic-organization.jpg — searchable topics and local AI organization.
2. android/store-assets/proposed-daily-notes/01-widget-voice-capture.jpg — quick widget capture.
3. android/store-assets/screenshots/phone-03-meeting-mode-ready.jpg — Meeting mode ready screen and explicit Start.
4. android/store-assets/screenshots/phone-04-meeting-mode-recording.jpg — active recording indicator, transcript progress, and Stop.
5. android/store-assets/proposed-daily-notes/02-background-recording.jpg — background recording notification.
6. android/store-assets/proposed-daily-notes/04-daily-notes-privacy.jpg — local notes and user-controlled sharing.

Keep the 512 × 512 PNG app icon. Replace the existing 1024 × 500 feature graphic with android/store-assets/feature-graphic-1024x500.png, the generated Meeting-mode ad. Two new screenshots are genuine Redmi 3S/API 30 app screens framed with marketing text; the ready-screen crop excludes saved meeting history. Do not upload the unframed source images.

The user previously confirmed the existing icon, feature graphic, and screenshot compositions used AI assistance. The new feature graphic is generated artwork and the two new screenshot compositions use AI-assisted layouts around genuine captures. Keep the AI asset declaration selected for every relevant asset, reassessing provenance if a source changes.

## Console procedure for an AI agent

For any future listing edit, open the [Thought Notes default store listing](https://play.google.com/console/u/0/developers/5767661347278295715/app/4973607399581591268/store-listings/default/edit) in Codex browser, confirm the app ID and Default – English (United States) – en-US, compare its fields to the exact public copy above, and inspect the preview and AI asset declarations. Keep app content, tracks, countries, and pricing unchanged unless the approved task explicitly requires a change. Save a draft and review it before submitting; do not submit unrelated metadata changes as part of an app release.

After owner approval, submit the listing change through Publishing overview, then monitor automated checks and Google review. Do not upload a new AAB, change rollout or region settings, or treat saving the draft as submission. If Google requests changes, capture the exact request and update only the affected field or asset.

## First-run guidance recommendation

The best fit is the implemented compact Home guide: **Capture and add the Android widget → AI connects related notes → Share a topic and bring the reply back.** Small native illustrations make each card concrete without blocking the composer. The Android widget card explains **long-press Home → Widgets → Thought Notes → drag into place**. Active model notices show approximate size/progress and disclose possible mobile-data use; typing remains available while AI prepares. A full-screen carousel would add friction; a spotlight tour would require more maintenance and accessibility handling than this workflow needs. Consider persistent replayable help only if user feedback shows the cards are not enough.

The first-use guide is not part of the current six-screenshot listing story. Do not add it to store screenshots unless the production flow has been reviewed for accuracy and accessibility.

## Measurement and references

The historical Play Console listing report showed **2 visitors and 0 unique install clicks** for 2026-09-29 through 2026-10-26; the public page then showed 0+ downloads. The latest public badge is 1+, but current acquisition-report values were not refreshed. This is still too little evidence for a confident listing diagnosis. Recheck current visitors, unique install clicks, and CTR before testing one asset or text variant at a time. Since July 2026, Play's primary listing metrics focus on unique clicks; segment by traffic source, country, language, and UTM where possible.

Sources: [Google Play listing setup and metadata limits](https://support.google.com/googleplay/android-developer/answer/9859152), [metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842), [store listing experiments](https://support.google.com/googleplay/android-developer/answer/12053285). Competitor phrase examples and their limitations are recorded in [the discoverability review](play-store-discoverability-2026-10-31.md).

## Meeting-mode listing update — Android 1.0.8 / code 9

**Published state:** Android 1.0.8/code 9 was published November 9, 2026. At the November 11 Console check, the live listing showed this Meeting-first copy and screenshot order.

The release bundles version 1.0.8, code 9, targets SDK 36, and supports API 24+. The short and full copy state that AI is on-device, no sign-in/account/subscription/meeting link is required, and meeting data is not uploaded to cloud storage or cloud AI. On Android, model files must download before first use; the downloads do not contain meeting audio or notes. User-selected text sharing remains an explicit exception. The new feature graphic and all relevant AI-assisted/generated store assets are labeled individually in Play Console.

Copy uses search phrases naturally and makes no ranking promise. It does not imply call capture, speaker identification, guaranteed recognition, or fixed summary timing. A 63-minute physical run transcribed timestamped chunks, but LiteRT summary inference timed out on the tested low-resource Redmi 3S. A short physical run generated a summary and two suggested actions automatically after Stop. Transcript recognition of controlled speech was noisy on the Redmi, so the copy asks users to check names and details.

**Live short description before the November 11 draft — 55/80 characters**

On-device AI meeting notes. No account or subscription.

**Live full description before the November 11 draft — 2,737/4,000 characters**

Capture in-person meetings and everyday ideas with Thought Notes. On-device AI transcribes English speech, suggests action items, and creates meeting summaries when the optional writing model is installed and device resources allow.

IN-PERSON MEETING NOTES & ENGLISH TRANSCRIPTION
Tap Meeting mode, then Start, to record an in-person room meeting through your phone or connected microphone. The Meeting widget opens this screen; it never starts recording. Android recording can continue while you switch apps, with a persistent recording notification. Timestamped English transcript chunks appear as audio is processed; text may lag on slower phones. Speaker labels aren’t available.

After Stop, the transcript is saved and suggested action items are generated automatically. The optional on-device writing model creates a summary automatically when it is installed and device resources allow. If the writing model isn’t ready, your transcript and recognized-speech highlights stay available. Check names and details against the transcript. Review each suggested action; keeping it does not schedule a reminder.

SHARE ONLY WHAT YOU CHOOSE
Share the meeting summary, transcript, action items, or all available content separately through the system share sheet. Save meeting text as a note to include it in your note library and JSON backup. Audio is never attached to a text share.

ON-DEVICE AI. NO ACCOUNT OR SUBSCRIPTION.
No account, login, subscription, or meeting link is needed. Meeting audio and notes aren’t uploaded to cloud storage or cloud AI; Thought Notes has no meeting-data backend. On Android, an internet connection is needed to download the English transcription model before first use; optional on-device writing models may also be downloaded. These downloads contain model files only, not your audio or notes. If you choose to share, only the content you select is sent to the app you choose.

Meeting audio stays in app-private storage until the complete transcript is safely saved and your chosen retention period ends: five minutes by default, one hour, one day, or Keep. Failed transcription keeps audio for retry.

VOICE NOTES + ON-DEVICE TOPICS
Tap Record in Thought Notes or on the home-screen widget. English speech is transcribed locally. When the on-device AI model is ready, related captures are grouped into searchable topics with short summaries. Your original notes remain available.

BRING RESEARCH BACK TO YOUR NOTES
Share a topic with ChatGPT or another assistant. Share its response back to Thought Notes; local AI can file it with a related topic when the model is ready.

No ads or publisher analytics. For quick ideas, meetings, personal reminders, plans, and research threads worth revisiting.

**Meeting-first screenshot order — live in Console on November 11**

1. android/store-assets/screenshots/phone-03-meeting-mode-ready.jpg — real Redmi screen, cropped above meeting history; start requires a tap.
2. android/store-assets/screenshots/phone-04-meeting-mode-recording.jpg — real Redmi recording indicator and Stop control; text processing can lag.
3. android/store-assets/proposed-daily-notes/03-on-device-topic-organization.jpg — searchable topics and on-device organization.
4. android/store-assets/proposed-daily-notes/01-widget-voice-capture.jpg — quick note and voice capture.
5. android/store-assets/proposed-daily-notes/02-background-recording.jpg — background capture and notification Stop control.
6. android/store-assets/proposed-daily-notes/04-daily-notes-privacy.jpg — local note storage and sharing by choice.

The new Meeting compositions use genuine current-build UI pixels; no user transcript, Inbox content, or meeting-history timestamps appear. The final generated 1024 × 500 feature graphic/ad is at android/store-assets/feature-graphic-1024x500.png; it reads “On-device AI. No account or subscription.”, “No cloud upload of meeting data.”, and “Android downloads model files when needed.” The graphic is not in the screenshot gallery; Google Play uses feature graphics in broader promotional placements and as a preview-video cover when a video is present. The graphic is for the Play listing; no paid ad campaign was purchased or launched. All six phone assets, app icon, and feature graphic have their AI-asset labels selected in Play Console.

**Privacy policy**

The canonical docs/privacy-policy.md includes Android 1.0.8 Meeting mode, local processing, independent share choices, five-minute-default safe audio retention, retry after transcription failure, and JSON backup boundaries. The matching public policy is published at the existing URL and verified against the local file before submission.

## AI and topic-discovery draft — saved November 11, 2026

Publishing overview shows **Changes in review** with two listing edits: the short description and full description. Play Console says automated quick checks are running and the changes will proceed to review when checks complete successfully. Its confirmation dialog said reviews are typically completed within seven days, but may take longer. The update preserves the app name, screenshots, icon, feature graphic, declarations, and release settings.

**Short description — 67/80 characters**

```text
On-device AI organizes voice and text notes into searchable topics.
```

**New full-description opening**

```text
Thought Notes uses on-device AI to connect related voice and text notes into searchable topics. Capture in-person meetings and everyday ideas with English transcription, suggested action items, and summaries when models and device resources allow.
```

The rest of the full description is unchanged from the November 9 Meeting-mode copy above. This update makes AI organization the first benefit while retaining meeting capabilities and their model-readiness qualifiers. Google review and public rollout remain pending. The public product page source is not available in the connected Sites account or this repository; its publisher-identity mismatch is still unresolved.
