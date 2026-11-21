# Thought Notes Privacy Policy

Effective date: 2026-11-21

Publisher: **UMCreations**

Contact: **meharaj137@gmail.com**

This policy describes the Android and iOS app releases.

## Current release and data you provide

The Android release accepts typed notes, pasted text, text shared from other apps, quick text entered in the home-screen widget's compact capture sheet, and optional user-initiated voice capture. In versions supporting automatic filing, Android text shared from another app may be organized and saved on-device when the local model is ready. If processing cannot finish, the shared text remains recoverable in the app. Manually pasted imports use the existing review flow. Quick text is saved on the device when the user submits it from the widget capture sheet. Voice capture starts only after an explicit action in the app, home-screen widget, or opted-in Android headset/lock-screen flow. Widget recording starts a microphone foreground service without opening the main app; the widget shows an active timer and Stop action, and the user can also stop it from the service notification when Android displays that notification. In-app recording continues to use the app's visible controls.

The iOS release accepts typed notes, text shared from other apps, pasted text, and optional voice capture started in the app. Its iOS 17+ Home and Lock Screen widgets hand off Write or Record to the app; they do not host text entry or microphone recording. An in-app recording already started by the user can continue while the app is backgrounded; the user returns to Thought Notes to stop it. Neither app starts unattended capture, continuously listens for speech, or uses a wake word.

Android 1.0.8 adds Meeting mode for in-person room meetings. Recording begins only after the user taps Start in the app; the Meeting widget opens that screen and never starts recording. Android keeps a visible microphone foreground-service notification while a meeting is recording, including when the user switches apps. The phone or connected microphone captures room audio; the app does not capture audio from other apps or phone calls. Meeting audio is transcribed in English on-device into timestamped chunks. Processing may lag on slower devices. Speaker labels are not provided. After Stop, the app saves the full transcript before automatically attempting a local summary and suggested actions. A summary requires the optional on-device writing model and sufficient device resources; if unavailable, the transcript and any recognized-speech highlights remain available. Suggested actions are based on recognized speech and must be reviewed, kept, or dismissed by the user; keeping one does not schedule a reminder.

On Android, microphone permission is requested when needed. Eligible physical devices use Gemma 3n E2B for local English speech transcription and note organization; lower-resource devices use Whisper tiny.en for transcription and Gemma3-1B for writing. The transcript is stored in Inbox before local synthesis and topic filing. Successfully transcribed working audio is normally deleted after the transcript is safely saved; if cleanup fails, it can remain in private app storage. If recording or transcription fails or is aborted, the app retains the recording in private app storage and associates it with the Inbox note so the user can review or delete it. Widget voice capture uses the active Android microphone route and writes the same private WAV format used by app capture.

On iOS, microphone permission is requested when the user starts a recording. The app checks device RAM and free storage to choose the local voice setup. Compatible devices use Gemma 3n E2B for English transcription and note organization; lower-resource devices use Whisper for transcription and Gemma3-1B for writing. A missing model does not block recording; retained audio stays in Inbox for retry. The transcript is saved in Inbox before local synthesis and topic filing; interrupted or failed captures remain available for recovery in app-private storage. Audio-file import, wake words, assistant voice intents, headset triggers, and spoken summaries are not available in the current release scope.

## Processing and storage

Notes, shared and quick-captured text, captured audio, transcription, and organization results are processed on the device. Eligible physical Android and iOS devices use Gemma 3n for speech and writing; lower-resource devices use Whisper for transcription and a separate Gemma writing model. In-app capture may route to a compatible wired or Bluetooth microphone; Android widget capture uses Android's active input route. LiteRT-LM models organize notes locally and may generate a short per-capture summary separate from the preserved original. Long captures may require multiple bounded processing steps and take time. When organization is unavailable or fails, captured notes remain in Inbox; shared text remains in app-private storage for review or retry. Android stores notes and retained recordings in app-private storage; iOS stores them in the app's sandbox.

Meeting transcription, summaries when available, suggested actions, and review state remain in Android app-private storage. Meeting audio is kept separately from the text and is not sent to the publisher or a cloud AI service. Meeting sessions and their audio are not included in the library JSON export. If the user saves meeting content as an ordinary note, that note's text and transcript are included in a JSON library export; raw audio is not.

Users may enable Automatic reminders in Settings on Android or iOS. When enabled, new saved notes are checked on-device for likely tasks, categories, priorities, and reminder times; the app does not ask the user to fill out task details. It uses the installed local model when available, with simple on-device rules for clear tasks if the model is unavailable. Reminder details stay in app-private storage and the operating system schedules the notification. Turning the setting off cancels pending reminder notifications and clears their saved reminder details. Android 13 and later may ask for notification permission; iOS asks for alert and sound authorization. Reminders are optional and are not sent to a cloud AI service.

Android automatic application backup is disabled. On Apple devices, operating-system backup settings may include application documents. Thought Notes does not operate an automatic backup or synchronization service. Users can choose to export a plain JSON library backup from Settings; it contains note text, transcripts, timestamps, and source details, but not audio recordings or device-specific audio paths.

## Network access and model downloads

On Android and iOS, eligible physical devices automatically download Gemma 3n E2B (about 3.66 GB) when RAM and free storage meet requirements. Other devices download the 32 MB Whisper transcription model and Gemma3-1B writing model. Downloads use HTTPS; the app does not send note text, topic files, or recordings with model requests. Other model catalog entries remain optional. Voice transcription then runs locally. Download requests contain model files only, not note text, topic files, or recordings. Hosting providers receive normal connection information such as IP address, request time, and requested model URL under their own privacy terms.

## Sharing

Content leaves through another application only when the user invokes sharing and chooses a destination in the OS share sheet. For Android meetings, the user can choose to share the summary, timestamped transcript, suggested actions, or all available meeting text separately. Meeting audio is not attached. That destination handles shared content under its own policy.

In builds that include the optional research handoff, FunctionGemma prepares a search query on-device. Nothing is sent to ChatGPT until the user chooses ChatGPT in the share sheet and submits the request. The shared payload contains the user's research task and the selected thread context. ChatGPT and any other chosen destination process that content under their own privacy terms. The user can share ChatGPT's response back to Thought Notes through the normal import flow; a shared link may not expose the conversation text to Thought Notes.

On Android and iOS, users can also choose Thought Notes as a destination in another app's share sheet. The selected text is held in app-private storage and may be automatically organized on-device when the model is ready. If organization is unavailable or fails, it remains recoverable for review or retry. Manually pasted text follows the separate review flow. Android quick text entered through the home-screen widget capture sheet is saved locally when the user submits it.

When a user exports a backup, the operating system asks where to save the JSON file. The app does not upload it. If the user selects a cloud-backed file provider, that provider handles the file under its own privacy terms. Restore reads a selected backup and merges it into local notes without replacing existing content.

## Publisher collection

The app has no publisher-operated account, ads, analytics, crash reporting or cloud AI backend. The current release does not intentionally transmit note content, audio, identifiers or diagnostics to the publisher. Any future remote processing requires a policy update before release.

## Retention and deletion

Content stays locally until deleted through available controls, app data is cleared, or the app is removed, unless the user chooses to share or export it. Inbox notes can be deleted individually with confirmation when not actively processing. Categorized notes currently support editing and sharing; the current UI does not promise individual deletion of categorized history. OS uninstall and backup behaviour remains under device settings.

Meeting audio defaults to deletion five minutes after recording has stopped and the complete transcript has been safely saved. Users can select one hour, one day, or Keep instead. Failed or incomplete transcription preserves the audio for retry. Expired audio deletion runs when Android allows the app to run or the next time the app opens; deletion can therefore occur later than the selected deadline if the system does not run the cleanup task.

## Permissions

Internet access supports model downloads. Android requests microphone access for user-initiated recording and Bluetooth-device access on Android 12 and later to route in-app recording to a connected headset microphone. If Bluetooth-device access is declined or no compatible headset is connected, recording uses the phone microphone. Android keeps an already user-started recording active in the background with a microphone foreground service; Android 13+ may request notification access for the visible Stop action and optional Automatic reminders. Denying notification access does not block in-app capture. iOS requests microphone access when the user starts voice capture and notification authorization when the user enables reminders. An iOS recording started in the app can continue while backgrounded; the user returns to Thought Notes to stop it. The app does not start recording in the background. Neither platform requests contacts, location, or broad shared-storage access.

## Audience and device security

The Play listing targets adults 18+. Play Console audience and content-rating declarations must match the submitted app. The app relies on the device sandbox and operating-system security. Users should protect access to their device and manage device backups for locally stored notes.

## Changes and contact

Material changes will update this policy before shipping. Privacy questions can be sent to **meharaj137@gmail.com**.
