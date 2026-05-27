# Contributing to Context Engine

Thanks for contributing.

## Before You Start

Read these files first:

1. `ContextEngine/AGENTS.md`
2. `ContextEngine/implementation/status.json`
3. `ContextEngine/implementation/phases.json`
4. `ContextEngine/implementation/README.md`
5. Relevant `info.md` files

## Project Principles

Context Engine prioritizes:

- local-first AI
- resilient persistence
- offline workflows
- transparent architecture
- safe degradation

Core invariant:

> Every non-empty thought must persist even if AI synthesis fails.

## Local Setup

```bash
cd ContextEngine
npm install
cd ios
bundle exec pod install
cd ..
```

Run:

```bash
npm run ios
```

## Validation

Before opening a PR:

```bash
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
```

## Current MVP Boundaries

Do not implement these without roadmap approval:

- background wake-word
- lock-screen recording
- Android NPU runtime
- cloud sync
- hardware trigger hooks
- remote AI inference

## Pull Requests

Good PRs include:

- focused scope
- validation evidence
- updated tracker files
- updated architecture notes
- updated docs if behavior changes

## Architecture Rules

- Keep native runtime logic isolated
- Avoid direct UI → native coupling
- Preserve queue fallback guarantees
- Avoid committing model binaries

## Suggested Contribution Areas

- UI polish
- onboarding UX
- settings persistence
- accessibility
- benchmarking
- battery profiling
- Android groundwork
- documentation
- testing
