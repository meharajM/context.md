# `src/modules/DeviceReadiness` Architecture

This module assesses whether local synthesis should run on the current device and records whether the first-run readiness notice was dismissed.

## Contract

- `index.ts` combines native RAM/thermal/OS data from `LiteRtModule.getDeviceReadiness()` with free storage from `react-native-fs`.
- Local synthesis recommends at least 4 GiB physical RAM. Below that recommendation, an installed model is still attempted when current free memory and thermal state permit; inference may be slow, fail, or be stopped by the OS.
- Low available memory or serious thermal pressure temporarily pauses synthesis regardless of total RAM. Android retries eligible work while idle; foreground readiness checks resume it on both platforms.
- The default Gemma3-1B-IT model is about 585 MB. Model download preflight recommends the exact model size plus 512 MiB free storage; the first-run notice recommends keeping about 1 GiB free.
- Model installation is optional on any device. The first-run notice shows available readiness information and offers Download or Continue without assistant when a model is missing. Every user-initiated download checks free storage for the selected model plus 512 MiB before transfer.
- Simulator and unsupported native checks are reported as unavailable rather than as a physical-device readiness result.
- The readiness notice dismissal is stored under `Documents/setup/device-readiness-v1.json`.
- Every captured note is durable in `Inbox` before synthesis. Temporary resource blocks keep eligible work queued in memory and retry when readiness is refreshed; startup reconstructs eligible work from Inbox.
- Android also requests constrained WorkManager retries for temporary pressure, and the worker repeats the memory/thermal check before starting synthesis. iOS currently resumes through launch/foreground checks only.
- The operating system controls whether and when background work runs; no completion time is promised.

## Native Boundary

- Android exposes API level, total and available RAM, low-memory state, thermal status, OS version, and emulator detection from `LiteRtModule.kt`.
- iOS exposes physical RAM, process-available RAM, thermal state, OS version, and simulator detection from `LiteRtModule.swift`.
- Feature screens receive the resulting assessment through the app store and do not call native modules directly.
