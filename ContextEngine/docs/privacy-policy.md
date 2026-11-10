# Thought Notes Privacy Policy

Effective date: 2026-11-01

Publisher: **UMCreations**

Contact: **meharaj137@gmail.com**

This policy describes the Android and iOS app releases.

## Current release and data you provide

The Android release accepts typed notes, pasted text, text shared from other apps, quick text entered in the home-screen widget's compact capture sheet, and optional user-initiated voice capture. In versions supporting automatic filing, Android text shared from another app may be organized and saved on-device when the local model is ready. If processing cannot finish, the shared text remains recoverable in the app. Manually pasted imports use the existing review flow. Quick text is saved on the device when the user submits it from the widget capture sheet. Voice capture starts only when the user taps Record in the app or home-screen widget. Widget recording starts a microphone foreground service without opening the main app; the widget shows an active timer and Stop action, and the user can also stop it from the service notification when Android displays that notification. In-app recording continues to use the app's visible controls.

The iOS release accepts typed notes, text shared from other apps, pasted text, and optional voice capture started from the app. Its iOS 17+ home-screen widget opens the app for Write or Record; it does not start an independent recording from the widget. An in-app recording already started by the user can continue while the app is backgrounded; the user returns to Thought Notes to stop it. Neither app starts unattended capture, continuously listens for speech, or uses a wake word.

On Android, microphone permission is requested when needed. Captured audio is transcribed on-device with the selected English Whisper tiny.en model or the optional Hindi / Hinglish multilingual model, then the transcript is stored in Inbox before local synthesis and topic filing. English setup downloads automatically; users choose whether to download and select the Hindi / Hinglish model in Settings. Successfully transcribed working audio is normally deleted after the transcript is safely saved; if cleanup fails, it can remain in private app storage. If recording or transcription fails or is aborted, the app retains the recording in private app storage and associates it with the Inbox note so the user can review or delete it. Widget voice capture uses the active Android microphone route and writes the same private WAV format used by app capture.

On iOS, microphone permission is requested when the user starts an in-app recording. The bundled English Whisper tiny.en model is the default; users can download and select the optional Hindi / Hinglish multilingual model in Settings. Transcription runs on-device. The transcript is saved in Inbox before local synthesis and topic filing; interrupted or failed captures remain available for recovery in app-private storage. Audio-file import, wake words, assistant voice intents, headset triggers, and spoken summaries are not available in the current release scope.

## Processing and storage

Notes, shared and quick-captured text, captured audio, transcription, and organization results are processed on the device. Whisper transcribes user-started recordings locally. In-app capture may route to a compatible wired or Bluetooth microphone; Android widget capture uses Android's active input route. LiteRT-LM models organize notes locally and may generate a short per-capture summary separate from the preserved original. Long captures may require multiple bounded processing steps and take time. When organization is unavailable or fails, captured notes remain in Inbox; shared text remains in app-private storage for review or retry. Android stores notes and retained recordings in app-private storage; iOS stores them in the app's sandbox.

Users may enable Automatic reminders in Settings on Android or iOS. When enabled, new saved notes are checked on-device for likely tasks, categories, priorities, and reminder times; the app does not ask the user to fill out task details. It uses the installed local model when available, with simple on-device rules for clear tasks if the model is unavailable. Reminder details stay in app-private storage and the operating system schedules the notification. Turning the setting off cancels pending reminder notifications and clears their saved reminder details. Android 13 and later may ask for notification permission; iOS asks for alert and sound authorization. Reminders are optional and are not sent to a cloud AI service.

Android automatic application backup is disabled. On Apple devices, operating-system backup settings may include application documents. Thought Notes does not operate an automatic backup or synchronization service. Users can choose to export a plain JSON library backup from Settings; it contains note text, transcripts, timestamps, and source details, but not audio recordings or device-specific audio paths.

## Network access and model downloads

On Android, the app downloads the English Whisper transcription model from Hugging Face over HTTPS when voice setup is needed. On iOS, the English Whisper model is bundled with the app. Users on either platform may separately request the Hindi / Hinglish model from Settings. Voice transcription then runs locally. Both platforms may also download an optional local writing model when device readiness and storage allow; app controls provide download and retry actions. Download requests contain model files only, not note text, topic files, or recordings. Hosting providers receive normal connection information such as IP address, request time, and requested model URL under their own privacy terms.

## Sharing

Content leaves through another application only when the user invokes sharing and chooses a destination in the OS share sheet. That destination handles shared content under its own policy.

On Android and iOS, users can also choose Thought Notes as a destination in another app's share sheet. The selected text is held in app-private storage and may be automatically organized on-device when the model is ready. If organization is unavailable or fails, it remains recoverable for review or retry. Manually pasted text follows the separate review flow. Android quick text entered through the home-screen widget capture sheet is saved locally when the user submits it.

When a user exports a backup, the operating system asks where to save the JSON file. The app does not upload it. If the user selects a cloud-backed file provider, that provider handles the file under its own privacy terms. Restore reads a selected backup and merges it into local notes without replacing existing content.

## Publisher collection

The app has no publisher-operated account, ads, analytics, crash reporting or cloud AI backend. The current release does not intentionally transmit note content, audio, identifiers or diagnostics to the publisher. Any future remote processing requires a policy update before release.

## Retention and deletion

Content stays locally until deleted through available controls, app data is cleared, or the app is removed, unless the user chooses to share or export it. Inbox notes can be deleted individually with confirmation when not actively processing. Categorized notes currently support editing and sharing; the current UI does not promise individual deletion of categorized history. OS uninstall and backup behaviour remains under device settings.

## Permissions

Internet access supports model downloads. Android requests microphone access for user-initiated recording and Bluetooth-device access on Android 12 and later to route in-app recording to a connected headset microphone. If Bluetooth-device access is declined or no compatible headset is connected, recording uses the phone microphone. Android keeps an already user-started recording active in the background with a microphone foreground service; Android 13+ may request notification access for the visible Stop action and optional Automatic reminders. Denying notification access does not block in-app capture. iOS requests microphone access when the user starts voice capture and notification authorization when the user enables reminders. An iOS recording started in the app can continue while backgrounded; the user returns to Thought Notes to stop it. The app does not start recording in the background. Neither platform requests contacts, location, or broad shared-storage access.

## Audience and device security

The Play listing targets adults 18+. Play Console audience and content-rating declarations must match the submitted app. The app relies on the device sandbox and operating-system security. Users should protect access to their device and manage device backups for locally stored notes.

## Changes and contact

Material changes will update this policy before shipping. Privacy questions can be sent to **meharaj137@gmail.com**.
