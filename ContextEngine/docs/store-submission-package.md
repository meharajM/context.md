# Context Engine Store Submission Package — Draft

Date reviewed: 2026-07-18
Bundle/application id: `com.meharaj.contextengine`
Version: `1.0` (`1`)

This file contains draft copy and the remaining console/asset checklist. It is not proof that any store field has been submitted.

Local signing/API files and variables are documented in `docs/release-credentials.md`. Put values only in the git-ignored `.env.release.local` file and key files only in the git-ignored `.release-secrets/` directory. The same release env file also feeds the publisher/contact fields in this draft through `npm run release:apply-metadata`.

## Shared product decisions required

- Publisher/developer legal name: **[REQUIRED]**
- Support email: **[REQUIRED]**
- Support URL: **[REQUIRED]**
- Public privacy-policy URL: **[REQUIRED]**
- Marketing URL: **[OPTIONAL]**
- Primary category: proposed `Productivity`
- Secondary category: proposed `Utilities`
- Price: proposed `Free`, pending publisher approval
- Availability/regions: **[REQUIRED]**
- Target audience and minimum intended age: **[REQUIRED]**

## Draft listing copy

Name:

> Context Engine

Apple subtitle:

> Private thought capture

Google Play short description:

> Capture, transcribe, and organize thoughts with private on-device AI.

Promotional text:

> Turn quick thoughts, voice notes, and imported audio into organized local topic threads—even when you are offline.

Full description:

> Context Engine helps you capture ideas before they disappear and organize them into useful topic threads on your device.
>
> Type a thought, record a voice note, or import text and supported audio files. On-device transcription and optional on-device AI can refine and categorize captures without sending your thought content to a publisher-operated cloud service. If a model is unavailable, the raw thought remains safely available in Inbox.
>
> Review recent threads, edit notes, retry Inbox organization, share selected context through your device's share sheet, and use supported Siri, Shortcuts, or Google Assistant actions for quick text capture.
>
> Key features:
>
> - Local-first typed and voice capture
> - On-device transcription and organization
> - Failure-safe Inbox persistence
> - Text and audio-file import
> - Explicit approval before merging into an existing topic
> - Local thread editing and sharing
> - No account, ads, or cross-app tracking
>
> Optional model downloads require internet access. Assistant capabilities and headset controls depend on device, accessory, operating-system, and app-state support.

Apple keywords draft:

> notes,voice,thoughts,offline,private,journal,transcription,ideas,productivity

Version 1.0 release notes draft:

> Capture typed and spoken thoughts, import text or audio, organize notes into local topic threads, and keep raw captures safely in Inbox when on-device organization is unavailable.

## Screenshot story

Capture each scene on a clean release candidate with realistic, non-sensitive sample data:

1. Reflections home — headline: `Capture thoughts before they disappear`
2. Voice capture — headline: `Record and transcribe on your device`
3. Organized thread — headline: `Turn captures into useful topics`
4. Inbox fallback — headline: `Keep every thought, even when AI is unavailable`
5. Import and merge approval — headline: `Import safely and choose where it belongs`
6. Settings/privacy — headline: `Private, local-first controls`

Required asset work:

- App Store iPhone screenshots are generated at `ios/store-assets/screenshots/iphone-*.jpg` (4 alpha-free `1320 x 2868` images).
- App Store iPad screenshots are generated at `ios/store-assets/screenshots/ipad-*.jpg` (4 alpha-free `2064 x 2752` images).
- Play phone screenshots are generated at `android/store-assets/screenshots/phone-*.jpg` (4 alpha-free `1080 x 2160` images). Add 7-inch/10-inch tablet sets only if tablet-specific Play distribution remains enabled.
- The Play feature graphic exists at `android/store-assets/feature-graphic-1024x500.png`; obtain final branding approval before upload.
- Keep the existing `512 x 512` Play icon and verify it again after final branding approval.
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
- User-initiated OS share sheet: yes
- Microphone permission: yes
- User-selected local audio import: yes
- Android backup: disabled
- Apple privacy manifest: present

Console work:

- Publish `docs/privacy-policy.md` after replacing every placeholder and approving the final text.
- Complete App Store privacy answers against the archived release binary.
- Complete Play Data Safety even if the final answer is that the app does not collect publisher-accessible user data.
- Recheck every transitive release dependency for analytics, diagnostics, advertising, or network behavior before answering.

## iOS submission checklist

- [ ] Install Xcode 26+ and use the iOS 26+ SDK required for current submissions.
- [ ] Resolve physical-device Developer Disk Image/Development services.
- [ ] Confirm bundle id and reserve the App Store Connect record.
- [ ] Set the final display name to `Context Engine` consistently.
- [ ] Use Apple Distribution/App Store provisioning, not Apple Development signing.
- [ ] Archive and validate the exact release candidate.
- [ ] Upload symbols and confirm processing in App Store Connect.
- [ ] Complete description, keywords, categories, URLs, screenshots, age rating, privacy, accessibility, content rights, and export compliance.
- [ ] Add review contact, review notes, and clear steps for Assistant/headset/model-download testing.
- [ ] Complete TestFlight physical-device regression before selecting the build for review.

## Android submission checklist

- [x] Target API 36.
- [x] Release minification and resource shrinking enabled.
- [x] Debug-signing fallback removed from the release build.
- [x] LiteRT-LM dependency pinned to an exact version.
- [x] Broad legacy external-storage permissions removed.
- [ ] Supply the owner Play upload keystore and verify the release certificate fingerprint.
- [ ] Confirm Play App Signing enrollment and upload-key recovery contacts.
- [ ] Approve the generated `1024 x 500` feature graphic and generated phone screenshot sets.
- [ ] Complete descriptions, category/tags, privacy policy, Data Safety, content rating, target audience, ads, app access, pricing, and regions.
- [ ] Run pre-launch report and physical-device regression on the uploaded AAB.
- [ ] Promote through the required testing track before production.

## Submission blockers currently known

- Physical iOS and Android QA evidence is incomplete.
- Xcode 16.4 cannot produce a currently eligible App Store upload.
- Owner distribution/upload credentials are unavailable locally.
- Publisher contact, URLs, audience, pricing, and availability decisions are missing.
- Generated screenshots and Play feature graphic still require publisher approval and console upload.
- Local free disk is below the safe archive budget.
- Reliable physical headset delivery requires a legitimate audio/Now Playing product contract and wired/Bluetooth verification; the native/JS press mapping itself is implemented and automatically tested.
