# Implementation Tracker

Current source of truth:
- `implementation/status.json`
- `implementation/phases.json`

Human-readable companion files:
- `implementation/README.md` for tracker instructions
- `implementation/SMALL_AGENT_HANDOFF.md` for small-context coding agents
- this file for the current phase summary
- `AGENTS.md` for project-level coding-agent rules
- `info.md` files for directory-level architecture notes

## Current Phase

Read `status.json.currentPhase` first, then open the matching phase object in `phases.json`.

Active phase as of 2026-10-21:
- `phase-11-roadmap-hardening-and-release-qa` (`in_progress`)

Current readiness slice (2026-10-24): Android typed capture and release-mode Gemma synthesis/topic filing pass on API 36 and 3 GiB emulators. The home-screen Write/Record flow passes on API 36; a prior Redmi Note 10 Pro Max run confirmed Bluetooth SCO input during widget recording, but no intelligible transcript, and the latest bundle was not installed there. Current v1 gates headset media-button and lock-screen triggers off. The latest signed v1.0.1 AAB (versionCode 2) rebuilt after widget accessibility copy changes; SHA-256 `d4b49cdd84ebdb902b14ec0d860c68bcfcea1f20819abdfc6a43acea97447049`. Android preflight is 12/14: 5.5 GB free versus the 20 GB archive threshold and stale branding in the four local Play screenshots. The saved Console listing draft has its AI-generated icon and feature graphic attached and 0/8 screenshots after all five outdated Console images were removed. Play Console still has only a versionCode 1 app release. Upload needs manual enabling of Brave's ChatGPT extension “Allow access to file URLs”; fresh screenshots and physical voice transcription need a supported Android target. iOS remains text-only and uses launch/foreground recovery.

Widget UX review (2026-10-24): kept the compact one-row Write/Record actions and picker preview; simplified screen-reader labels to “Write a note with Thought Notes” and “Start a voice note with Thought Notes.” Android release resources compile. Current launcher and picker appearance still needs on-device confirmation; saved captures predate the preview-layout update.

Active recording support (2026-10-24): explicit app/widget Record now starts a separate Android microphone foreground service before PCM. Its notification Stop opens the app and reaches the existing WAV finalization flow. Android 13+ requests notification access once when recording starts; a denied choice is remembered and can be changed in Android Settings. Capture continues after denial, with an in-app Stop visible on every route and beside Save while typed text is present. The native Stop bridge waits for `onDestroy` to remove the foreground notification before transcription begins. Final validation passed: 6 focused suites / 76 tests, full JS regression (39 suites / 300 tests), typecheck, lint, diff-check, Kotlin compile, merged manifest, and Android unit tests. No live microphone/device run was performed. Wake-word and headset-button triggers remain release-gated; the published privacy page still needs to describe active background recording before release.

User-requested retrieval and portability slice (2026-10-24): home search matches saved note text, original transcript, and topic names; Settings exports/restores a versioned JSON backup with size/schema validation, additive merge, duplicate skipping, no audio paths, and no auto-synthesis. Competitor references: [Voicenotes search/features](https://help.voicenotes.com/en/articles/15391505-what-can-voicenotes-do), [AudioPen](https://www.audiopen.ai/), [HarkNote](https://harknote.app/), [smiet](https://smiet.app/). These are vendor feature pages, not independent quality reviews. TypeScript, lint, 39 Jest suites / 307 tests, Android Kotlin compilation, and Swift syntax parsing passed. iOS Xcode build is blocked because this host has no installed iOS Simulator SDK; native document-picker QA remains outstanding. Phase 11 remains in progress.


User-requested UX improvements (2026-10-24): note search opens and briefly highlights the exact saved note; first-run model download is an explicit choice; the capture tab is labeled Import, alternate models start collapsed, Home spacing is tighter, and capture status links to available Waiting/Inbox/topic destinations. Copy reflects Android-only voice capture. Cross-flow review fixed an iOS recording claim; no other scoped findings. Regression: TypeScript and 40 Jest suites / 317 tests, lint, and diff-check passed. Native scroll timing and model download were not device-tested; phase 11 remains open.

Android UX review follow-up (2026-10-25): API 36 Detox journey passed 1/1 and captured 14 screens at `ContextEngine/artifacts/android-ux-review/final4/`. Removed repeated fallback/model guidance, corrected ready-assistant and retained-audio transcript copy, and fixed Settings capture-section scrolling. Cross-flow review also caught a persisted text-note edit replacing original transcript metadata; editing now preserves it while the timeline keeps it hidden. Regression passed: 44 Jest suites / 407 tests, TypeScript, lint (0 errors, 5 warnings), and diff-check. Emulator evidence only; physical voice/transcription and real-model synthesis remain unverified. Phase 11 remains open.

## Continue Current Phase

When the user says "continue current phase" or "continue from where we left":

1. Read `implementation/status.json`.
2. If context budget is small, read `implementation/SMALL_AGENT_HANDOFF.md`.
3. Open `phase-11-roadmap-hardening-and-release-qa` in `implementation/phases.json`.
4. Validate typed note -> local synthesis -> context filing on iOS and Android, plus Android app/widget capture with intelligible local transcription. Headset media-button and lock-screen triggers are disabled in v1; audio import, wake word, assistant voice, and iOS voice capture remain future deliverables.
5. Run the focused validation for touched modules, then append evidence to `status.json`.
6. Keep phase 11 open until Android app/widget voice QA, text-flow QA, and publication prerequisites are evidenced; headset/lock-screen triggers, audio import, wake word, assistant voice, and iOS voice work remain deferred.
7. Current Android evidence (2026-10-19): API 36 Detox typed-flow E2E passed 4/4; the fresh signed release APK launches, downloads Gemma3-1B-IT in app, and synthesizes typed captures into “Atlas client review” on the standard and 3 GiB AVDs. Below the 4 GB model recommendation, Continue anyway completed, the fresh note filed under “Atlas Support Review,” and Queue cleared. A later emulator boot showed a transient System UI ANR under host memory pressure; Wait recovered it and the app opened, so low-RAM emulator startup performance is limited by the host. The release Type/Record widget and Inbox fallback pass. Generated speech loopback was transcribed with one word substituted, filed into “Atlas client review,” and Queue cleared. Headset instrumentation passes 1/1; synthetic media keys start/stop capture while the app is foregrounded. APK/AAB signatures verify and all 15 ARM64 libraries pass the 16 KB audit. `npm run validate:regression` passes TypeScript and 36 Jest suites / 217 tests; lint and Android Kotlin unit tests pass. Release preflight is 17/20; remaining failures are the local 20 GB archive-space threshold, iOS-only Apple Distribution signing, and the stale public privacy URL. Physical wired/Bluetooth and lock-screen routing remain unverified: the connected Redmi 3S reports API 23, below minSdk 24. Play Console key enrollment/App Signing, declarations, asset review, pre-launch report, and testing track remain owner-controlled steps.

## Multi-Agent Handoff

- Multiple coding agents may work this roadmap over time; the tracker must remain sufficient without chat history.
- Agents should claim progress by appending evidence in `status.json`, not by relying on conversation memory.
- Continue any `PARTIAL:` evidence before starting a new slice.
- Keep shared contracts in `info.md` files, especially note identity, metadata shape, queue contracts, and synthesis route behavior.
- If parallel work is requested, split only along the `parallelization` guidance in the active phase.

## Notes

- Keep the tracker files in sync whenever implementation changes.
- Read `plan.md`, the active tracker phase, and relevant `info.md` files before code changes.
- Update relevant `info.md` files and tracker docs after behavior or architecture changes.
- Do not use stale markdown trackers outside this directory.
- Use `../plan.md` only when you need broader project context.

## Release QA Findings

- 2026-10-25 keyboard dismissal regression: the header Done action appears after `keyboardDidShow` and stays visible through `keyboardWillHide`, clearing on `keyboardDidHide`. AppShell focused tests passed 18/18 after the final event-order change; typecheck, lint (0 errors, 5 warnings), and `git diff --check` passed. The broader regression command passed earlier in the turn (44 suites / 399 tests, before the final event-order refinement). Manual iPhone 16 simulator use typed a Home draft, dismissed the keyboard with Done, navigated to Waiting and back, and confirmed the draft remained. Detox did not pass on this host: with the software keyboard enabled it timed out waiting for Done to disappear; a later run crashed SpringBoard before the test. Android and physical-device checks were unavailable.
- 2026-10-19 Android PCM finalization fix: postinstall patch makes native stop wait for the reader thread and emit exact PCM read lengths; `AudioEngineImpl` serializes pending writes and drains them before WAV finalization. AudioEngine focused tests passed 21/21, TypeScript and lint passed, signed release APK built and installed on API 36 / 16 KB emulator, and app cold-launched. macOS TCC logs show microphone authorization already granted to Codex as the emulator's responsible app. AudioFlinger showed active host-mic input; stop completed in about 1 second and the WAV stayed in Inbox. Whisper still returned `[BLANK_AUDIO]`; no spoken phrase was confirmed during the capture, so speech-to-text E2E remains unverified. APK SHA-256: `262f27f334c817e23b430e10769d469410ad84afee4a6f116a12bb9855e6455a`.
- 2026-10-19 signed-release retest: in-app Gemma download completed on the 2.9 GB API 36 AVD after two DNS failures; a fresh typed note filed into an existing topic and Queue cleared. Context quality was shallow. A generated spoken phrase later reached Whisper through Mac speaker/mic loopback, was transcribed with one word changed, synthesized, and filed under an existing topic; physical headset audio remains untested. Screenshots and limitations are recorded in `docs/publish-readiness-plan.md`.
- 2026-10-19 release preflight is 17/20: 11.7 GB free versus the 20 GB archive threshold, missing Apple Distribution identity, and a stale public privacy URL. The 16 KB audit passes for all 15 ARM64 libraries. No compatible physical Android device was available; the Redmi 3S is API 23.

- 2026-10-19 focused Android follow-up on a fresh API 36 / 16 KB AVD: 10 targeted Jest tests, the headset timing unit test, 2 synthetic media-key instrumentation cases, and 4 deterministic Detox journeys passed. The real-model Detox journey was skipped without a model path. Quick Type opened the composer with keyboard; Quick Record started/stopped capture through the widget action contract. This run did not place the widget from the launcher; previous release-APK launcher testing remains separate. Physical headset and lock-screen routing still require compatible hardware.

- 2026-10-18 current Play preparation and blockers are recorded in `status.json`: Android/Play local checks pass; combined preflight is 15/17 because free disk is 18.7 GB vs the 20 GB archive budget and Apple Distribution signing is absent. The configured public policy URL still serves an older draft with placeholders and voice claims. A dependency-name scan found no analytics/crash/telemetry packages, but publisher Data Safety review remains required.
- 2026-10-18 the latest Android debug APK rebuilt successfully; lint and all 27 Jest suites / 169 tests pass. The stale keyboard-layout assertion now checks that the composer is inline when the keyboard is hidden and raised when it opens.
- 2026-10-18 Detox can target a specific attached Android handset using `CONTEXTENGINE_ANDROID_SERIAL`. The Redmi has not appeared in `adb devices -l` and has no ADB over Wi-Fi or Android 11 pairing-code option. Aggressive Wi-Fi to mobile handover does not expose ADB.
- 2026-10-18 release APK builds and verifies at 107 MiB; it requires Android API 24+ and arm64-v8a. A temporary tokenized local Wi-Fi page was prepared but not accessed from the phone, then stopped after the user confirmed API 23. Xiaomi lists 2/3 GB RAM for the Redmi 3S, below the 4 GB local-synthesis recommendation; real-device installation and synthesis are not verified.
- 2026-10-18 the user confirmed Redmi Android 6.0.1 MMB29M/API 23. React Native 0.84.1 requires API 24; React Native's official release notes state 0.75 was the last version supporting API 23. The temporary download page was stopped without a phone request, and no install was attempted. Physical QA requires a compatible Android 7+ device; 4 GB RAM is recommended for local synthesis.

- Functional QA plan archived in the tracker history.
- iPhone 16 iOS 18.6 simulator launch, manual capture, queue clear, settings model status, manual toggle, and wake-word unavailable state were exercised on 2026-05-26.
- Resolved release blockers: native LiteRT-LM crash containment is implemented in code and covered by unit tests, push-to-record stop reliability has been live-simulator verified, and the React Native startup warning banner has been removed.
- `phase-05-tests-docs-release` is complete after live simulator validation.
- Phase 1 crash-containment work is implemented in code: native LiteRT calls are serialized, native and JS synthesis timeouts are in place, synthesis failures mark LiteRT unready, and queue attempts time out before raw `Inbox` fallback.
- Phase 2 push-to-record work is implemented in code: the store tracks explicit recording phases, audio stop clears realtime capture handles, stop timeouts no longer leave the UI stuck, and the record button exposes state-specific accessibility labels.
- Live simulator validation on 2026-05-27 confirmed a 10-capture smoke run with queue clear and no new `ContextEngine` crash report.
- Download progress presentation now stays in progress state until the installed model refresh completes, avoiding a temporary return to "Not downloaded".
- Inbox fallback entries can be requeued for topic classification. The queue excludes `Inbox` from semantic candidate topics, removes the original Inbox entry after successful categorization, and avoids duplicate fallback entries if synthesis fails again.
- Thread details now use the native share sheet for general context sharing and AI-oriented analysis prompts, so compatible installed AI apps can receive the thread content.
- 2026-06-29 lint/workaround follow-up is complete: `npm run lint` now passes cleanly and the NativeEventEmitter deep-import compatibility path is documented inline where the current Jest/native setup still requires it.
- 2026-05-29 simulator bootstrap redbox cleared after fixing the assistant capture hook's native event emitter construction; fresh simulator launch now reaches the home shell and a screenshot confirms normal UI rendering.
- 2026-06-01 phase-09 trigger implementation landed: iOS native triple-tap event emission, JS hook wiring to existing capture start/stop, and spoken+visual readiness guidance are in place.
- 2026-06-26 phase-10 import and permissioned merge validation passed on the iPhone 16 simulator, including simulator build/install/launch and simulator E2E coverage for text and voice import.
- 2026-06-29 phase-11 simulator validation passed again after release-hardening cleanup: `npm run typecheck -- --pretty false`, `npm run lint`, `npm test -- --runInBand`, `npm run ios`, and `npm run test:e2e` all succeeded.
- 2026-07-18 automatic iOS signing successfully obtained a development profile and produced `build/ContextEngine.xcarchive`; the prior provisioning blocker is resolved.
- 2026-07-18 the Android release pipeline produced a signed, minified, resource-shrunk AAB using externally supplied validation credentials. The real Play upload key remains owner-managed.
- 2026-07-18 remediation validation passed: typecheck, lint, 24 Jest suites / 127 tests, 4/4 Detox journeys on iPhone 16, 4/4 on Android 11, iOS Debug build, Android Debug/AndroidTest APK builds, and 5/5 Android headset-gate tests.
- 2026-07-18 headset runtime probes proved that Android leaves a flagged foreground MediaSession unselected without actual playback, even when temporarily reporting PLAYING. The probe was reverted; reliable Android delivery and iOS Now Playing eligibility remain planned, with no silent/fake playback workaround.
- 2026-07-18 final validation passed: typecheck, lint, 25 Jest suites / 145 tests, shared Detox 4/4 on both platforms, minified release APK/AAB creation, and 16 KB compatibility for all 15 packaged arm64 libraries.
- 2026-07-18 deterministic store assets passed preflight: 4 iPhone `1320 x 2868`, 4 iPad `2064 x 2752`, and 4 Play phone `1080 x 2160` alpha-free screenshots.
- 2026-07-18 release preflight is 12/17. Remaining gates: Xcode 26+, Apple Distribution identity, Play upload credentials, placeholder-free published privacy policy, and the store-submission draft fields.
- 2026-07-31 lock-screen headset capture is now code-backed on both platforms: the store requests microphone permission before arming, iOS keeps background audio and remote-control reception active, Android starts a microphone foreground service, and start/stop feedback now speaks on-device.
- 2026-07-31 validation passed: npm run typecheck -- --pretty false, npm run lint, npm test -- --runInBand, focused store/headset tests, android ./gradlew testDebugUnitTest, and xcodebuild -workspace ios/ContextEngine.xcworkspace -scheme ContextEngine -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/ContextEngineDerivedData build.
- 2026-07-18 synthesis routing hardening now compares candidate topics against persisted content, rejects generic/first-topic defaults, and holds genuinely ambiguous items in the queue with a focused question and 2–3 selectable topic options until resolved.
- 2026-07-18 internal free space was raised to 37 GB without relocating Codex, agents, runtimes, or plugins. Occasional apps and recoverable Xcode cache/device-support data were moved to the connected APFS SSD.
- 2026-07-18 git-ignored Apple/Play credential inputs, publisher/store metadata wiring, and import helpers were added; the disk gate now passes and release preflight is 12/17.
- 2026-06-01 compiled-target EventEmitter mismatch was fixed after real-device QA exposed a startup redbox for `HeadsetTripleTapRequested`.
- 2026-06-01 to 2026-06-02 real-device QA narrowed the first blocker to an iOS jetsam kill during the richer voice-stop flow; evidence is in `artifacts/device-crashlogs/` and `artifacts/real-device-qa/2026-06-01T18-22-06-555Z`.
- 2026-06-02 the AudioEngine now uses PCM stream -> WAV file -> single file transcription and forces CPU-only Whisper on iOS.
- 2026-06-02 direct voice persistence was restored on device by writing successful captures to `Inbox` before any synthesis step. Real-device evidence shows `ContextManager` append + save completes and the app survives the post-stop window.
- 2026-06-02 automatic post-capture synthesis was removed from the stop path as a stability containment step. The remaining QA failure is transcription quality, not durable capture persistence.

## Roadmap Expansion (2026-05-28)

- `app-behaviour.md` now governs target behavior as a roadmap with explicit `Implemented` vs `Planned` states.
- New execution phases were added:
  - phase 06: note edit + topic-linking acceleration
  - phase 07: voice error surfaces + audio retention fallback
  - phase 08: assistant intents/shortcuts ingestion
  - phase 09: headset triple-tap trigger
  - phase 10: import + permissioned merge
  - phase 11: roadmap hardening + release QA
- Hardware trigger, assistant intents, and import are now implemented and validated behavior; phase 11 is the remaining roadmap work.
