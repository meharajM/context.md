# Thought Notes Store Submission Package — Draft

Date reviewed: 2026-10-24
Bundle/application id: `com.meharaj.contextengine`
Version: `1.0.1` (`2`)

This file contains draft copy and the remaining console/asset checklist. It is not proof that any store field has been submitted.

Local signing/API files and variables are documented in `docs/release-credentials.md`. Put values only in the git-ignored `.env.release.local` file and key files only in the git-ignored `.release-secrets/` directory. The same release env file also feeds the publisher/contact fields in this draft through `npm run release:apply-metadata`.

## Selected Android v1 listing values

- Public developer name: **UMCreations**
- Support email: **meharaj137@gmail.com**
- Support URL: **https://github.com/meharajM/context.md/issues**
- Public privacy-policy URL: **https://gist.github.com/meharajM/95c21961e6af613c8a076867c3870381**
- Marketing URL: omitted; no maintained product site exists.
- Primary category: `Productivity`; no secondary category. Play tags: `Notebook` and `Audio recorder`.
- External marketing outside Google Play: enabled in Play Console.
- Price: `Free`, with no ads or in-app purchases.
- Availability/regions: **India (IN)**
- Target audience and minimum intended age: **Adults 18+**
- Listing language: English; app access requires no account or login.

The public developer name is the Play Console account's UMCreations profile. The app's product name is separate.
Android display name and current default store-listing name: **Thought Notes**. Play Console record label: **Thought Notes: Voice Capture**.

## Draft listing copy

Name: Thought Notes

Apple subtitle: Private thought capture

Google Play short description: Capture notes by text or voice, and organize ideas privately on your device.

Google Play full description:

> Catch ideas while they’re fresh. Thought Notes keeps quick notes and voice memos organized in topic collections on your device.
>
> Write a thought, paste text, or tap Record in the app or home-screen widget. An active voice note can keep recording when you switch apps; stop it in the app or from its notification. Speech recognition and optional AI organization run on your device.
>
> Every capture is saved to Inbox first, so your original stays available if organization can’t finish. Browse and edit topics, choose where a note belongs, or share selected notes from your device.
>
> Notes and recordings are stored on your device and are not sent to a cloud AI service. You can choose to share notes or export a plain JSON backup. There’s no account, advertising, or publisher analytics. An internet connection is needed to download optional on-device AI models.
>
> Android v1 supports typed notes and user-initiated microphone capture. Audio-file import, wake word activation, assistant voice shortcuts, and spoken summaries are not available.

Apple keywords: notes,thoughts,offline,private,journal,ideas,context,productivity

App Store description (iOS, text-only): Capture typed thoughts, keep them private on your device, and organize them into useful local topics with optional on-device AI. Audio capture is not included in the iOS v1 release.

Version 1.0.1 release notes: Capture by text or voice from the app or home-screen widget. Transcribe and organize on-device; originals stay in Inbox if organization cannot finish.

## Android screenshot story

Capture each scene on a clean release candidate with realistic, non-sensitive sample data:

1. Typed thought capture — `Capture thoughts before they disappear`
2. Paste text — `Write once, organize locally`
3. On-device AI settings — `Keep processing on your device`
4. Inbox fallback — `Keep every thought, even when AI is unavailable`
5. Remove the stale real-model organized-context screen; it is not part of the current v1 listing set.

Required asset work:

- App Store iPhone screenshots are generated at `ios/store-assets/screenshots/iphone-*.jpg` (4 alpha-free `1320 x 2868` images).
- App Store iPad screenshots are generated at `ios/store-assets/screenshots/ipad-*.jpg` (4 alpha-free `2064 x 2752` images).
- Play phone screenshots currently contain old “Context Engine” branding and are not ready to publish. Replace them with four current-brand UI captures at `1080 x 2076`; remove the stale real-model synthesized-context image.
- The Play feature graphic exists at `android/store-assets/feature-graphic-1024x500.png`; the app icon is `android/store-assets/play-store-icon-512.png`.
- Validate final dimensions and file formats against the live official specifications immediately before upload:
  - https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
  - https://support.google.com/googleplay/android-developer/answer/9866151

## Proposed privacy declarations — verify in release build

Current code assessment:

- Publisher-operated account: no
- Advertising: no
- Cross-app tracking: no
- Publisher analytics: no
- Publisher crash-reporting service: no
- Thought/audio upload to publisher: no
- Optional model downloads: yes
- Play Data Safety: the saved Console declaration covers approximate location inferred from the download connection's IP as collected and shared with the model host for app functionality; the preview shows encrypted transit. Note text, recordings and device identifiers are not included in model-download requests.
- User-initiated OS share sheet: yes
- Microphone permission: yes on Android, requested for user-initiated capture; iOS v1 remains text-only
- Android foreground microphone service: yes; starts only for a recording initiated from the app or home-screen widget, with Android 13+ notification access requested for the visible Stop action
- Audio processing: local Whisper transcription; successful working audio is deleted, while failed/aborted recordings may remain in app-private storage for user review/deletion
- Android idle synthesis: WorkManager uses OS scheduling support for network state, wake locks, and reboot rescheduling; it does not start microphone capture or upload note content. Active recording uses a separate foreground service after the user starts it.
- User-selected local audio import: no (future deliverable)
- Android backup: disabled
- Apple privacy manifest: present

Console work:

- The current privacy policy is published at the configured public Gist URL. Its current published text must be updated to describe active user-started recordings continuing in the background under a microphone foreground service before shipping this behavior.
- Play Data Safety is actioned. Its preview declares only approximate location, collected and shared for app functionality, with encrypted transit; recheck if app behavior or SDKs change.
The resolved Android runtime dependency graph and app network call sites were reviewed on 2026-10-24. No analytics, advertising, crash-reporting, or telemetry SDK surfaced; the only app-initiated remote request is the optional HTTPS model download via React Native FS. Model hosts receive ordinary connection data, including IP, but not note text, recordings, or device identifiers. Re-review if dependencies or network features change.

## Android submission checklist

- [x] Target API 36.
- [x] Release minification and resource shrinking enabled.
- [x] Debug-signing fallback removed from the release build.
- [x] LiteRT-LM dependency pinned to an exact version.
- [x] Broad legacy external-storage permissions removed.
- [x] Fresh R8-minified Play AAB and release APK built from the revised Android v1 source. Current files are `android/app/build/outputs/bundle/release/app-release.aab` and `android/app/build/outputs/apk/release/app-release.apk` (version 1.0.1 (2)); latest hashes are recorded in `docs/publish-readiness-plan.md`.
- [x] Re-run the packaged release permission preflight and 16 KB native-library alignment check on the rebuilt APK; APK signing and 16 KB alignment pass.
- [x] API 30 / 6 GB emulator Detox E2E: home/readiness, typed note persistence, pasted-text import, and Inbox relaunch recovery all pass (4/4).
- [x] Debug-build background-worker instrumentation with the verified Gemma3 model passes (1/1): cold Headless JS synthesis files the note under Work and removes its Inbox source only after persistence.
- [x] Install the rebuilt minified release APK on API 36 and verify typed Inbox save, on-demand microphone permission/recording, widget capture, and local model-backed synthesis/topic filing.
- [x] Test Continue anyway below the recommended RAM on an API 36 / 16 KB emulator capped at 3 GiB (2.9 GB reported, about 1.0 GB currently available). Gemma3-1B-IT downloaded and installed with the warning visible; both an existing Inbox item and a fresh typed capture synthesized into topics, and Queue returned to clear with no app crash. The model is below its 4 GB recommendation, so this confirms a successful best-effort run at this resource level, not a guarantee on lower-memory devices. Evidence: `../../device-test-captures/android-api36-3gb-first-run-readiness.png`, `../../device-test-captures/android-api36-3gb-fresh-capture-result.png`, and `../../device-test-captures/android-api36-3gb-fresh-capture-queue-clear.png`.
- [x] Verify the release app's raw Android media-key handler with synthetic events: three presses start capture and three more stop it. A compatibility path maps a headset-collapsed `Previous Track` command directly to capture and debounces duplicate mapped delivery.
- [x] Historical prototype media-key instrumentation passed synthetic API 36 key events. It did not verify physical accessory or OS routing; headset triggers and lock-screen recording are disabled for v1 and are not release gates.
- [x] Save the default listing app-name field as **Thought Notes**; the Play Console record label remains **Thought Notes: Voice Capture**.
- [x] Attach the AI-generated 512 px app icon and 1024 x 500 feature graphic to the default Play listing. Remove all five outdated screenshots, including the obsolete synthesized-context image, and save the draft with 0/8 screenshots pending fresh captures.
- [x] Mark the AI-generated Play icon and feature graphic in the listing's AI content declarations.
- [x] Defer headset-button triggers and lock-screen capture from Android v1 after the physical headset trigger remained unreliable. The v1 app and home-screen widget retain explicit Record actions; connected microphones may be used during an active recording.
- [x] Prompt size was reduced and saved context is bounded after the real model exposed Gemma3's 1,024-token input limit; current TypeScript and 37 Jest suites / 245 tests pass.
- [x] Upload-key certificate is accepted for the existing Play bundle. Secure keystore recovery backup still needs owner verification.
- [x] Play accepted an app bundle in the production draft; separately verify the Play App Signing recovery/contact setup.
- [x] Update the public privacy-policy Gist to match v1 capture triggers and permissions. The live page describes app/widget-initiated capture and optional headset microphone routing during active recording.
- [ ] Upload at least two, preferably four, fresh current-build screenshots captured on a compatible Android target, using clean synthetic notes. The Console now has 0/8 screenshots; its icon and feature graphic remain attached.
- [x] Update the public privacy-policy Gist title and app-name references to **Thought Notes**; direct public Gist verification passed on 2026-10-22.
- [x] Complete Play Data Safety, content-rating, target-audience, ads, app-access, and privacy-policy declarations in App content.
- [ ] Confirm app category, app access, pricing, India availability and target audience declarations in the final review pass.
- [ ] Add the intended internal-test users, then preview the release before any rollout.
- [ ] Run the Play pre-launch report and physical-device regression on the uploaded AAB.
- [ ] Promote through the required testing track before production.

## Submission blockers currently known

- Historical physical QA on a Redmi Note 10 Pro Max / Android 11 with Shokz OpenRun Pro 2 confirmed widget recording could select Bluetooth SCO input, but produced no intelligible headset transcript; headset Play/Pause presses did not start capture. Headset-button and lock-screen paths are deferred from v1, so those results are not current-release blockers. No compatible Android target is connected for a fresh widget/voice retest; the Redmi 3S is below the app's API 24 minimum.
- The real-model worker path is tested through Android instrumentation on the emulator; OS delivery during an idle-device window has not been exercised on physical hardware.
- Secure upload-keystore recovery backup and Play App Signing recovery contacts still need owner verification.
- Play Console App content declarations are complete. Store screenshots, public policy consistency, release upload, internal-test users, and pre-launch report remain.
- Generated screenshots and Play feature graphic require a final visual review in the Play Console listing.
- Android v1 retains app/widget-initiated recording; headset triggers and lock-screen capture are deferred. iOS remains text-only.
- Latest signed v1.0.1 (versionCode 2) AAB rebuilt on 2026-10-24 after the widget accessibility-copy change; SHA-256 `d4b49cdd84ebdb902b14ec0d860c68bcfcea1f20819abdfc6a43acea97447049`. Play Console still lists only draft versionCode 1. The saved default listing draft has the AI-generated app icon and feature graphic attached, and 0/8 phone screenshots after all five old-brand screens were removed. Android preflight is 12/14: signatures, API/version, permissions, data boundary and 16 KB alignment pass; failures are 5.5 GB free disk below the local 20 GB archive threshold and stale branding in the four local screenshot files. Brave blocks local-file upload until its ChatGPT extension has “Allow access to file URLs” enabled manually. The published privacy policy matches Android v1.
- The developer account is Personal. Its creation date is not shown in the visible Developer account page; Google's 12-tester/14-consecutive-days closed-test rule applies to personal accounts created after 2023-11-13. Confirm applicability before planning production rollout.
