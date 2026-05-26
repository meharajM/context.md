# `__tests__/mocks` Architecture

Shared Jest mocks for top-level app tests.

## Files

- `fileMock.js`: static asset mock used by Jest when importing bundled files.

Keep reusable test-only mocks here. Module-specific mocks should stay near the tests that need them unless they are broadly reused.

