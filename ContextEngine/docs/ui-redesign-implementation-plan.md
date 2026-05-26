# UI Redesign Implementation Plan

## Goal

Redesign the React Native app to match the supplied Context Engine mocks while making UI code modular, reusable, and separated from capture, synthesis, persistence, and queue logic.

The target app has four product surfaces:

- `Reflections`: capture landing screen with recent threads and bottom composer.
- `Queue`: active and pending synthesis jobs.
- `Settings`: model management, capture modes, diagnostics, privacy copy.
- `ThreadDetails`: synthesized summary plus source captures and sharing actions.

## Current State

Reviewed files:

- `App.tsx`
- `src/core/store.ts`
- `src/ui/design.ts`
- `src/components/BrandMark.tsx`
- `src/components/CaptureComposer.tsx`
- `src/components/ScreenTabs.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/modules/ContextManager/index.ts`
- `src/modules/SynthesisEngine/ProcessingQueueManager.ts`

Observed architecture:

- `App.tsx` owns boot orchestration, app lifecycle wiring, selected screen state, composer input state, header layout, tab logic, and data mapping.
- `HomeScreen` and `SettingsScreen` are mostly presentational but accept raw store/runtime fields directly.
- `SettingsScreen` contains many nested private components and styles in one file, which makes parallel UI work difficult.
- `ScreenTabs` only supports `home` and `settings`; mocks require `reflections`, `queue`, `settings`, plus `threadDetails` as a pushed detail surface.
- `ProcessingQueueManager` only exposes counts and current thought id. It does not expose pending item titles, progress percentage, or queue item metadata needed by the queue mock.
- `ContextManager` only exposes markdown sections with `{ header, content }`; it does not expose thread ids, source captures, summary text, timestamps, capture types, or note counts needed by the mocks.
- `src/ui/design.ts` is a small palette helper, not a scalable design system.
- There is no icon system dependency. Current icon-like UI is hand-built in `BrandMark`.

## Stitch Source Of Truth

Use Stitch project `Context Engine Mobile UI` as the design source of truth:

- Project ID: `18135043520529599494`
- Device: mobile, 390pt logical width in screen instances.
- Design theme: `Quiet Intelligence`, local-first, calm, iOS-native, linen-notebook feel.
- Color mode: light.
- Primary color: `#566e7a`.
- Headline font: `Hanken Grotesk`.
- Body and label font: `Inter`.
- Grid: 8pt spacing.
- Shape: iOS squircle language with 12px controls and 16px to 24px cards.

Primary implementation screens:

- `Home - Reflections (Updated Nav)`: `projects/18135043520529599494/screens/a948d699d1fe4e41a1612d1be27997c9`
- `Queue - Synthesis Status`: `projects/18135043520529599494/screens/4619d9f28bec45a68ffb54928828b5f1`
- `Settings (Updated Nav)`: `projects/18135043520529599494/screens/6d60dc939ae94fe083c6f66c86b4b902`
- `Thread - Project Alpha Synthesis`: `projects/18135043520529599494/screens/bf4ace577a864fd7885250357cb99f45`

Secondary reference screens:

- `Home - Quick Capture`: `projects/18135043520529599494/screens/c845ba0084dd44d8995c30b0acc415d9`
- `Home - Quick Capture (Liquid Glass)`: `projects/18135043520529599494/screens/51b2e39d843a4305b2dd3858c4fa955a`
- `Settings - Configuration`: `projects/18135043520529599494/screens/28f5c641849d49e2907bde02fcc6b52d`
- `Settings - Configuration (Liquid Glass)`: `projects/18135043520529599494/screens/516c23bc82da49a1a60106363715cfdb`
- `Onboarding - Dependency Setup`: `projects/18135043520529599494/screens/0a6096e41fb44db6af9032ff48d9b5a4`
- `Onboarding - Dependency Setup (Liquid Glass)`: `projects/18135043520529599494/screens/57181b5ff1454eacb41955e3e6ee1515`
- `Empty State - Onboarding`: `projects/18135043520529599494/screens/c8017e661a7a492caa39666e2e656f09`
- `Empty State - Onboarding (Liquid Glass)`: `projects/18135043520529599494/screens/f79a4f8df85e419ea11e8787f6b02fb0`

Implementation agents should inspect these screens in Stitch before coding each slice. If the uploaded images and Stitch conflict, use the `Updated Nav` Stitch screens as canonical for bottom navigation and layout.

## Product And Design Direction

Use a restrained, local-first product UI. The supplied mocks use warm off-white surfaces, blue-gray accents, soft cards, high radius, light separators, and bottom navigation.

Physical scene: a mobile user captures private thoughts throughout the day, often one-handed, in normal indoor or commute lighting. The interface should feel calm, local, and trustworthy rather than dashboard-dense or decorative.

Design tokens should prioritize:

- Tinted neutrals instead of pure white and black.
- Blue-gray accent for local/device status, primary tabs, and action buttons.
- Soft beige and pale blue background washes.
- Large mobile typography with strong headings and compact section labels.
- Reusable card, row, pill, icon, and bottom-nav primitives.

Concrete Stitch tokens:

- `background`: `#fcf9f8`
- `surface`: `#fcf9f8`
- `surfaceContainerLowest`: `#ffffff`
- `surfaceContainerLow`: `#f6f3f2`
- `surfaceContainer`: `#f0edec`
- `surfaceContainerHigh`: `#ebe7e7`
- `surfaceContainerHighest`: `#e5e2e1`
- `surfaceVariant`: `#e5e2e1`
- `onSurface`: `#1c1b1b`
- `onSurfaceVariant`: `#42484b`
- `outline`: `#72787b`
- `outlineVariant`: `#c2c7cb`
- `primary`: `#3e5661`
- `primaryContainer`: `#566e7a`
- `secondaryContainer`: `#dde3eb`
- `tertiary`: `#694c35`
- `error`: `#ba1a1a`
- `errorContainer`: `#ffdad6`

Typography tokens:

- `displayLg`: Hanken Grotesk, 34, 700, line height 41, letter spacing `-0.02em`.
- `headlineMd`: Hanken Grotesk, 22, 600, line height 28, letter spacing `-0.01em`.
- `headlineSm`: Hanken Grotesk, 17, 600, line height 22, letter spacing `-0.01em`.
- `bodyLg`: Inter, 17, 400, line height 24, letter spacing `-0.01em`.
- `bodySm`: Inter, 15, 400, line height 20.
- `labelCaps`: Inter, 12, 600, line height 16, letter spacing `0.05em`.
- `caption`: Inter, 13, 400, line height 18.

Spacing tokens:

- `xs`: 4
- `base`: 8
- `sm`: 12
- `md`: 16
- `lg`: 24
- `xl`: 32
- `marginMobile`: 20
- `gutterMobile`: 16

## Clarifications Needed

These can be answered before implementation or handled by the defaults below.

- The uploaded home mock bottom tab says `Vault`, but Stitch `Home - Reflections (Updated Nav)` and `Settings (Updated Nav)` use the updated nav set. Default assumption: use Stitch updated nav as canonical: `Reflections`, `Queue`, `Settings`.
- The mocks show static thread data such as "Project Alpha Ideas" and "Weekly Reflection". Default assumption: derive these from existing `ContextSection` entries until real thread metadata exists.
- The queue mock shows active job progress at `65%`. Current queue state has no true progress. Default assumption: use indeterminate UI or a mock-derived percentage only in dev fixtures until the queue module exposes progress.
- The thread details mock includes source capture types (`VOICE NOTE`, `TEXT ENTRY`, `IMAGE OCR`). Current app persists only markdown bullet text. Default assumption: implement UI using derived placeholder captures from section content, then add a data model migration later.
- The mocks use line icons. Default assumption: add `react-native-vector-icons` or `lucide-react-native`; if dependency additions are not desired, build a tiny internal text/icon abstraction using simple glyphs and RN views.
- Stitch includes onboarding and empty-state screens. Default assumption: implement them after the four primary screens unless boot/model setup UX is in scope for the first redesign pass.

## Target Folder Structure

Create this structure incrementally:

```text
src/
  app/
    AppShell.tsx
    AppBootstrap.ts
    navigation.ts
  features/
    capture/
      CaptureComposerContainer.tsx
      CaptureComposerView.tsx
      captureSelectors.ts
      captureTypes.ts
    queue/
      QueueScreen.tsx
      QueueList.tsx
      QueueJobCard.tsx
      queueSelectors.ts
      queueTypes.ts
    reflections/
      ReflectionsScreen.tsx
      RecentThreadList.tsx
      ThreadCard.tsx
      reflectionsSelectors.ts
      reflectionTypes.ts
    settings/
      SettingsScreen.tsx
      ModelManagementSection.tsx
      CaptureModesSection.tsx
      DiagnosticsSection.tsx
      PrivacyCard.tsx
      settingsSelectors.ts
      settingsTypes.ts
    threads/
      ThreadDetailsScreen.tsx
      SummaryCard.tsx
      SourceCaptureTimeline.tsx
      threadSelectors.ts
      threadTypes.ts
  shared/
    components/
      AppBackground.tsx
      AppHeader.tsx
      BottomNav.tsx
      Button.tsx
      Card.tsx
      Icon.tsx
      Pill.tsx
      SectionHeader.tsx
      SwitchRow.tsx
    design/
      colors.ts
      radius.ts
      shadows.ts
      spacing.ts
      typography.ts
      tokens.ts
    hooks/
      useAppLifecycleSync.ts
  core/
    store.ts
    appSelectors.ts
```

Keep domain modules under `src/modules` unchanged unless the UI requires new data accessors.

## Separation Of Concerns Rules

Implementation agents should follow these rules:

- Screen components render view models, not raw Zustand state.
- Container components call store actions and selectors, then pass plain props to view components.
- Shared UI components never import `useAppStore`, `ContextManager`, `SynthesisService`, `ProcessingQueueManager`, or native modules.
- Feature view components should be testable with fixture props only.
- Store actions should not contain display copy except short operational statuses that represent domain state.
- Display strings such as `Queue clear`, `Voice ready`, and `Low Space` should be derived in selectors or view-model mappers.
- Avoid passing `palette` through props. Import stable design tokens in UI components.
- Keep boot and lifecycle effects out of `App.tsx`; move them into `AppBootstrap` and `useAppLifecycleSync`.

## Data Contracts

Add UI-facing view models. These can initially be derived from existing state.

```ts
export type AppRoute = 'reflections' | 'queue' | 'settings' | 'threadDetails';

export interface RecentThreadView {
  id: string;
  title: string;
  preview: string;
  noteCountLabel: string;
  updatedAtLabel: string;
  icon: 'document' | 'reflection' | 'sparkle';
}

export interface QueueJobView {
  id: string;
  title: string;
  statusLabel: string;
  progress: number | null;
  kind: 'voice' | 'text' | 'image';
}

export interface ThreadDetailsView {
  id: string;
  title: string;
  summary: string;
  captures: SourceCaptureView[];
}

export interface SourceCaptureView {
  id: string;
  typeLabel: 'VOICE NOTE' | 'TEXT ENTRY' | 'IMAGE OCR';
  timestampLabel: string;
  preview: string;
  icon: 'mic' | 'document' | 'image';
}
```

Initial mapping:

- `ContextSection.header` maps to `RecentThreadView.title`.
- `ContextSection.content` maps to `RecentThreadView.preview`.
- Bullet count in section content maps to `noteCountLabel`.
- If no timestamp can be parsed, use `Recent`.
- Queue `currentThoughtId` maps to one active `QueueJobView`.
- Queue `pendingCount` can generate placeholder pending rows only if there is no richer queue array yet. Prefer extending `ProcessingQueueManager` to expose safe queue snapshots.
- `ThreadDetailsView.summary` can initially use a truncated or cleaned version of section content until synthesis summaries are persisted separately.

## Phase 1: Design Tokens And Shared Primitives

Files to add:

- `src/shared/design/colors.ts`
- `src/shared/design/spacing.ts`
- `src/shared/design/radius.ts`
- `src/shared/design/typography.ts`
- `src/shared/design/shadows.ts`
- `src/shared/design/tokens.ts`
- `src/shared/components/AppBackground.tsx`
- `src/shared/components/Card.tsx`
- `src/shared/components/Pill.tsx`
- `src/shared/components/SectionHeader.tsx`
- `src/shared/components/Button.tsx`
- `src/shared/components/Icon.tsx`

Files to update:

- `src/ui/design.ts`, either re-export new tokens temporarily or deprecate it.

Tasks:

- Define color tokens matching the mocks:
  - app background: `#fcf9f8`.
  - card surface: `#ffffff`.
  - inset surface: `#f6f3f2`.
  - alternate wash: `#dde3eb`.
  - accent: `#566e7a` and `#3e5661`.
  - primary text: `#1c1b1b`.
  - secondary text: `#42484b`.
  - warning/danger: `#ba1a1a`.
  - separators: `#c2c7cb` with low opacity where needed.
- Define reusable shadows/elevation for iOS and Android.
- Define `Card` variants:
  - `default`: white/tinted surface, border, soft radius.
  - `wash`: pale blue summary card.
  - `inset`: grouped list container.
  - `action`: large tappable row/button surface.
- Define `Pill` variants:
  - `local`
  - `installed`
  - `progress`
  - `danger`
- Define an `Icon` abstraction so later dependency changes do not touch all screens.
- Add typography tokens for Hanken Grotesk headlines and Inter body/labels. If fonts are not bundled yet, create constants anyway and use system fallback until font assets are added.

Acceptance:

- Existing screens can import tokens without prop-drilling a palette.
- No shared component imports app logic or store.

## Phase 2: App Shell And Navigation

Files to add:

- `src/app/AppShell.tsx`
- `src/app/AppBootstrap.ts`
- `src/app/navigation.ts`
- `src/shared/components/AppHeader.tsx`
- `src/shared/components/BottomNav.tsx`
- `src/shared/hooks/useAppLifecycleSync.ts`

Files to update:

- `App.tsx`
- Delete or replace `src/components/ScreenTabs.tsx` after migration.

Tasks:

- Move boot logic from `App.tsx` into `useAppBootstrap` or `AppBootstrap`.
- Move `AppState` subscription into `useAppLifecycleSync`.
- Replace top tab navigation with bottom nav.
- Add route state:
  - `reflections`
  - `queue`
  - `settings`
  - `threadDetails`
- Implement `ThreadDetails` as route state with `selectedThreadId`, not as a permanent bottom tab.
- Implement reusable headers:
  - branded header for `Reflections` and `Settings`.
  - centered title with menu/account icons for `Queue`.
  - back/title/share header for `ThreadDetails`.
- Keep composer visible only on `Reflections`.

Acceptance:

- `App.tsx` is only composition: safe area, bootstrap hook, shell.
- No boot, model refresh, lifecycle, or capture handler code remains inline in `App.tsx`.
- Bottom nav supports active route styling from mocks.

## Phase 3: Reflections Screen

Files to add:

- `src/features/reflections/ReflectionsScreen.tsx`
- `src/features/reflections/RecentThreadList.tsx`
- `src/features/reflections/ThreadCard.tsx`
- `src/features/reflections/reflectionsSelectors.ts`
- `src/features/reflections/reflectionTypes.ts`
- `src/features/capture/CaptureComposerContainer.tsx`
- `src/features/capture/CaptureComposerView.tsx`
- `src/features/capture/captureSelectors.ts`
- `src/features/capture/captureTypes.ts`

Files to replace:

- `src/screens/HomeScreen.tsx`
- `src/components/CaptureComposer.tsx`

Tasks:

- Build the screen from the second mock:
  - branded top bar with shield icon and `Local` pill.
  - large centered headline: `What's on your mind?`
  - subtitle under headline.
  - `RECENT THREADS` section header with `View All`.
  - grouped recent-thread card with two rows.
  - bottom composer pill with edit icon, placeholder, and floating mic button.
- Map real sections into recent threads.
- Use empty state if there are no sections.
- Use Stitch `Empty State - Onboarding` and `Empty State - Onboarding (Liquid Glass)` as reference for the empty Reflections state if no `context.md` sections exist.
- Move capture handlers into `CaptureComposerContainer`.
- Keep `CaptureComposerView` pure: receives `value`, `canType`, `canRecord`, `isRecording`, and callbacks.

Acceptance:

- `ReflectionsScreen` accepts `{ threads, onOpenThread }` plus optional status props.
- It does not know about `ContextManager`, queue internals, or synthesis.
- Existing testID coverage for `thought_input` and `record_button` is preserved or updated intentionally.

## Phase 4: Queue Screen

Files to add:

- `src/features/queue/QueueScreen.tsx`
- `src/features/queue/QueueList.tsx`
- `src/features/queue/QueueJobCard.tsx`
- `src/features/queue/queueSelectors.ts`
- `src/features/queue/queueTypes.ts`

Files to update:

- `src/modules/SynthesisEngine/ProcessingQueueManager.ts`
- `src/core/store.ts`

Tasks:

- Extend `ProcessingQueueManager` with a read-only queue snapshot:
  - pending job ids.
  - transcript preview.
  - created timestamp.
  - attempts.
  - active job id.
- Extend store state with `queueJobs` or selector-derived `QueueJobView[]`.
- Build the queue mock:
  - header row with menu, centered title, account icon.
  - active section with large card, microphone icon, title, status, progress pill, and progress track.
  - pending section with item count and grouped pending rows.
  - bottom nav with `Queue` selected as raised pill.
- If true progress is unavailable, render `progress: null` as an indeterminate track and do not show fake `65%` in production.

Acceptance:

- Queue UI renders from `QueueJobView[]`.
- Store exposes enough queue information without UI reaching into static manager internals.
- Queue screen has useful empty state when no active or pending jobs exist.

## Phase 5: Settings Screen

Files to add:

- `src/features/settings/SettingsScreen.tsx`
- `src/features/settings/ModelManagementSection.tsx`
- `src/features/settings/CaptureModesSection.tsx`
- `src/features/settings/DiagnosticsSection.tsx`
- `src/features/settings/PrivacyCard.tsx`
- `src/features/settings/settingsSelectors.ts`
- `src/features/settings/settingsTypes.ts`
- `src/shared/components/SwitchRow.tsx`

Files to replace:

- `src/screens/SettingsScreen.tsx`

Tasks:

- Build the settings mock:
  - branded top bar with `Context Engine` and `Local`.
  - page heading `Settings`.
  - model management section with selected model card and update/install action.
  - capture modes grouped rows with switches.
  - diagnostics grouped rows for Audio Subsystem, Model Engine, and Storage.
  - privacy card.
  - bottom nav with Settings selected.
- Keep model list expansion optional. The mock only shows one selected model row; if multiple models are needed, put them behind a later detail/expand interaction.
- Use a reusable `SwitchRow` around native `Switch`, not a custom fake switch unless design fidelity requires it.
- Derive diagnostics through `settingsSelectors`.
- Keep all model actions in a container or screen-level action prop. Section components stay pure.

Acceptance:

- `SettingsScreen` receives one `SettingsViewModel`.
- Section files are independently editable.
- No nested component pile remains in a single 600-line settings file.

## Phase 6: Thread Details Screen

Files to add:

- `src/features/threads/ThreadDetailsScreen.tsx`
- `src/features/threads/SummaryCard.tsx`
- `src/features/threads/SourceCaptureTimeline.tsx`
- `src/features/threads/threadSelectors.ts`
- `src/features/threads/threadTypes.ts`

Tasks:

- Build the fourth mock:
  - top header with back, centered title, share icon.
  - pale summary card with icon and `Executive Summary`.
  - source captures timeline with leading vertical rail and type-specific icons.
  - fixed or near-bottom action buttons:
    - `Open with AI Agent`
    - `Share Context`
  - bottom nav remains visible unless the final UX chooses a full-screen pushed route.
- Map selected `ContextSection` into initial `ThreadDetailsView`.
- Parse bullet lines into source capture previews where possible.
- Use an explicit empty/error state if selected thread id does not resolve.

Acceptance:

- Opening a recent thread routes to `threadDetails`.
- Back returns to `reflections`.
- Thread details UI can later consume richer persisted source-capture data without changing layout components.

## Phase 7: Store Selectors And View Models

Files to add:

- `src/core/appSelectors.ts`
- Feature selector files listed above.

Tasks:

- Add selectors that convert domain state into UI view models:
  - `selectCaptureComposerView`
  - `selectRecentThreads`
  - `selectQueueView`
  - `selectSettingsView`
  - `selectThreadDetailsView`
- Keep selectors pure and deterministic.
- Extract copy formatting from components:
  - count labels.
  - relative time labels.
  - model size labels.
  - status labels.
- Keep existing `formatModelSize`, but move it near settings/model selectors or shared formatting utilities.

Acceptance:

- Screens do not directly assemble labels from raw domain fields.
- Unit tests can cover selector output without rendering React.

## Phase 8: Tests

Files to update/add:

- `__tests__/App.test.tsx`
- `src/features/*/__tests__/*.test.tsx`
- `src/core/__tests__/appSelectors.test.ts`
- `src/modules/SynthesisEngine/__tests__/QueueManager.test.ts`

Tasks:

- Update app render test for bottom navigation and composer.
- Add selector tests:
  - sections map to recent thread rows.
  - empty state when no sections.
  - queue manager snapshot maps to active/pending queue view.
  - settings view maps model/action states.
- Add render tests for:
  - `ReflectionsScreen`
  - `QueueScreen`
  - `SettingsScreen`
  - `ThreadDetailsScreen`
- Preserve important testIDs:
  - `app_title`
  - `thought_input`
  - `record_button`
  - `save_button` if save remains separate, otherwise update tests.
  - `tab_reflections`
  - `tab_queue`
  - `tab_settings`

Validation commands:

```sh
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
```

## Optional Phase 9: Onboarding And Empty States

Stitch includes onboarding/dependency setup screens. Implement this phase after the main redesign unless product asks for first-run setup immediately.

Files to add:

- `src/features/onboarding/OnboardingScreen.tsx`
- `src/features/onboarding/DependencySetupCard.tsx`
- `src/features/onboarding/onboardingSelectors.ts`

Tasks:

- Use `Onboarding - Dependency Setup` and `Onboarding - Dependency Setup (Liquid Glass)` as references.
- Gate onboarding by runtime readiness:
  - missing Whisper model.
  - missing LiteRT model.
  - microphone permission unavailable.
  - empty context file.
- Keep setup actions routed through existing store/model actions.
- Do not block manual text capture just because model setup is incomplete.

Acceptance:

- First-run users understand what local dependencies are missing.
- Manual capture remains available even when onboarding reports missing AI/audio dependencies.

## Execution Slices For A Smaller Agent

Slice 1: Tokens and primitives

- Add shared design tokens and primitive components.
- Do not touch store logic.
- Keep old screens compiling.

Slice 2: Shell and bottom navigation

- Add route types and bottom nav.
- Move boot/lifecycle code out of `App.tsx`.
- Keep old `HomeScreen` and `SettingsScreen` behind new routes temporarily.

Slice 3: Reflections and composer

- Replace `HomeScreen` with `ReflectionsScreen`.
- Split composer into container and view.
- Preserve manual save and record behavior.

Slice 4: Settings split

- Split current `SettingsScreen` into focused section components.
- Apply new visual design.
- Keep all existing model/capture actions working.

Slice 5: Queue data and screen

- Extend queue manager snapshots.
- Add queue view-model selector.
- Add queue route and screen.

Slice 6: Thread details

- Add selected-thread route state.
- Add thread details screen and selectors.
- Wire recent thread press to details.

Slice 7: Cleanup and tests

- Remove obsolete `ScreenTabs`, old `HomeScreen`, old `CaptureComposer`, and old `src/ui/design.ts` imports.
- Add missing tests.
- Run typecheck, lint, and Jest.

Each slice should be independently reviewable and should avoid modifying native modules.

## Risks

- The mocks imply richer product data than the app currently stores. Avoid inventing persistence migrations during the first UI pass; use view-model derivation first.
- Queue progress is not currently measurable. Do not hard-code the mock `65%` as production truth.
- Adding an icon library may require native linking/pod changes. If the team wants no dependency churn, use an internal icon abstraction first.
- The composer mock changes save behavior from explicit `Save` to a text field plus mic. Keep keyboard submit or a small hidden/secondary save affordance until product confirms exact capture UX.
- Settings currently refreshes models when opened. Preserve that behavior in the settings container or route effect.

## Definition Of Done

- UI matches the supplied mocks at the structural/component level.
- App has bottom navigation for Reflections, Queue, and Settings.
- Thread details is reachable from a recent thread.
- App logic is outside shared UI components.
- Store-to-UI mapping is centralized in selectors/view-model builders.
- Screens are split into feature folders that can be worked on in parallel.
- Manual capture and push-to-record still work.
- Settings model actions and capture toggles still work.
- Typecheck, lint, and Jest pass.
