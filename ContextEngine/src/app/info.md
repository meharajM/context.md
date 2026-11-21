# `src/app` Architecture

This directory owns app bootstrap and shell composition.

## Files

- `AppBootstrap.ts`: sets the `topics` storage directory path, loads persisted sections, and initializes audio and synthesis. Speech fixture probing is started manually from Android development Settings.
- `AppShell.tsx`: top-level route state, header selection, scroll layout, bottom navigation, composer placement, runtime lifecycle logging, and feature screen wiring for reflections, queue, import, settings, meetings, thread details, and note editing. iOS widget Write/Record requests open a quick-capture sheet because WidgetKit links launch the app.
- `AppShell.tsx` shows a persisted first-run tutorial after context/readiness bootstrap; Skip/Start remain available while voice setup runs, and Home recording can start before a transcription model is ready.
- A recording can start while transcription setup is unavailable; source audio remains in Inbox and retries when the model becomes ready.
- `App.tsx` mounts the Android widget and recording-notification request hook; native Stop requests call the store stop action without introducing a feature-screen/native dependency.
- `navigation.ts`: route type definitions.

## Responsibilities

- Keep native/bootstrap concerns out of feature screens.
- Keep navigation lightweight and local to the app shell until a dedicated navigator is introduced.
- Pass feature screens already-shaped props from selectors or store state.

## Notes For Agents

- `AppShell` currently uses local route state rather than React Navigation.
- Search navigation carries the matched stable note id into thread details; the shell scrolls its existing ScrollView to the measured capture row. Home status actions use the existing queue and thread routes.
- `AppShell` mounts the Android opt-in headset triple-tap listener; iOS Lock Screen widget requests use the same app handoff as home-screen widget capture.
- The composer is intentionally shown only on the reflections route.
- The Home and Waiting scroll content fill the available viewport so their empty states can sit in the remaining space; other routes retain content-driven scrolling.
- While a voice recording is active, AppShell exposes a Stop action on other routes; the reflections composer keeps Stop available even when the user has typed text.
- The import route is a first-class shell route and renders the dedicated import workflow.
- The bottom `Paste` route distinguishes long-form paste/share from Home quick capture; incoming shared responses still route automatically into the import flow.
- Incoming shared text opens Import unless a note editor is active; in that case navigation waits until the editor is saved or closed.
- If shared text reaches a topic-routing clarification while Import is active, AppShell opens Waiting so the user sees the focused question and topic choices; a clarification discovered on Home remains reachable from the Home status action.
- The brand header stays concise; route-specific screen copy explains the task. Dismissing the first-run readiness card resets Home scroll so its capture prompt remains visible after the card collapses.
- Settings model refresh is triggered when the route enters `settings`.
- Settings exposes on-demand voice recording and Android opt-in headset/lock-screen controls; iOS Record uses the Lock Screen widget app handoff and does not claim direct headset-button support.
- The Android home-screen widget has separate Write and Record actions; native launch requests are queued until the React Native listeners register.
- Thread details wire share actions through `src/shared/utils/share.ts`.
- Thread details can request a FunctionGemma research plan and share task plus thread context to a user-selected app. The user must send the request in ChatGPT and share the response back through the OS import flow; this is not unattended cross-app automation. Assistant prompts request plain text capped at 250 words with fixed note-ready headings; research responses also keep clickable sources and dates.
- Meeting detail wires section-selected sharing (summary, transcript, actions, or all), an explicit all-content assistant prompt with the same 250-word response format, and idempotent full-content save/update through the same shell/store boundaries.
- Persisted-note editing keeps original source metadata separate from display-only transcript fields; text-note transcript metadata stays hidden in the timeline and is preserved when re-queued.
- The Inbox thread can enqueue existing fallback entries for another synthesis pass.
- The Inbox thread exposes confirmation-based deletion for persisted unsynthesized notes and delegates note/audio mutation to guarded store actions.
- Bootstrap eagerly initializes synthesis so persisted Inbox entries can be silently requeued on launch.
- A completed writing-model download configures the synthesis runtime and requeues Inbox; LiteRT model memory is allocated only when queued synthesis work starts, not as a download-completion probe.
- Bootstrap performs a first-run device readiness assessment before model inference; the store rechecks on launch and foreground so temporary memory/thermal blocks can clear without an app restart.
- The welcome tutorial is separate from readiness-notice dismissal. Existing users with saved sections or a dismissed readiness notice skip this new-install experience.
- Eligible Android and iOS devices automatically download audio-capable Gemma for transcription and synthesis. Lower-resource devices pair the smaller Gemma writing model with Whisper. Voice capture can start while transcription setup is pending; its WAV stays recoverable in Inbox.

## Release Scope

Both mobile platforms use `src/core/releaseCapabilities.ts` to enable on-demand voice capture while keeping audio import, assistant voice, and wake word gated. Source selects Gemma 3n for transcription and note organization on eligible Android and iOS devices, or Whisper with Gemma3-1B on lower-resource devices. Android's published app remains on its existing Whisper path until this source is released. iOS WidgetKit links open the app through the registered URL scheme; Write presents a quick-note sheet and Record presents controls while starting capture. Import headers describe text imports.

Device readiness is surfaced in the home screen once per install. Synthesis work that cannot run under current resource pressure remains recoverable from Inbox and resumes when the app is active and readiness recovers. Android also requests constrained WorkManager retries for temporary resource blocks; iOS currently has no OS-managed background synthesis.

Bootstrap drains Android native quick-text replies into durable Inbox notes before loading context and initializing synthesis. Drain failure leaves the native outbox intact and does not prevent normal app startup.

## Navigation draft retention

Home composer and Import remain mounted while their route is inactive; hidden wrappers leave the layout and accessibility tree. Import modals also receive the active-route flag. The shared ScrollView resets position and dismisses the keyboard on route changes instead of using a route key that would remount draft owners. Drafts survive ordinary navigation only, not process restarts. Topic navigation uses an exact-header encoded identity shared by recent-topic and search selectors, so section reordering cannot redirect details, sharing, or editor return.

The header's Done action appears after `keyboardDidShow` and remains available until `keyboardDidHide`; keyboard layout height is measured and reset on the corresponding will-events where iOS provides them.
