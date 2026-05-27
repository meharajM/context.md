# Security Policy

## Supported Versions

Context Engine is currently an experimental MVP.

Only the latest `main` branch is considered supported.

## Reporting Security Issues

Please do not open public GitHub issues for security vulnerabilities.

Instead:

- open a private security advisory if available
- or contact the maintainer directly

Include:

- reproduction steps
- affected platform
- logs/screenshots if possible
- device information

## Security Philosophy

Context Engine is designed around:

- local-first processing
- offline inference
- minimal cloud dependency
- transparent persistence

The project intentionally avoids mandatory server-side memory processing.

## Current Security Limitations

Known current limitations:

- local memory encryption not implemented yet
- no secure sync layer yet
- runtime settings persistence is limited
- no formal threat-model audit yet

## Scope Notes

The MVP currently focuses on:

- reliability
- offline inference
- local persistence
- architectural validation

Production-grade security hardening is still in progress.
