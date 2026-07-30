# Context Engine Privacy Policy — Publisher Draft

Effective date: 2026-07-18

Publisher: **[PUBLISHER LEGAL NAME REQUIRED]**

Contact: **[SUPPORT EMAIL REQUIRED]**

Public policy URL: **[HTTPS URL REQUIRED BEFORE SUBMISSION]**

This draft describes the behavior of the current Context Engine application. The publisher must replace the bracketed fields, confirm the final release behaves as described, publish the policy at a stable public HTTPS URL, and review it with appropriate legal/privacy counsel before store submission.

## Summary

Context Engine is designed as a local-first thought-capture application. It does not require an account and the current release does not include advertising, analytics, cross-app tracking, or a publisher-operated cloud synchronization service.

## Information the app handles

The app can handle information that the user chooses to provide:

- typed thoughts and imported text;
- microphone recordings and locally generated transcripts;
- audio files selected for import;
- topic names, organized notes, note metadata, and app settings;
- text delivered through an operating-system Assistant, Siri, or Shortcuts action; and
- content the user explicitly selects for sharing through the operating-system share sheet.

This content can be personal or sensitive depending on what the user chooses to record. The app does not require users to enter sensitive information.

## Processing and storage

Thoughts, transcripts, topic files, and synthesis results are processed and stored on the user's device. Voice transcription and supported AI organization run on the device. If model-based organization is unavailable or fails, the app is designed to keep the raw thought locally in Inbox.

The app may retain a failed voice capture as a local audio file so the recording is not lost. Temporary or cached audio may also be removed by the operating system under storage pressure. The final release must expose and document any available playback or deletion controls.

Android application backup is disabled. On Apple devices, operating-system or device-backup settings may include application documents; Context Engine does not operate its own backup service. Users should manage device backups through their operating-system or account settings.

## Network access and model downloads

The app can connect to the internet to download optional on-device model files from public model hosting services, currently including Hugging Face. Thought text, recordings, transcripts, and topic files are not intentionally included in those model-download requests. The hosting service may receive ordinary connection information such as IP address, request time, device/network metadata, and the requested model URL under its own privacy terms.

## Assistant and sharing features

When the user invokes an Apple or Google operating-system assistant action, the operating system supplies the requested text to Context Engine. The operating-system provider's processing occurs under the user's device configuration and that provider's terms.

Context Engine sends content to another application only when the user invokes a share action and selects a destination in the operating-system share sheet. The selected destination then handles the shared content under its own privacy policy.

## Data collection by the publisher

The current release does not intentionally transmit thought content, recordings, transcripts, topic files, identifiers, diagnostics, or usage analytics to the publisher. The app contains no publisher-operated account, advertising, analytics, or crash-reporting backend.

If a future version adds synchronization, analytics, crash reporting, accounts, advertising, or other remote processing, this policy and both stores' privacy declarations must be updated before that version is released.

## Retention and deletion

Local content remains on the device until the user deletes it through available app controls, removes the app, clears its data, or the operating system removes temporary/cache files. Uninstall and device-backup behavior is controlled by the operating system.

Before publication, the publisher must verify that the app provides the deletion behavior promised in the store listing and must document any content that cannot yet be deleted individually.

## Permissions

- Microphone access is used only after the user chooses a voice-capture feature.
- Local file selection is used only after the user chooses to import a supported audio file.
- Internet access is used for app development connectivity and optional model downloads; release behavior must be rechecked before submission.

The app should remain usable for typed capture when microphone permission is denied.

## Children

Context Engine is not specifically directed to children. The publisher must select and substantiate the final target-audience and age-rating answers in App Store Connect and Play Console.

## Security

The app relies on the operating system's application sandbox and device security. No storage or transmission method is guaranteed to be completely secure. Users should protect access to their device and avoid recording information they do not want stored locally or included in device backups.

## Changes

Material privacy changes will be reflected in an updated policy and effective date. When store rules or applicable law require additional notice or consent, the publisher will provide it before the changed processing begins.

## Contact

Privacy questions or deletion-support requests should be sent to **[SUPPORT EMAIL REQUIRED]**.
