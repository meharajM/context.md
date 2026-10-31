# Android Instrumentation Tests

## Purpose

`BackgroundSynthesisWorkerInstrumentedTest` starts the production WorkManager worker in a cold React Native process, runs the registered Headless JS queue task with a verified local Gemma model, and checks that an Inbox source is removed only after its categorized topic copy is durable. Run it separately from Detox with the debug AndroidTest APK and a 6 GB API 30+ emulator that has the verified model and manifest installed under app-private `files/models/`. A release variant is also buildable, but AndroidX Test instrumentation is incompatible with the app's release-shrunk Kotlin runtime; keep this check on the debug variant and verify the signed release by install/launch smoke.

`ContextEngineAndroidTestRunner` applies a `DetoxTest` class filter only when Detox supplies `detoxServer` and no explicit `class` argument. This prevents app instrumentation tests from starting alongside UI journeys and mutating their fixtures. Regular native runs accept AndroidJUnitRunner's `class` filter, for example `adb shell am instrument -w -e class com.meharaj.contextengine.QuickTextCaptureInstrumentedTest#captureWidgetFitsItsMinimumAndExpandedWidths com.meharaj.contextengine.e2e.test/com.meharaj.contextengine.ContextEngineAndroidTestRunner`.

`QuickTextCaptureInstrumentedTest` uses isolated app-cache outbox fixtures to verify malformed-record and invalid-timestamp retention, later valid captures, and duplicate-save identity. System-notification checks verify distinct reply PendingIntents, stale success suppression, separately retained stale failures, and current-result updates. It needs notification access and no model; validated on the connected API 30 emulator.

Its widget layout tests also cover compact/expanded widths, taller launcher slots, light/dark resources, larger text, a long recording counter, and accessible icon actions at 2.0 text scale. These two methods pass on API 36 without clearing app data. Passing `-e captureWidgetPreviews true` saves optional native layout PNGs to the target app's external-files directory; the normal test run writes no previews.
