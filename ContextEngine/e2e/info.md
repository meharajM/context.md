# `e2e` Architecture

End-to-end test configuration.

## Files

- `jest.config.js`: Jest config for Detox tests.
- `starter.test.js`: starter Detox test.

## Current State

The main validated workflow is still unit/type/lint plus iOS simulator smoke tests from the implementation tracker. Expand Detox coverage only when the app flow under test is stable enough to avoid brittle native test failures.
