# Thought Notes Privacy Policy

Effective date: 2026-10-31

Publisher: **UMCreations**

Contact: **meharaj137@gmail.com**

This policy describes the Android v1 release and the text-only iOS release.

## Current release and data you provide

The Android release accepts typed notes, pasted text, text shared from other apps, quick text entered in the home-screen widget's compact capture sheet, and optional user-initiated voice capture. In versions supporting automatic filing, Android text shared from another app may be organized and saved on-device when the local model is ready. If processing cannot finish, the shared text remains recoverable in the app. Manually pasted imports use the existing review flow. Quick text is saved on the device when the user submits it from the widget capture sheet. Voice capture starts only when the user taps Record in the app or home-screen widget. Widget recording starts a microphone foreground service without opening the main app; the widget shows an active timer and Stop action, and the user can also stop it from the service notification when Android displays that notification. In-app recording continues to use the app's visible controls. The app does not start unattended capture, continuously listen for speech, or use a wake word. The iOS release supports typed notes and pasted text only.

On Android, microphone permission is requested when needed. Captured audio is transcribed on-device with the English Whisper tiny.en model, then the transcript is stored in Inbox before local synthesis and topic filing. Successfully transcribed working audio is normally deleted after the transcript is safely saved; if cleanup fails, it can remain in private app storage. If recording or transcription fails or is aborted, the app retains the recording in private app storage and associates it with the Inbox note so the user can review or delete it. Widget voice capture uses the active Android microphone route and writes the same private WAV format used by app capture. Audio import, wake words, assistant voice intents, and spoken summaries are future deliverables. Existing local voice-note metadata from development versions may remain readable; only app-owned retained recordings can be deleted through the guarded deletion controls.

## Processing and storage

Notes, shared and quick-captured text, captured audio, transcription, and organization results are processed on the device. Whisper transcribes user-started recordings locally. In-app capture may route to a compatible wired or Bluetooth microphone; widget capture uses Android's active input route. LiteRT-LM models organize notes locally and may generate a short per-capture summary separate from the preserved original. Long captures may require multiple bounded processing steps and take time. When organization is unavailable or fails, captured notes remain in Inbox; shared text remains in app-private storage for review or retry. Android stores notes and retained recordings in app-private storage.

Android users may enable Automatic reminders in Settings. When enabled, new saved notes are checked on-device for likely tasks, categories, priorities, and reminder times; the app does not ask the user to fill out task details. It uses the installed local model when available, with simple on-device rules for clear tasks if the model is unavailable. Reminder details stay in app-private storage and Android schedules the notification. Turning the setting off cancels pending reminder notifications and clears their saved reminder details. Android 13 and later may ask for notification permission when the user enables reminders; Android controls how notifications appear on the lock screen. Reminders are optional and are not sent to a cloud AI service.

Android automatic application backup is disabled. On Apple devices, operating-system backup settings may include application documents. Thought Notes does not operate an automatic backup or synchronization service. Users can choose to export a plain JSON library backup from Settings; it contains note text, transcripts, timestamps, and source details, but not audio recordings or device-specific audio paths.

## Network access and model downloads

On Android, the app automatically downloads the 32 MB English Whisper transcription model from Hugging Face over HTTPS on first launch when it is missing. The file is saved in private app storage; voice transcription then runs locally and works offline. If download fails or storage is unavailable, voice capture remains unavailable until setup succeeds. Compatible devices may also automatically download the local writing model when device readiness and storage allow; app controls provide its download and retry actions. Download requests contain model files only, not note text, topic files, or recordings. Hosting providers receive normal connection information such as IP address, request time, and requested model URL under their own privacy terms.

## Sharing

Content leaves through another application only when the user invokes sharing and chooses a destination in the OS share sheet. That destination handles shared content under its own policy.

On Android, users can also choose Thought Notes as a destination in another app's share sheet. The selected text is held in app-private storage and may be automatically organized on-device when the model is ready. If organization is unavailable or fails, it remains recoverable for review or retry. Manually pasted text follows the separate review flow. Text entered and submitted through the home-screen quick-capture notification is saved locally for processing into a note.

When a user exports a backup, the operating system asks where to save the JSON file. The app does not upload it. If the user selects a cloud-backed file provider, that provider handles the file under its own privacy terms. Restore reads a selected backup and merges it into local notes without replacing existing content.

## Publisher collection

The app has no publisher-operated account, ads, analytics, crash reporting or cloud AI backend. The current release does not intentionally transmit note content, audio, identifiers or diagnostics to the publisher. Any future remote processing or additional voice features beyond this Android capture flow require a policy update before release.

## Retention and deletion

Content stays locally until deleted through available controls, app data is cleared, or the app is removed, unless the user chooses to share or export it. Inbox notes can be deleted individually with confirmation when not actively processing. Categorized notes currently support editing and sharing; the current UI does not promise individual deletion of categorized history. OS uninstall and backup behaviour remains under device settings.

## Permissions

Internet access supports model downloads, including automatic downloads on compatible Android devices when readiness and storage allow. Android requests microphone access for user-initiated recording and Bluetooth-device access on Android 12 and later to route an in-app recording to a connected headset microphone. If Bluetooth-device access is declined or no compatible headset is connected, recording uses the phone microphone. Android keeps only an already user-started recording active in the background, using a microphone foreground service; Android 13+ requests notification access for that visible Stop action and for optional Automatic reminders. It does not start recording in the background, and denying notification access does not block capture. The iOS release is text-only and does not request microphone access. The app does not request contacts, location, or broad shared-storage access.

## Audience and device security

The Play listing targets adults 18+. Play Console audience and content-rating declarations must match the submitted app. The app relies on the device sandbox and operating-system security. Users should protect access to their device and manage device backups for locally stored notes.

## Changes and contact

Material changes will update this policy before shipping. Privacy questions can be sent to **meharaj137@gmail.com**.
