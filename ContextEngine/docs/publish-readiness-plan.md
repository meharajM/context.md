# Publish Readiness Remediation Plan

Date: 2026-07-18
Phase: `phase-11-roadmap-hardening-and-release-qa`
Behavior oracle: `app-behaviour.md`

## Objective

Close the implementation, validation, and store-readiness gaps found during the July 18 iOS/Android audit without weakening the core invariant that every non-empty thought is persisted. The phase remains `in_progress` until the automated gates pass and the owner completes physical-device and store-console gates.

## Verified Baseline

- TypeScript, lint, and Jest passed before remediation: 23 suites and 104 tests.
- iOS simulator Detox passed the existing launch, manual-persistence, and text/WAV-import journeys.
- Android emulator passed launch, manual persistence, text import, relaunch persistence, direct Assistant payload intake, and voice failure-safe WAV retention.
- iOS physical-device build is blocked because the Developer Disk Image is not mounted and Development services are unavailable.
- No physical Android device is currently connected.
- Headset triple-press handlers are implemented on both platforms, but reliable OS delivery is not release-ready: Android does not select the app's non-playing media session and iOS requires legitimate Now Playing eligibility.
- Current release artifacts are validation artifacts, not store-submittable owner-signed builds.

## Execution Result — 2026-07-18

- Workstreams 11A, 11B, 11C, and 11E1 ran in parallel and were integrated by the root workstream.
- Capture durability, raw Inbox fallback, model-backed source replacement, import approval, topic-context refinement, startup requeue, microphone/readiness UX, dependency pins, capability cleanup, and the cross-platform Detox harness are implemented.
- The stale single-file storage claim was reconciled with the recorded per-topic architecture. App bootstrap now activates `Documents/context.md` migration, skips content already present, and preserves ambiguous coexistence data under `Legacy <topic>` so upgrades do not hide legacy notes.
- Automated gates are green: typecheck, lint, 25 Jest suites / 145 tests, shared Detox 4/4 on iPhone 16 and 4/4 on Android 11, iOS Debug build, Android Debug/AndroidTest builds, Android headset timing/debounce tests 5/5, and deterministic screenshot journeys on iPhone, iPad, and Android.
- Android headset callback mapping is present, but stock global delivery is not: runtime probes left the media-button session unselected without real playback. iOS also requires legitimate Now Playing eligibility. No silent audio, fake playback state, or background interception workaround ships.
- A final R8-minified release APK and Play AAB build successfully with Kotlin 2.3.0/R8 8.13.19; all 15 arm64 native libraries pass the 16 KB alignment check.
- Release preflight is 12/17. Code, policy metadata, icon, feature graphic, screenshot, and store-submission draft checks pass; the remaining gates are disk/toolchain, owner credentials, and publishing inputs.

## Parallel Workstreams

### 11A — Capture durability and retained audio

Owner: `capture_durability` agent
Status: automated implementation complete; physical validation pending

Scope:

- Persist manual and Assistant captures durably before asynchronous synthesis begins.
- Preserve one stable source-note identity so later model-backed categorization can replace, rather than duplicate, the Inbox source.
- Retain the recorded WAV when Whisper returns an aborted/error result without throwing.
- Keep empty captures ignored and avoid duplicate queue submissions.

Acceptance criteria:

- Killing the app after accepting a non-empty capture cannot lose the raw thought.
- Successful later categorization removes only the matching durable Inbox source.
- Thrown, returned, aborted, and timeout transcription failures retain the audio path and failure-safe note.
- Focused store and AudioEngine tests cover success and failure paths.

### 11B — Synthesis, Inbox retry, import approval, and topic context

Owner: `synthesis_conformance` agent
Status: complete and covered by integrated tests

Scope:

- Make unavailable, disabled, timed-out, malformed, or failed LiteRT synthesis resolve to raw Inbox persistence, not heuristic topic assignment.
- Remove an Inbox source only after genuine model-backed categorized persistence succeeds.
- Preserve the original Inbox note on repeated fallback or failure.
- Require explicit approval whenever an import proposes merging into an existing topic.
- Supply relevant topic content, not only topic names, to the synthesis decision.
- Safely enable startup requeue for existing Inbox entries.

Acceptance criteria:

- `raw-fallback` always targets Inbox and never silently merges into an existing topic.
- Retry is idempotent and cannot delete the only durable copy.
- Import merge approval is independent of which synthesis runtime proposed the topic.
- Tests distinguish model-backed success from raw fallback.
- Startup with Inbox content requeues once without duplication or an infinite loop.

### 11C — Headset/media-button and Assistant platform integration

Owner: `headset_platform` agent
Status: handler implementation complete; reliable OS delivery remains planned

Scope:

- Add an Android media-button path that is active only while the supported app scope is active.
- Map the Android headset gesture to one debounced `HeadsetTripleTapRequested` event.
- Handle the iOS remote command that the OS emits for an EarPods triple press and correctly establish remote-event eligibility.
- Preserve the same JS start/stop/disabled/unready contract on both platforms.
- Show Google Assistant binding guidance on Android.

Acceptance criteria:

- Native builds succeed and event/debounce logic has focused automated coverage where possible.
- One recognized gesture starts when idle and stops when recording; disabled or unready states do not start capture.
- A gesture cannot emit multiple capture actions inside the debounce window.
- Documentation does not claim locked-screen/background interception.
- Physical wired/Bluetooth headset checks remain mandatory before release.

### 11D — UX and locally actionable release configuration

Owner: root agent
Status: locally actionable work complete; owner/store inputs pending

Scope:

- Surface voice-disabled, microphone-denied, model-unready, stopping, and retained-audio states with actionable guidance.
- Pin release dependencies that currently use dynamic versions.
- Minimize platform permissions and background modes to shipping behavior.
- Align the displayed product name across platforms.
- Add a publish checklist, privacy-policy draft, store-listing copy draft, screenshot matrix, and signing preflight documentation.
- Keep credentials outside the repository.

Acceptance criteria:

- UI tests cover denied/unready guidance and settings navigation where supported.
- Android dependency resolution is reproducible.
- Release manifests contain only justified permissions/capabilities.
- Store metadata documents clearly distinguish draft text from completed console submissions.

### 11E — Cross-platform automated and physical QA

Owner: root agent after 11A–11D integration
Status: automated gate complete; physical gate blocked/pending

Scope:

- Remove the iOS-only assumptions from the Detox helpers and add an Android configuration/journey.
- Add voice lifecycle, Inbox retry, import approval, Assistant intake, and headset-event E2E coverage at the highest reliable layer.
- Run unit, type, lint, iOS simulator, Android emulator, release-build, and artifact checks.
- Run the full `app-behaviour.md` checklist on physical iOS and Android devices.

Automated gate:

```sh
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
npm run validate:regression
npm run ios
npm run test:e2e -- --cleanup
cd android && ./gradlew app:assembleDebug app:assembleAndroidTest app:bundleRelease
```

Physical gate:

- Fresh install, upgrade, relaunch, foreground/background, and device restart.
- Manual, voice, imported voice, Assistant, share sheet, and Inbox retry flows.
- Wired and Bluetooth headset gestures for start, stop, debounce, disabled, and unready states.
- Microphone denial/re-enable and model missing/download/failure paths.
- Retained audio existence, playback/delete behavior, and OS cache-pressure behavior.

### 11F — Owner/store-console gates

Owner: publisher
Status: blocked on owner credentials and account access

iOS:

- Install Xcode 26+ and build with the iOS 26+ SDK.
- Mount the physical device Developer Disk Image and enable Development services.
- Create/use Apple Distribution and App Store provisioning assets.
- Complete App Store Connect app record, privacy answers, age rating, export compliance, screenshots, review notes, pricing, TestFlight, and submission.

Android:

- Supply the Play upload keystore through the documented environment/Gradle properties.
- Enroll/confirm Play App Signing and create the production track release.
- Complete store listing, screenshots/feature graphic, Data Safety, privacy policy, content rating, target audience, ads, and app-access declarations.

Shared:

- Approve final product name, support URL, privacy-policy URL, marketing copy, categories, regions, and support contact.
- Keep at least 20 GB of local free disk before final archives and symbol generation.

## Integration Order

1. Land 11A and 11B, then resolve their deliberately narrow `store.ts` edits together.
2. Land 11C native and JS event contracts.
3. Complete 11D against the integrated behavior.
4. Run focused tests after each slice, then the complete 11E automated gate.
5. Record physical evidence without marking the phase validated if a device is blocked.
6. Produce owner-signed release candidates and complete 11F in the store consoles.

## Exit Criteria

The app is publishable only when:

- No known path can drop a non-empty capture or its only retained audio.
- Behavior and tracker claims match passing tests and physical-device evidence.
- Headset behavior passes on representative wired and Bluetooth controls on both platforms.
- Both production artifacts are signed with owner-managed distribution/upload identities.
- Store metadata, privacy, screenshots, policy declarations, and review information are complete.
- The current phase gate is green and no blocker is described as complete work.
