# Local Release Credentials

Release credentials must never be committed. The repository loads values from `.env.release.local`, which is ignored by Git. Key files belong in `.release-secrets/`, which is also ignored.

The same `.env.release.local` file can also hold the publisher and store metadata values used by `docs/privacy-policy.md` and `docs/store-submission-package.md`. After filling those values, run `npm run release:apply-metadata` to stamp the draft docs.

## Files to provide

Copy these files into `/Users/meharaj/context.md/ContextEngine/.release-secrets/`:

- `context-engine-upload.jks`: Google Play upload keystore.
- `apple-distribution.p12`: Apple Distribution certificate plus private key.
- `ContextEngine_AppStore.mobileprovision`: App Store provisioning profile for `com.meharaj.contextengine`.
- `AuthKey_KEYID.p8`: optional App Store Connect API private key for automated upload.
- `google-play-service-account.json`: optional Google Play service-account key for automated upload.

Fill the matching values in `/Users/meharaj/context.md/ContextEngine/.env.release.local`. Keep quotes around values, especially passwords containing spaces or shell punctuation.

The four `CONTEXTENGINE_UPLOAD_*` values are required for the signed Play AAB. After adding the Apple P12/profile/password, run `npm run release:import-apple-credentials` once. Then run `npm run release:preflight` to validate what is available.

App Store Connect and Play service-account API values are optional until automated console upload is configured. They are distinct from the Apple Distribution certificate and Play upload keystore required to sign binaries.
