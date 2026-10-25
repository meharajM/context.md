# Publish Readiness Remediation Plan

## Current release scope — 2026-10-24

The Android v1 candidate supports typed notes, pasted-text import, and optional user-initiated on-screen/home-screen-widget microphone capture with local Whisper transcription, on-device synthesis, topic filing, ambiguous-topic clarification, Inbox fallback/retry, editing, sharing, local search, and user-initiated JSON backup/restore. The widget exposes separate Write and Record actions. iOS remains text-only for capture and supports search and backup.

Audio-file import, headset media-button triggers, lock-screen-triggered recording, wake words, assistant voice intents, and spoken summaries remain future deliverables. Android voice capture starts only when the user chooses Record in the app or home-screen widget. Active user-started recording can continue while the app is backgrounded under the microphone foreground service and can be stopped from its notification. A prior Redmi Note 10 Pro Max run confirmed Bluetooth SCO input during widget recording, but produced no intelligible headset transcript; the latest release build has not been retested on that device. No iOS voice capture or assistant shortcut discovery is enabled.

The Android code gate is actual typed-note -> model-backed synthesis -> topic persistence, plus durable fallback/relaunch. It has passed on an Android 16 / API 36 / 16 KB emulator, including a cold-start worker using the verified Gemma model. A 3 GiB emulator run also passed the below-minimum Continue anyway path and synthesized a fresh typed capture while showing the warning. The compact home-screen widget presents two icon-labeled actions: Write and Record, with 48dp minimum tap targets, stronger outlined separation for Record, light/dark palettes, and a picker preview mirroring the actual actions on Android 12+. Signed v1.0.1 APK/AAB (versionCode 2) are built; release signatures and 16 KB native alignment pass. Play Console app-content declarations are complete, including Data Safety for IP-inferred approximate location, but production still holds the v1.0 draft. The public privacy policy was corrected on 2026-10-23. The Thought Notes listing draft has its text, AI-generated icon, and feature graphic saved; four current-brand phone screenshots are prepared locally. Play Console still needs at least two screenshots and the v1.0.1 bundle before review.

The app now checks device RAM, current available memory, storage, thermal state, and OS version on first launch. The recommended 585 MB Gemma3 model targets 4 GiB total RAM and 1 GiB available RAM; model downloads are stopped before transfer when free storage is below model size plus 512 MiB. Low-resource notes remain in Inbox and synthesis retries after readiness recovers while the app is active. Android requests constrained WorkManager retries when idle, battery is healthy, and storage is available; the OS controls if and when the task runs. iOS still relies on launch/foreground recovery and has no BGProcessingTask integration.

This scope supersedes older voice-MVP and headset release gates below; historical validation remains historical evidence.

## Android v1.0.1 verification — 2026-10-24

- Refined the Android widget with native button semantics, concise Write/Record labels, icon and pressed-state feedback, 48dp minimum tap targets, system light/dark palettes, and a visible Record outline so the secondary action stays distinct from the widget surface. The Android 12+ picker now previews the actual Write/Record controls. The updated widget has not been visually verified on a device.
- Latest signed release AAB: SHA-256 `d4b49cdd84ebdb902b14ec0d860c68bcfcea1f20819abdfc6a43acea97447049` (version 1.0.1 / versionCode 2), rebuilt after the widget's screen-reader copy update. `:app:bundleRelease` and Android resource processing pass. The last installed APK (SHA-256 `2ce0189bdc15d3dad5a9d38bc09e37a066fb91decbb8cef51833ce5962bb5d76`) includes the outlined Record action and Android 12+ picker preview. All 15 ARM64 native libraries pass the 16 KB check.
- Android preflight is 13/14: the signed v1.0.1 APK/AAB, Play metadata, and four 1080x2076 alpha-free Thought Notes screenshots pass. The only failure is local disk space (0.8 GB free versus the script's 20 GB archive threshold). The screenshots were recaptured from the current app on an API 30 emulator; the updated widget picker/launcher appearance still needs device review. The public privacy policy matches v1, which disables headset-button and lock-screen capture. The saved Console listing has the AI-generated icon and feature graphic, but 0 phone screenshots; Play requires at least two. Play Console still contains only the v1.0 (versionCode 1) production draft, and the v1.0.1 AAB has not uploaded because local-file access must be enabled manually in the Brave ChatGPT extension before attaching files. The closed-test Alpha track has no release.
- Physical app/widget voice-to-note transcription remains unverified on the latest release build.

## Android v1 verification — 2026-10-22

- Latest signed candidate (2026-10-22 02:02 IST): APK SHA-256 `9a0c84316e99773723a2e9d7b2414d21bf926cee124b11c879459c01c84b2a81`; AAB SHA-256 `d33bad1bc5774fa82aeb01bf1529892057da57189ba774a9426b2abc5682d06c`. Rebuilt `assembleRelease` and `bundleRelease` from current source using the cached Gradle home in offline, single-worker mode. The release preflight verifies both signatures and all 15 ARM64 native libraries for 16 KB alignment. Jest passed 37 suites / 245 tests, TypeScript and lint passed, Android release unit tests passed, and debug AndroidTest sources compile. Combined `npm run release:preflight` is 17/20. The Android-specific `npm run release:preflight:android` is 12/14; its only failures are 3.4 GB free versus the 20 GB local archive threshold and the five Play screenshots failing OCR because they show “Context Engine” instead of “Thought Notes.”
- Historical physical QA on a Redmi Note 10 Pro Max (Android 11/API 30) with Shokz OpenRun Pro 2 confirmed the Write/Record widget selected Bluetooth SCO input, but no intelligible headset transcript was captured; headset Play/Pause presses did not start capture. Headset-button and lock-screen paths are deferred from v1, so their unverified behavior does not block this release. The current widget picker/launcher appearance and physical app/widget voice-to-note transcription still need validation on a compatible Android target.
- Shokz's [OpenRun Pro 2 guide](https://shokz.com/blogs/guides/openrun-pro-2-using-guides) says triple-click returns to the previous track while music is playing. Android's [MediaSession callback contract](https://developer.android.com/reference/android/media/session/MediaSession.Callback) says callbacks run when the session has highest priority or a controller sends the event. Thought Notes keeps its session paused and plays no audio, so the accessory/OS may suppress or route the button elsewhere. Starting silent playback could make the app eligible but would claim media controls and may interrupt a user's current player; defer that product choice until the user is available. The Settings guidance now names the routing limit and offers the widget as a fallback.
- The quiet widget recording produced repeated `[Pause]` markers; the transcription filter now rejects that non-speech output. Inbox now offers a retry action for retained app-owned recordings, and file transcription uses the documented low-resource Whisper settings. Tests cover preserving audio on empty/error results and queueing only after durable cleanup. No intelligible physical-headset transcript was verified.


- On 2026-10-20, the signed, minified v1.0 (1) APK/AAB were rebuilt from current source, including the voice-recovery status label. The APK package is `com.meharaj.contextengine` (min SDK 24, target SDK 36); APK v2 and AAB signatures verify, and all 15 ARM64 native libraries pass the 16 KB alignment audit. APK SHA-256: `3fce20693432bf12a00523de0af15ae4562b95e21b71ba6e0f440e3069d891bb`; AAB SHA-256: `d78e668546b069efed568d2673e30874763f367099dd553f048471d47b652302`.
- Latest signed-release follow-up (2026-10-20): the Android PCM stop patch and non-speech `[SOUND]` filter are included. APK SHA-256: `e06c52d7d9fa3ab6cd03b38b38d92db4978d06fcb55d75b19e1231db9285d791`; AAB SHA-256: `81dac3dbb01f0316a055626ea236cb25f0f9a4cf3c51599a246e59ae68e95cd9`. APK v2 signature and the 16 KB audit pass (15 ARM64 libraries); the updated release APK installed and launched on the 3 GiB API 36 / 16 KB AVD.
- Final generated-speech retry (2026-10-20): the 6 GiB API 36 / 16 KB AVD was launched with `-allow-host-audio`, and runtime host-mic passthrough was enabled with `adb emu avd hostmicon`. Mac input gain was briefly raised from 27 to 100 and restored to 27. Recording started and stopped cleanly and the WAV remained in Inbox, but Whisper returned “wind blowing” with empty text; the app showed “No transcript is available.” This does not verify intelligible speech recognition. Emulator host-mic passthrough is now off. Screenshot: `../device-test-captures/android-api36-host-audio-no-transcript.png`.
- On that release, generated Mac speech recordings now stop without the prior native timeout and remain in Inbox. Whisper returned `[SOUND]` before the filter change and `[Music]` after it; the latest app surfaces “No transcript is available” and does not send the marker to synthesis. A typed note saved to Inbox; with Gemma not installed in this AVD, Queue showed 0 pending. This run does not verify successful live speech recognition or model-backed synthesis. Screenshots: `../device-test-captures/android-api36-release-voice-recovery-low-resource.png` and `../device-test-captures/android-api36-release-typed-capture.png`.
- Latest combined `npm run release:preflight` is 17/20; the Android-only `npm run release:preflight:android` is 12/14, excluding irrelevant Xcode and Apple signing checks. All Android package, API, permissions, signature, and 16 KB checks pass. The remaining Android preflight failures are 3.4 GB free disk versus the 20 GB threshold and all five Play screenshots showing old “Context Engine” branding. Other captured screens with “Thought Notes” branding contain existing Inbox text or outdated headset guidance, so they are not safe release substitutes. Play Console declarations and physical headset QA remain external release gates.
- Fresh-install smoke attempt on the clean API 36 / 16 KB AVD: Android package manager reported the production package installed, but QEMU then logged hung CPU threads and ADB disconnected before app launch could be confirmed. The exact rebuilt APK therefore has artifact checks, not fresh-launch evidence.
- Final release-APK smoke on the 3 GiB API 36 / 16 KB AVD passed: first-run RAM warning displayed, typed capture saved “Release smoke plan Friday” to Inbox, and the note remained after force-stop/relaunch. The installed package is non-debuggable and no app crash was observed. Screenshot: `../../device-test-captures/android-api36-release-first-run-readiness.png` and `../../device-test-captures/android-api36-release-relaunch-inbox.png`.
- Detox E2E passed 4/4 on the API 36 / 16 KB emulator: home/readiness, typed-note persistence, pasted-text import, and Inbox fallback after process relaunch. Detox's model and screenshot cases were skipped; real model inference was checked separately below.
- Focused follow-up on a fresh API 36 / 16 KB AVD passed 10 targeted Jest tests, `HeadsetTriplePressGateTest`, 2 synthetic headset media-key instrumentation cases, and 4 deterministic Detox journeys. The real-model Detox case was skipped without a local model path. Direct `ACTION_QUICK_CAPTURE` and `ACTION_QUICK_RECORD` intents opened the composer/keyboard and started/stopped capture; the widget provider was registered. This follow-up did not place the launcher widget; prior release-APK launcher testing is recorded separately.
- Android instrumentation passed 1/1 with the verified Gemma3 model installed in app-private test data. A cold-start worker synthesized and filed the note under its topic, retained the source transcript, and removed the Inbox copy after the categorized file was durable.
- Release-minified headset instrumentation passed 2/2 on a clean API 36 / 16 KB emulator with test-only R8 keep rules. It verifies synthetic media-key filtering and triple-press dispatch; physical accessory and lock-screen delivery remain unverified.
- Installed the final release APK, placed its 3×1 widget on the launcher, tapped Type and saved a note to Inbox, then tapped Record and confirmed microphone permission, live capture, and stop. A silent emulator recording produced an audio-retained Inbox fallback rather than a `[BLANK_AUDIO]` transcript.
- Downloaded Gemma3-1B-IT through the release app and verified release-mode synthesis end to end: “Atlas client review is on Thursday. Prepare pricing notes and send the updated deck before noon.” was filed under “Atlas client review,” with the actionable sentence saved as its note. Screenshot: `../device-test-captures/android-api36-release-model-synthesis-check.png`.
- Generated speech for “Schedule project review for tomorrow at ten” passed through Android recording and Whisper as “schedule project review for tomorrow at 10.” Gemma filed it under the `schedule project review` topic and Queue cleared. This validates the software audio pipeline through topic filing; it does not verify a physical headset route. Screenshot: `/tmp/contextengine-final-topic-detail.png`.
- A 3 GiB API 36 / 16 KB emulator reported 2.9 GB RAM and about 1.0 GB available. Continue anyway completed the 557 MiB model download; a preexisting Inbox item and a fresh typed capture (“Plan the Atlas support review for Thursday and assign follow-up owners.”) synthesized into their topics, and Queue showed 0 pending. The app stayed alive, with no OOM or crash signal. This verifies a successful attempt below the model's 4 GB recommendation at the observed available-memory level; it does not guarantee success on devices with less free RAM. Screenshots: `../../device-test-captures/android-api36-3gb-first-run-readiness.png`, `../../device-test-captures/android-api36-3gb-fresh-capture-result.png`, and `../../device-test-captures/android-api36-3gb-fresh-capture-queue-clear.png`.
- Latest low-memory regression on the 3 GiB API 36 / 16 KB AVD used the current-source debug app at 2.9 GB total and about 0.95 GiB available. The model bytes downloaded by the app were verified against catalog size and SHA-256, then staged in app-private storage for synthesis testing after the emulator's retry download stalled. Typing “Atlas follow up on Thursday” moved the note from Inbox to `Atlas follow up`, and Queue returned to 0; the process stayed alive. This tests current synthesis/resource behavior with a verified model, not the final release APK's download path. Screenshots: `../../device-test-captures/android-api36-2_9gb-readiness-warning.png`, `../../device-test-captures/android-api36-2_9gb-synthesized-topic.png`, and `../../device-test-captures/android-api36-2_9gb-queue-clear.png`.
- Fresh signed-release retest at 2.9 GB total RAM: two in-app Gemma downloads stopped near 35% when emulator DNS could not resolve `huggingface.co`; the third retry completed the 557 MB download and installed with the low-RAM warning. Typed capture “Atlas review Friday” then synthesized into the existing `Release smoke plan` topic, appeared with its source, and Queue returned to 0. The generated context text echoed the note and prior topic words, so this confirms the flow but exposes a synthesis-quality limitation. Screenshots: `../../device-test-captures/android-api36-release-2026-10-19-settings-installed-low-ram.png`, `../../device-test-captures/android-api36-release-2026-10-19-topic-detail-atlas-review.png`, and `../../device-test-captures/android-api36-release-2026-10-19-queue-empty.png`.
- Voice retest: macOS did not show Android Emulator as a separate microphone-permission entry. Selecting the MacBook Air microphone produced live input near -48 dBFS, but Whisper returned no usable transcript; the recording remained in Inbox with a needs-attention message. This validates the safe retention fallback, not speech recognition quality. The fresh run shows the home-screen attention state at `../../device-test-captures/android-api36-release-2026-10-19-voice-retained-inbox.png`; an Inbox-retention screenshot is at `../../device-test-captures/android-api36-2.4gb-empty-voice-retained.png`. Physical headset routing and lock-screen key delivery remain unverified.
- Follow-up speech E2E on the signed APK: generated “Schedule project review for tomorrow at ten” speech played through the Mac speakers into the emulator host microphone. Whisper returned “Share your project review for tomorrow at 10” (one word substituted); Gemma synthesized and filed the voice note under the existing `Atlas client review` topic, and Queue cleared. This verifies loopback capture → transcription → synthesis → filing, with imperfect speech recognition. It does not verify human speech or wired/Bluetooth headset mic/button routing. Screenshot: `../../device-test-captures/android-api36-release-generated-speech-topic.png`.
- Latest API 30 emulator loopback check generated the requested phrase and tried capture twice; Whisper returned `[MUSIC PLAYING]`/no usable transcript both times. The app retained each WAV in Inbox and did not queue invented text. Audio retention and timeout recovery now have regression coverage, but repeatable live speech recognition remains unverified.
- Follow-up synthetic phrase test on a 1.9 GB API 30 software-rendered AVD displayed the low-resource warning and saved the stopped recording to Inbox, but Whisper had not returned a transcript after more than five minutes. The AVD required an ADB microphone-permission grant, so the runtime permission prompt was not validated. The recording screen now surfaces its existing “Audio saved in Inbox; transcription continues” recovery state; the focused UI regression test, TypeScript check, and lint pass. Screenshot: `../../device-test-captures/android-api30-lowram-voice-transcribing.png`. This run does not verify transcription success.
- Voice-error copy now gives Inbox and microphone recovery guidance even while another status reports model-download progress. A short no-speech capture on the rebuilt signed APK showed the revised message, retained its audio in Inbox, and left Queue at 0. The focused Reflections screen test passes 4/4; TypeScript and project lint pass. The rebuilt APK installed and cold-launched without a fatal app exception. Screenshots: `../../device-test-captures/android-api36-release-2026-10-19-voice-error-copy-e2e.png` and `../../device-test-captures/android-api36-release-2026-10-19-postbuild-queue.png`.
- Low-RAM synthesis is best-effort: one later queue attempt logged a LiteRT-LM timeout and returned the source to Inbox. Queue cleared and the app stayed open, but below-minimum synthesis is not reliable on every attempt. Earlier low-RAM synthesis passes remain valid as successful attempts, not a guarantee.
- During a later AVD reboot, host memory pressure caused a transient Android System UI “isn't responding” dialog. Choosing Wait recovered the emulator and Context Engine opened; the emulator had fallen back to software graphics with about 4.7 GB host memory available. This was a startup/UI issue outside the app process, but it limits performance claims from this low-memory emulator run.
- The Type widget initially returned with the keyboard hidden after Android kept the composer focused in the background. Quick capture now blurs and refocuses the input; the final release build shows the keyboard on a real widget tap. The behavior has a focused regression test.
- Android headset handling counts three raw key presses within 1.2 seconds and debounces duplicate Activity/MediaSession delivery. For accessories that collapse their physical triple-click into one `Previous Track` transport command, the compatibility path triggers capture immediately; that command is ambiguous with a normal Previous Track press and still needs physical accessory validation. Synthetic Play/Pause events started and stopped recording on an installed release APK, but do not verify physical wired or Bluetooth routing.
- Latest full JS regression: TypeScript, 224 Jest tests, lint, and `git diff --check` pass. Audio/store retention tests cover WAV persistence before transcription and late transcript update/queue after the 30-second UI timeout.
- `npm run validate:current-phase` passed its JavaScript gates but failed the extra iOS simulator build with Xcode error 70; the Android release build succeeds.
- Latest combined release preflight is 17/20; the Android-only gate is 12/14. Android artifact/API/version/permission/data-safety checks, signing inputs, and the live privacy-policy URL pass. Android gate failures are the internal free-space threshold (currently 2.2 GB versus 20 GB) and stale Play screenshots that fail the new OCR branding check. The combined gate additionally reports missing Apple Distribution signing (iOS-only). Play App Signing recovery setup, final asset review, release upload, and the testing track/pre-launch report remain open.
- No Android target is connected in the current workspace. The Redmi Note 10 Pro Max (Android 11/API 30) previously verified Write/Record widget capture and Bluetooth SCO microphone routing, but not headset-key triggering, intelligible headset speech transcription, or lock-screen delivery. The Redmi 3S is API 23, below minSdk 24.

## Android v1 verification — 2026-10-18 (historical)

- A signed, minified APK and Play AAB were built before the headset-capture scope revision. They do not contain the current microphone/foreground-service manifest and must be rebuilt before upload; their signatures and sizes are historical evidence only.
- API 30 / 6 GB emulator Detox E2E passed 4/4: home/readiness, typed note persistence, pasted-text import, and Inbox persistence after process relaunch. The AVD remains visible for manual review.
- A debug-build Android instrumentation test passed 1/1 using the verified Gemma3 model. It cold-started the Headless JS worker, filed an Inbox note under the specific `Acme Invoice` topic, retained its exact source transcript, and removed the Inbox copy only after the categorized file was durable.
- The model run caught an overlong prompt (1,123 input tokens against Gemma3's 1,024-token limit). The prompt is now concise, topic history is capped at 240 characters for each of six topics, and the model is instructed to make minimal edits and preserve all details. Its verified result kept the Acme/client/invoice/tomorrow-morning details. TypeScript, lint, and all 31 Jest suites / 191 tests pass after the fix.
- The R8-minified release APK installed cleanly on API 30, launched `MainActivity` and the React Native entry, and saved a typed note into Inbox when no model was installed. The real-model worker test ran against the debug build because AndroidX Test bootstrap is incompatible with the minified Kotlin runtime; release launch and typed persistence were separately exercised on the APK.
- The prior release APK passed the 16 KB audit for all 15 ARM64 native libraries. Current source targets API 36, requires API 24+, packages arm64-v8a, disables backup, and declares Android microphone plus microphone-foreground-service permissions; the rebuilt packaged manifest still needs verification.
- Android screenshot assets include five alpha-free Play phone images. The real-model context image was captured from a successful live inference run.
- The last combined preflight was 15/17 for the prior text-only artifact. Rerun the Android permission check against a rebuilt APK/AAB; older disk and Apple signing results do not validate the revised release candidate.
- No compatible physical Android phone was tested. The connected Redmi 3S runs Android 6.0.1 / API 23, below the app minimum of API 24. A supported physical-device pass, Play Console upload-key enrollment/backup, Play App Signing confirmation, Data Safety and listing declarations, visual approval of listing assets, and the required testing track plus pre-launch report remain before production rollout.
- WorkManager's cold-start worker execution and constraint configuration have automated coverage; OS delivery under an idle-device window has not been exercised on a physical device.
- The current policy is published at the configured public Gist URL and the live contents pass release preflight.


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

## Android v1 exit criteria

The Android v1 can enter a Play testing track when:

- Typed capture, pasted text, local synthesis, topic filing, and raw Inbox fallback match the release listing and pass automated tests.
- The Play AAB is signed with the upload key enrolled in Play App Signing.
- The privacy policy is public at its listing URL, and Play Data Safety, content rating, age, regions, pricing, app access, and listing assets are reviewed in Console.
- Four current-brand phone screenshots and the feature graphic are reviewed in Console, and the uploaded AAB passes Play's pre-launch report and required testing track.
- Physical-device QA verifies on-demand typed and voice capture on Android 7.0/API 24 or later before production rollout.
- Headset button triggers and lock-screen microphone capture remain disabled in this release. A separate microphone foreground service is declared for an active app/widget recording; Android 13+ notification permission is requested for its visible Stop action.

Audio import, wake word, and assistant shortcuts remain future deliverables and are not Android v1 gates. Headset button and lock-screen capture will require fresh physical-device validation before a later release. Apple signing and App Store submission are tracked separately.
