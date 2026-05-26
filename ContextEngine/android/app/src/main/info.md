# `android/app/src/main` Architecture

Android runtime source root.

## Contents

- `AndroidManifest.xml`: app permissions, activity registration, and package-level declarations.
- `java`: Kotlin `MainActivity` and `MainApplication`.
- `assets`: bundled model/native assets.
- `res`: Android resources.

## Agent Notes

Keep Android changes minimal unless the task explicitly targets Android. The current implementation tracker treats Android LiteRT/NPU as future work.
