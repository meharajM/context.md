# Google Play in-app updates

The Android source uses Google Play Core `app-update` and `app-update-ktx` 2.1.0. `MainActivity` checks for an update when the app enters the foreground and offers Google's flexible update flow when Play reports a newer version. Google Play asks for consent before downloading; the app remains usable during the download. When the update is ready, Thought Notes asks before restarting to install it. Declining or postponing the same version suppresses its prompt for seven days.

Google Play production currently serves version 1.0.10/code 11. The 1.0.9/code 10 bundle was uploaded through Internal App Sharing, and Play rejected code 10 for production because it had already been used. The next source update is version 1.0.11/code 12; listing-only changes do not carry this code to users.

## What this setup does

- Checks availability through Google Play; it does not fetch APKs from a custom server.
- Uses the flexible flow for ordinary releases, so installation does not interrupt a recording or unsaved screen state without the user's restart choice.
- Ignores update-check failures, including local/sideloaded installs or devices where Play is unavailable.
- Leaves unattended auto-install to Google Play's device/account settings. The app does not silently force an update or restart.
- Needs no API key, service account, manifest permission, or Play Console API access.

## Release and test steps

1. Build a signed Android bundle with the existing Play upload credentials and increment `versionCode` beyond the currently published code.
2. Upload it to an internal test track or use Internal App Sharing. The update must be a higher version code and use the production application ID and signing identity.
3. Install the lower version from Google Play/Internal App Sharing using a test account that owns the app. Do not install the higher version manually; open the installed app and wait for the update prompt.
4. Accept the flexible update, continue using the app while it downloads, then choose **Restart now** to complete it. Also verify **Later** and that the same version is not prompted again for seven days.
5. Complete the existing release preflight and QA before promoting the bundle.

Local debug or direct APK installs are not a valid end-to-end test of Play update availability. Google requires the test app to match the Play package ID and signing key and the update to have a higher version code.

Official references: [Support in-app updates](https://developer.android.com/guide/playcore/in-app-updates/kotlin-java), [Test in-app updates](https://developer.android.com/guide/playcore/in-app-updates/test).
