# iOS Intents Architecture

This directory contains iOS App Intent code.

## Files

- `CaptureThoughtIntent.swift`: intent scaffold for assistant-triggered text capture through OS-supported shortcuts.

## Current MVP Meaning

OS-supported shortcut capture is the approved assistant path. It accepts text content from Siri/Shortcuts, normalizes it, and forwards it into the same persistence-safe queue flow used by the app. Hardware button interception and locked-screen/background wake-word remain out of scope for this path.

The app also exposes a one-tap setup button that opens the platform-supported App Shortcuts surface so the user can bind the action without leaving the app flow.
