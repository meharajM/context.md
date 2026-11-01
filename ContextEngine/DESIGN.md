---
name: Thought Notes
description: Calm, private capture for thoughts kept and organized on device.
colors:
  background: "#FCF9F8"
  surface: "#FCF9F8"
  surface-container-lowest: "#FFFFFF"
  surface-container-low: "#F6F3F2"
  surface-container: "#F0EDEC"
  surface-container-high: "#EBE7E7"
  surface-container-highest: "#E5E2E1"
  on-surface: "#1C1B1B"
  on-surface-variant: "#42484B"
  outline: "#72787B"
  outline-variant: "#C2C7CB"
  primary: "#3E5661"
  primary-container: "#566E7A"
  on-primary-container: "#FFFFFF"
  secondary-container: "#DDE3EB"
  tertiary: "#694C35"
  error: "#BA1A1A"
  error-container: "#FFDAD6"
  widget-day-surface: "#F6F3F2"
  widget-day-write: "#3E5661"
  widget-day-write-pressed: "#566E7A"
  widget-day-write-text: "#FFFFFF"
  widget-day-record: "#DDE3EB"
  widget-day-record-pressed: "#C8D1DC"
  widget-day-record-text: "#1C1B1B"
  widget-day-record-outline: "#6B808A"
  widget-night-surface: "#252423"
  widget-night-write: "#C1D3DA"
  widget-night-write-pressed: "#A7C0CB"
  widget-night-write-text: "#1C2C32"
  widget-night-record: "#404A51"
  widget-night-record-pressed: "#526168"
  widget-night-record-text: "#E5E2E1"
  widget-night-record-outline: "#909DA4"
typography:
  display:
    fontFamily: "Hanken Grotesk"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    letterSpacing: "-0.68px"
  headline:
    fontFamily: "Hanken Grotesk"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.22px"
  title:
    fontFamily: "Hanken Grotesk"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.17px"
  body:
    fontFamily: "Inter"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "-0.17px"
  body-small:
    fontFamily: "Inter"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0px"
  label:
    fontFamily: "Inter"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.6px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
  widget-shell: "30px"
  full: "9999px"
spacing:
  xs: "4px"
  base: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  mobile-margin: "20px"
  mobile-gutter: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.lg}"
    height: "52px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    height: "52px"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    height: "52px"
    padding: "0 16px"
  card-default:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xxl}"
    padding: "16px"
  pill-status:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "5px 10px"
  capture-composer:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline-variant}"
    rounded: "{rounded.full}"
    height: "56px"
    padding: "2px 4px 2px 16px"
    elevation: 2
  widget-write-day:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "0"
  widget-record-day:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "0"
  widget-microphone-day:
    backgroundColor: "{colors.widget-day-write}"
    textColor: "{colors.widget-day-write-text}"
    rounded: "{rounded.full}"
    width: "32px"
    height: "32px"
---
# Design System: Thought Notes

## 1. Overview

**Creative North Star: “The Quiet Notebook”** (inferred from the product’s stated calm, private, practical personality).

Thought Notes is for people who capture ideas during conversations, work, and daily life, then want those notes kept and organized locally. Make capture the shortest path. Keep model setup, organization, and recovery details clear and available when useful, without making the experience feel like an AI dashboard.

The visual system uses a warm, light canvas in light appearance and deep neutral surfaces in dark appearance, with slate-blue actions, soft supporting fills, and fine outlines in both. The app follows the operating system appearance so the experience changes without a theme setting to learn. Home keeps the text-first rhythm of a simple note list: a compact heading, flat topic rows, and one clear capture field. Android’s home-screen widget uses the matching day or night palette and keeps Write and Record as explicit actions.

**Key Characteristics:**
- Capture first; organize second.
- Local and private by default, with clear status when model work is unavailable.
- Familiar mobile controls with quiet contrast, flat text-first lists, and restrained elevation.
- Text-first hierarchy; voice starts only after an explicit user action.

## 2. Colors

The palette pairs a warm near-white light theme with a low-glare charcoal dark theme and muted blue-gray action colors.

### Primary
- **Slate action:** The primary token marks navigation, important icons, and selected states.
- **Slate action fill:** The primary-container token fills the strongest buttons and recording controls.

### Secondary
- **Blue-gray wash:** The secondary-container token supports quiet cards, model labels, and non-primary states.

### Tertiary
- **Warm brown:** A tertiary token is declared, but it is not used by the shared components reviewed. Do not add it as a decorative accent without a specific product need.

### Neutral
- **Warm canvas:** Background and surface tokens form a low-glare base.
- **Soft paper surfaces:** The surface-container scale separates content areas through small tonal changes.
- **Ink and muted ink:** On-surface roles carry primary and secondary text.
- **Quiet outlines:** Outline roles separate controls and cards without heavy rules.

### Status
- **Error red and pale red:** Reserve the error pair for destructive, blocked, or failed states. Pair color with a plain-language label or icon; never rely on color alone.

### Android widget palette
The widget uses separate light and dark resource values. A small slate microphone circle marks Record as the primary action. Write stays a quiet pencil-and-label action on the shared surface. Keep icons close to their labels and preserve accessible descriptions for both actions.

### System appearance
The app follows the device appearance automatically. Dark surfaces progress from `#141718` at the page background to `#31373A` for the highest container; main text is `#E4E6E5`, secondary text is `#B8C1C3`, and primary actions use `#B8CDD5` with `#16262C` text. Keep semantic foreground and background pairs together, especially `primary-container`/`on-primary-container` and `error-container`/`error`.

## 3. Typography

**Display and headings:** Hanken Grotesk.

**Body and labels:** Inter.

**Technical text:** Menlo appears locally in diagnostics; it is not a shared typography token.

**Character:** Headings are compact and confident; body text is neutral and easy to scan. Use the display and heading roles for screen hierarchy, Inter for controls and explanatory copy, and uppercase tracking only for small status labels.

### Hierarchy
- **Display:** Largest shared heading role for the primary prompt or screen title.
- **Headline:** Mid-sized heading for section and screen titles.
- **Title:** Compact heading for card and subsection labels.
- **Body:** Main readable copy and capture input.
- **Body small:** Button labels and secondary supporting copy.
- **Label:** Compact uppercase section and status labels.

The type tokens reference Hanken Grotesk and Inter by name, but this repository contains no bundled font files or font registration that guarantees those faces on every device. Confirm platform resolution before treating the named fonts as a verified rendering guarantee.

## 4. Elevation

Depth is mostly tonal: warm surfaces, pale fills, and thin borders do most of the grouping. Keep shadows soft and sparse. Shared cards use a restrained iOS shadow and Android elevation 1; the capture composer uses only a light separation from the page. The native widget uses shape and contrast instead of shadow.

## 5. Components

### Buttons
Use the shared Button for app actions. Primary is a filled slate action with light text; secondary is a light surface with a quiet outline; ghost has no fill and uses the primary text color. All share the same compact shape and 52-height base. Icons sit beside labels with a small gap. Press feedback is a slight scale reduction; disabled controls fade without changing layout.

### Cards and containers
Default cards use a light surface, fine outline, generous corners, and a restrained platform shadow. Wash cards use the secondary blue-gray fill. Inset cards use the lower surface tone and stay flat; action cards use a slightly tighter corner and vertical inset. Prefer one container layer when grouping is enough.

### Capture composer
The composer is a low-elevation single-line field with a short writing prompt and one circular action. The input itself is 44 high; the action target is 48 square. Save appears after text is entered. On Android, Record appears when the field is empty and voice capture is available. Voice starts only after the user presses Record. The composer is disabled with a quiet filled surface when typing is unavailable.

### Topic list
Use plain, full-width rows separated by fine rules. Each row prioritizes the topic name and a short note preview, then places note count and update time in muted text. Avoid a colored icon tile on every row or an extra card behind the list.
On fresh installs, use a one-time swipeable three-step illustrated tutorial before Home: Android widget capture, on-device topic organization, and returning assistant research to related notes. Keep Skip and Back/Next visible, leave the composer usable underneath, and show model-download progress while local helpers prepare. Keep the empty Home focused on capture instead of repeating tutorial content.

The empty Waiting route uses the same quiet, centered approach in its available screen space. Paste fields remain standalone; show the review card only after a preview exists, and present missing-helper guidance once in a concise status. In the note editor, keep Details beside the note field and reserve the footer for Cancel and Save. Settings uses a compact title, concise backup guidance, and inline privacy reassurance instead of stacking another card.

### Status pills
Status pills use uppercase compact labels, a full capsule shape, and a restrained fill with outline. Use the danger variant for errors; preserve readable text contrast and pair the state with plain language.

### Navigation and headers
Bottom navigation keeps each route visible with an icon and label. The active icon sits in a soft blue-gray pill with a primary-colored label; inactive routes use muted text. The brand header keeps the product name clear and local storage as a small lock-and-text cue. It has brand, queue, and thread variants, respects the device safe area, and gives icon-only controls explicit accessibility labels.

### Settings switches
Pair each switch with a visible label and optional description. The description is also the switch hint. Disabled settings fade as a group.

### Home-screen widget
The Android widget is one 60dp-high capture bar, centered vertically in its launcher slot. Its controls never stretch into tall panels. A 32dp microphone circle and Record label form the primary action; a pencil and Write label form the quieter action. The shared surface has 30dp corners, 6dp inner padding, no shadow, and two targets at least 48dp high. Both actions expand horizontally with the launcher. At large system text sizes, compact widgets use accessible icon actions; wider widgets retain labels.

Recording replaces the actions with a red dot, a live counter, and Stop. Only saving uses a progress spinner. Saved and error feedback occupy the same bar. The host minimum is 180 by 60dp with a 2 by 1 cell target and horizontal resizing. The Android 12+ picker uses the same layout. Use day/night resources so the widget follows system appearance.

Reference patterns: [Google Keep Quick capture](https://support.google.com/keep/answer/13302793) and [Samsung home-screen widgets](https://www.samsung.com/us/support/answer/ANS10000945/). Borrow direct actions and compact grouping; keep Thought Notes focused on user-started voice and quick writing.

## 6. Do's and Don'ts

### Do
- **Do** use tokens from src/shared/design for React Native screens and shared primitives.
- **Do** keep the raw capture action prominent and the model/organization controls secondary.
- **Do** preserve explicit state and recovery language when local synthesis cannot run.
- **Do** keep widget actions visible as labeled icon-and-text controls with accessible descriptions.

### Don't
- **Don't** create “Cluttered, generic AI dashboards and repeated stacks of promotional cards.”
- **Don't** record without an explicit action. Preserve Android's independent widget voice capture, keep iOS widget actions explicit about opening the app, and retain a visible Write action on both platforms.
- **Don't** add “Decorative AI effects, urgency, or unexplained processing states.”
- **Don't** hardcode a light surface into an individual screen; use the system-aware semantic tokens.
