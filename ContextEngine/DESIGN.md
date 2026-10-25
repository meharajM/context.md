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
  widget-shell: "20px"
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
    textColor: "{colors.surface-container-lowest}"
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
    backgroundColor: "rgba(255, 255, 255, 0.72)"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    height: "56px"
    padding: "4px 4px 4px 16px"
  widget-write-day:
    backgroundColor: "{colors.widget-day-write}"
    textColor: "{colors.widget-day-write-text}"
    rounded: "{rounded.xl}"
    height: "48px"
    padding: "0 4px"
  widget-record-day:
    backgroundColor: "{colors.widget-day-record}"
    textColor: "{colors.widget-day-record-text}"
    rounded: "{rounded.xl}"
    height: "48px"
    padding: "0 4px"
---
# Design System: Thought Notes

## 1. Overview

**Creative North Star: “The Quiet Notebook”** (inferred from the product’s stated calm, private, practical personality).

Thought Notes is for people who capture ideas during conversations, work, and daily life, then want those notes kept and organized locally. Make capture the shortest path. Keep model setup, organization, and recovery details clear and available when useful, without making the experience feel like an AI dashboard.

The visual system uses a warm, light canvas, ink-like text, restrained slate-blue actions, soft supporting fills, and fine outlines. Surfaces may lift gently where hierarchy needs it. Motion is brief feedback for a press or state change; it does not decorate the page. Android’s home-screen widget has its own day and night palette and puts text and voice capture beside each other as explicit actions. The main app palette currently defines a light theme only.

**Key Characteristics:**
- Capture first; organize second.
- Local and private by default, with clear status when model work is unavailable.
- Familiar mobile controls with quiet contrast and restrained elevation.
- Text-first hierarchy; voice starts only after an explicit user action.

## 2. Colors

The palette pairs a warm near-white base with dark neutral text and muted blue-gray action colors.

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
The widget intentionally uses separate light and dark resource values. Write is the filled action. Record is the quieter outlined action. Keep its icon and text labels together; its accessible descriptions explain the full action.

## 3. Typography

**Display and headings:** Hanken Grotesk.

**Body and labels:** Inter.

**Technical text:** Menlo appears locally in diagnostics; it is not a shared typography token.

**Character:** Headings are compact and confident; body text is neutral and easy to scan. Use the display and heading roles for screen hierarchy, Inter for controls and explanatory copy, and uppercase tracking only for small section labels and status pills.

### Hierarchy
- **Display:** Largest shared heading role for the primary prompt or screen title.
- **Headline:** Mid-sized heading for section and screen titles.
- **Title:** Compact heading for card and subsection labels.
- **Body:** Main readable copy and capture input.
- **Body small:** Button labels and secondary supporting copy.
- **Label:** Compact uppercase section and status labels.

The type tokens reference Hanken Grotesk and Inter by name, but this repository contains no bundled font files or font registration that guarantees those faces on every device. Confirm platform resolution before treating the named fonts as a verified rendering guarantee.

## 4. Elevation

Depth is mostly tonal: warm surfaces, pale fills, and thin borders do most of the grouping. Keep shadows soft and sparse. Shared cards use a restrained iOS shadow and Android elevation 1; floating controls and model/capture moments may use a stronger shadow, with Android elevation 4 for the shared floating token. The capture composer has its own slightly stronger lift. The native widget uses shape and contrast instead of shadow.

## 5. Components

### Buttons
Use the shared Button for app actions. Primary is a filled slate action with light text; secondary is a light surface with a quiet outline; ghost has no fill and uses the primary text color. All share the same compact shape and 52-height base. Icons sit beside labels with a small gap. Press feedback is a slight scale reduction; disabled controls fade without changing layout.

### Cards and containers
Default cards use a light surface, fine outline, generous corners, and a restrained platform shadow. Wash cards use the secondary blue-gray fill. Inset cards use the lower surface tone and stay flat; action cards use a slightly tighter corner and vertical inset. Prefer one container layer when grouping is enough.

### Capture composer
The composer is a single-line pill with an edit icon, a flexible text field, and one circular action. The input itself is 44 high; the action target is 48 square. Save appears after text is entered. On Android, Record appears when the field is empty and voice capture is available. Voice starts only after the user presses Record. The composer is disabled with a quiet filled surface when typing is unavailable.

### Status pills
Status pills use uppercase compact labels, a full capsule shape, and a restrained fill with outline. Use the danger variant for errors; preserve readable text contrast and pair the state with plain language.

### Navigation and headers
Bottom navigation keeps each route visible with an icon and label. The active route uses the primary color; inactive routes use muted text. The header has brand, queue, and thread variants, respects the device safe area, and gives icon-only controls explicit accessibility labels.

### Settings switches
Pair each switch with a visible label and optional description. The description is also the switch hint. Disabled settings fade as a group.

### Home-screen widget
The Android widget is a compact horizontal pair: filled Write and outlined Record, each with an icon and text. Keep the two targets at least 48 high, with a narrow gap and comfortable inner padding. The host minimum size is 180 by 56; the shell and actions use distinct rounded shapes. Its Android 12+ picker preview mirrors the live Write/Record layout. Use the day/night widget tokens rather than borrowing the main app palette.

## 6. Do's and Don'ts

### Do
- **Do** use tokens from src/shared/design for React Native screens and shared primitives.
- **Do** keep the raw capture action prominent and the model/organization controls secondary.
- **Do** preserve explicit state and recovery language when local synthesis cannot run.
- **Do** keep widget actions visible as labeled icon-and-text controls with accessible descriptions.

### Don't
- **Don't** create “Cluttered, generic AI dashboards and repeated stacks of promotional cards.”
- **Don't** use voice-first or always-listening patterns. PRODUCT.md still describes a “text-only release,” but current Android v1 supports explicit, user-initiated voice capture; keep text first and never listen passively.
- **Don't** add “Decorative AI effects, urgency, or unexplained processing states.”
- **Don't** invent a dark palette for the main app from the Android widget’s night resources.
