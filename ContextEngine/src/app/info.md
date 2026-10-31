# `src/app` Architecture

This directory owns app bootstrap and shell composition.

## Files

- `AppBootstrap.ts`: sets the `topics` storage directory path, loads persisted sections, and initializes audio and synthesis. Speech fixture probing is started manually from Android development Settings.
- `AppShell.tsx`: top-level route state, header selection, scroll layout, bottom navigation, composer placement, runtime lifecycle logging, and feature screen wiring for reflections, queue, import, settings, thread details, and note editing.
- `AppShell.tsx` shows a persisted first-run tutorial after context/readiness bootstrap; Skip/Start unlock after Android Whisper is ready, retry is available on setup failure, and the Home composer remains available.
- `App.tsx` mounts the Android widget and recording-notification request hook; native Stop requests call the store stop action without introducing a feature-screen/native dependency.
- `navigation.ts`: route type definitions.

## Responsibilities

- Keep native/bootstrap concerns out of feature screens.
- Keep navigation lightweight and local to the app shell until a dedicated navigator is introduced.
- Pass feature screens already-shaped props from selectors or store state.

## Notes For Agents

- `AppShell` currently uses local route state rather than React Navigation.
- Search navigation carries the matched stable note id into thread details; the shell scrolls its existing ScrollView to the measured capture row. Home status actions use the existing queue and thread routes.
- `AppShell` mounts the Android-gated headset triple-tap listener for the foreground capture session.
- The composer is intentionally shown only on the reflections route.
- The Home and Waiting scroll content fill the available viewport so their empty states can sit in the remaining space; other routes retain content-driven scrolling.
- While a voice recording is active, AppShell exposes a Stop action on other routes; the reflections composer keeps Stop available even when the user has typed text.
- The import route is a first-class shell route and renders the dedicated import workflow.
- The bottom `Paste` route distinguishes long-form paste/share from Home quick capture; incoming shared responses still route automatically into the import flow.
- Incoming shared text opens Import unless a note editor is active; in that case navigation waits until the editor is saved or closed.
- The brand header stays concise; route-specific screen copy explains the task. Dismissing the first-run readiness card resets Home scroll so its capture prompt remains visible after the card collapses.
- Settings model refresh is triggered when the route enters `settings`.
- Settings exposes on-demand voice recording; headset button triggers remain deferred for v1.
- The Android home-screen widget has separate Write and Record actions; native launch requests are queued until the React Native listeners register.
- Thread details wire share actions through `src/shared/utils/share.ts`.
- Persisted-note editing keeps original source metadata separate from display-only transcript fields; text-note transcript metadata stays hidden in the timeline and is preserved when re-queued.
- The Inbox thread can enqueue existing fallback entries for another synthesis pass.
- The Inbox thread exposes confirmation-based deletion for persisted unsynthesized notes and delegates note/audio mutation to guarded store actions.
- Bootstrap eagerly initializes synthesis so persisted Inbox entries can be silently requeued on launch.
- Bootstrap performs a first-run device readiness assessment before model inference; the store rechecks on launch and foreground so temporary memory/thermal blocks can clear without an app restart.
- The welcome tutorial is separate from readiness-notice dismissal. Existing users with saved sections or a dismissed readiness notice skip this new-install experience.
- Android engine initialization starts a download of the pinned Whisper model when it is missing. Home shows setup progress; Settings offers retry after failure. This speech-model flow is separate from local writing-model management.

## Release Scope

Android uses `src/core/releaseCapabilities.ts` to enable on-demand voice capture while keeping audio import, assistant voice, and wake word gated. On first launch, Bootstrap checks Whisper readiness and automatically downloads the pinned model if missing; recording uses the installed local model. iOS remains text-only. Import headers describe text imports.

Device readiness is surfaced in the home screen once per install. Synthesis work that cannot run under current resource pressure remains recoverable from Inbox and resumes when the app is active and readiness recovers. Android also requests constrained WorkManager retries for temporary resource blocks; iOS currently has no OS-managed background synthesis.

Bootstrap drains Android native quick-text replies into durable Inbox notes before loading context and initializing synthesis. Drain failure leaves the native outbox intact and does not prevent normal app startup.

## Navigation draft retention

Home composer and Import remain mounted while their route is inactive; hidden wrappers leave the layout and accessibility tree. Import modals also receive the active-route flag. The shared ScrollView resets position and dismisses the keyboard on route changes instead of using a route key that would remount draft owners. Drafts survive ordinary navigation only, not process restarts. Topic navigation uses an exact-header encoded identity shared by recent-topic and search selectors, so section reordering cannot redirect details, sharing, or editor return.

The header's Done action appears after `keyboardDidShow` and remains available until `keyboardDidHide`; keyboard layout height is measured and reset on the corresponding will-events where iOS provides them.
