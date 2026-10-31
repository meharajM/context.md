# Automatic reminders implementation

## Scope and constraints

- Android feature, off by default, controlled by one Settings switch.
- Infer task, category, priority and reminder time without a detail form or confirmation. Local processing only.
- New notes captured after enabling are eligible. Resolve relative dates against note capture time in device local time. Clear completed/past/non-task notes produce no reminders.
- Default same-day undated errands to 19:00, other defaults by priority/category. Late captures use a near-term future time; do not schedule after an explicit deadline. Persist one inferred reminder per note, representing its actionable task.
- Save notes first. Reminder side effects must not throw into capture, editing, topic filing, sharing, backup or restoration. With the toggle off, no reminder inference or scheduling.
- Retain original note identity across topic filing. Do not duplicate notifications after reload or topic movement. Edits replace pending reminders; deleting a note cancels its reminder.
- Disabling cancels pending reminders and reminder notifications, including work returning from an old enable session.
- No exact-alarm permission, cloud calls, or always-running service. Use Android's inexact alarms and ordinary notification permission. OS delivery can be delayed.

## Android scheduler task and bridge contract

Own new AutomaticReminderScheduler.kt, AutomaticReminderModule.kt, AutomaticReminderReceiver.kt; register in ContextEnginePackage.kt and AndroidManifest.xml; add only reminder strings/icon if needed. Do not edit existing capture services, BackgroundSynthesisWorker, or LiteRtModule.

Native module name: AutomaticReminderModule.

- getState(): Promise<string> JSON state.
- setEnabled(enabled: boolean): Promise<string> updated JSON state. Default disabled. Every fresh enable records enabledAt=now; an idempotent true preserves enabledAt. Off disables immediately, cancels all reminder alarms/notifications and clears reminder records.
- reconcileNote(noteId: string, fingerprint: string, enabledAt: number, inferredWithAi: boolean, planJson: string): Promise<boolean>. Empty planJson means non-task. Reject stale generations or disabled calls with false. Validate all input lengths/types/times. Same fingerprint delivered/done records must not re-notify. A model result can upgrade an unexpired pending fallback; edits with a new fingerprint replace prior records.
- cancelMissingNotes(noteIds: string[], enabledAt: number): Promise<boolean>, cancel only records absent from current complete library, guard generation.

State JSON: {enabled:boolean, enabledAt:number, records: Array<{noteId:string,fingerprint:string,inferredWithAi:boolean,status:'none'|'scheduled'|'delivered'|'done',title?:string,category?:string,priority?:'low'|'normal'|'high',fireAt?:number,expiresAt?:number}>}.

Plan JSON: {title:string,category:string,priority:'low'|'normal'|'high',fireAt:number,expiresAt:number}. Enforce fireAt > now, expiresAt > fireAt, maximum 366 days in future, bounded safe title/category. Persist with app-private AtomicFile; preserve corrupt data rather than resetting it silently.

Unique immutable broadcast PendingIntents with stable identities. Fire receiver validates generation/fingerprint/status/expiry and notification permission before delivery. Notification has ordinary priority channel, private lock-screen content, Done and Snooze 15 min actions, and tap opens existing MainActivity. Done changes reminder state only, never note data. Snooze stays within expiry.

Restore schedules after BOOT_COMPLETED, TIME_SET and MY_PACKAGE_REPLACED. getState should also retry persisted scheduled alarms so failed scheduling is recoverable. Never touch recording notification channels/IDs. No exported action receiver; boot/update receiver as platform requires. Checks off flag before every action.

Add focused Android instrumentation coverage with isolated files and preferences, no app-data clear or model dependency. Do not run Gradle concurrently; parent will run integrated builds/tests.

## Parent tasks

1. Add bounded local-AI reminder inference using the existing serialized runtime; preserve current topic-generation path unchanged.
2. Add date/priority/category planning and safe no-model fallback for clear local date phrases.
3. Add independent scan service and Settings section. Observe durable sections; support cold widget captures through reminder-only headless worker requests using existing RN/WorkManager machinery.
4. Run focused inference/scheduling/UI tests, core regression, Android build and emulator smoke. Document remaining device/OS limitations.

## Progress

- Implemented Android reminder module, persisted toggle, generation-safe inexact alarms, notification actions, boot/time/package restore, and per-note lifecycle synchronization.
- Implemented a Settings-only opt-in switch; task details, topic, priority, and time are inferred without a user questionnaire. New notes only are considered after the switch is enabled.
- Reuses the existing serialized local LiteRT model through a bounded extraction call. Clear tasks keep a local fallback schedule when the model is missing, unavailable, invalid, or abstains. Reminder failures are isolated from note capture and topic processing.
- Widget text and voice-recovery paths request reminder-only WorkManager processing after durable capture. Text outbox work is checked before retained-audio decoding.
- Preserved Android topic note writes with opt-in fsync barriers after emulator hard-power-off QA exposed an empty synthetic topic file; only topic staging/promotion paths request this behavior.
- Automated checks: 498 JavaScript tests, TypeScript, lint, Android debug/AndroidTest/unit-test builds, and four Android instrumentation tests pass. The notification instrumentation test posts a private reminder notification, checks its Done/Snooze actions, then completes and removes it.
- API 36 16 KB emulator smoke used the real local Gemma model: a new “Buy milk today” note became a normal-priority shopping reminder for 7 PM; “buy bread tomorrow” became a 7 PM reminder the following day despite the model returning an ungrounded clock time. Neither capture asked for reminder details.
- Reminders were turned off after QA; the app-private journal has no pending records and test notes remain. A hard emulator power-off then preserved topic-file SHA-256 hashes and the disabled reminder state exactly.
- Remaining limit: physical hardware and enabled-alarm restoration across reboot were not exercised. Android inexact alarms may be delayed by OS battery/resource policy.
