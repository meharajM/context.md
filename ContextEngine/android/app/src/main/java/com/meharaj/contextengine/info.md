# Android Host Code Architecture

This package contains the React Native Android host classes.

## Files

- `MainActivity.kt`: Android activity entrypoint for the React Native app.
- `MainApplication.kt`: React Native application setup and package registration.

## Role

These files host the JavaScript bundle. Business logic, queueing, context persistence, and synthesis selection live in TypeScript under `src`.
