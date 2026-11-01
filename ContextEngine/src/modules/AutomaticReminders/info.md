# Automatic reminders

Opt-in reminder inference on Android and iOS that remains separate from note persistence and topic organization.

- `index.ts` reads the complete saved library, checks only notes created after the native enable timestamp, and asks the existing serialized LiteRT runtime for a bounded task suggestion. A local rules fallback handles clear tasks if the model is unavailable or abstains. Failures are contained after durable note save.
- `planning.ts` bounds model input/output, parses the suggestion, resolves relative dates from capture time, infers simple categories/priority, and applies safe local reminder defaults.
- `AutomaticRemindersSection.tsx` is the one Settings toggle. There is no task-detail form. Android requests notification permission when required; iOS requests alert/sound authorization through `UNUserNotificationCenter`.
- Native Android `AutomaticReminderScheduler` persists records with AtomicFile, deduplicates by note ID/fingerprint, schedules inexact alarms, posts Done/Snooze notifications, and restores after boot/time/package changes.
- Native iOS `AutomaticReminderModule` persists bounded reminder records in `UserDefaults`, schedules calendar notifications, provides Done/Snooze actions, and cancels removed-note reminders. iOS and Android use the same local inference and planning code.
- Turning off invalidates queued work and clears pending reminders on both platforms.
- The existing note store, topic model prompt, capture state, transcription, and share flow are not owned by this module. Reminder scan failures do not reject them.
- Limitation: one actionable reminder is inferred per note. Long notes are represented by bounded first/last excerpts for the local model. Android may delay inexact alarms; iOS delivery follows notification authorization and system scheduling.
