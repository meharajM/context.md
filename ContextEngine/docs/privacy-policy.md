# Thought Notes Privacy Policy

Effective date: 2026-10-24

Publisher: **UMCreations**

Contact: **meharaj137@gmail.com**

This policy describes the Android v1 release and the text-only iOS release.

## Current release and data you provide

The Android release accepts typed notes, pasted text, and optional user-initiated voice capture. Voice capture starts only when the user taps Record in the app or home-screen widget while the app is in use. An active recording may continue when the app backgrounds under an Android microphone foreground service; the user can stop it in the app or from its notification when Android shows that notification. The app does not start unattended capture, continuously listen for speech, or use a wake word. The iOS release supports typed notes and pasted text only.

On Android, microphone permission is requested when needed. Captured audio is transcribed on-device with Whisper, then the transcript is stored in Inbox before local synthesis and topic filing. Successfully transcribed working audio is deleted after processing. If recording or transcription fails or is aborted, the app retains the recording in private app storage and associates it with the Inbox note so the user can review or delete it. Audio import, wake words, assistant voice intents, and spoken summaries are future deliverables. Existing local voice-note metadata from development versions may remain readable; only app-owned retained recordings can be deleted through the guarded deletion controls.

## Processing and storage

Notes, captured audio, transcription, and organization results are processed on the device. Whisper transcribes user-started recordings locally. When a compatible wired or Bluetooth headset microphone is available, the app routes recording to it; otherwise it uses the phone microphone. Optional LiteRT-LM models synthesize and file notes locally. When organization is unavailable or fails, the original note remains in Inbox. Android stores notes and retained recordings in app-private storage.

Android automatic application backup is disabled. On Apple devices, operating-system backup settings may include application documents. Thought Notes does not operate an automatic backup or synchronization service. Users can choose to export a plain JSON library backup from Settings; it contains note text, transcripts, timestamps, and source details, but not audio recordings or device-specific audio paths.

## Network access and model downloads

Optional models download from public hosting services, currently including Hugging Face. Note text and topic files are not intentionally included in download requests. Hosting providers receive normal connection information such as IP address, request time and requested model URL under their own privacy terms.

## Sharing

Content leaves through another application only when the user invokes sharing and chooses a destination in the OS share sheet. That destination handles shared content under its own policy.

When a user exports a backup, the operating system asks where to save the JSON file. The app does not upload it. If the user selects a cloud-backed file provider, that provider handles the file under its own privacy terms. Restore reads a selected backup and merges it into local notes without replacing existing content.

## Publisher collection

The app has no publisher-operated account, ads, analytics, crash reporting or cloud AI backend. The current release does not intentionally transmit note content, audio, identifiers or diagnostics to the publisher. Any future remote processing or additional voice features beyond this Android capture flow require a policy update before release.

## Retention and deletion

Content stays locally until deleted through available controls, app data is cleared, or the app is removed, unless the user chooses to share or export it. Inbox notes can be deleted individually with confirmation when not actively processing. Categorized notes currently support editing and sharing; the current UI does not promise individual deletion of categorized history. OS uninstall and backup behaviour remains under device settings.

## Permissions

Internet access supports optional model downloads. Android requests microphone access for user-initiated recording and Bluetooth-device access on Android 12 and later to route an in-app recording to a connected headset microphone. If Bluetooth-device access is declined or no compatible headset is connected, recording uses the phone microphone. Android keeps only an already user-started recording active in the background, using a microphone foreground service; Android 13+ requests notification access for the visible Stop action. It does not start recording in the background, and denying notification access does not block capture. The iOS release is text-only and does not request microphone access. The app does not request contacts, location, or broad shared-storage access.

## Audience and device security

The planned Play listing targets adults 18+ in India. Play Console audience and content-rating declarations must match the submitted app. The app relies on the device sandbox and operating-system security. Users should protect access to their device and manage device backups for locally stored notes.

## Changes and contact

Material changes will update this policy before shipping. Privacy questions can be sent to **meharaj137@gmail.com**.
