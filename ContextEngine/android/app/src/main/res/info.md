# Android Resources Architecture

Android XML resources.

## Contents

- `values/strings.xml`: Android string resources.
- `layout/quick_capture_widget.xml` and matching widget drawables/colors: a fixed 60dp capture bar with grouped microphone/Record and pencil/Write actions, live recording dot/timer/Stop, a saving-only spinner, saved/error feedback, 48dp touch targets, and light/dark palettes. The shell stays slim in taller launcher slots.
- `layout/activity_quick_capture.xml`, quick-capture sheet/input backgrounds, and enter/exit animations: small keyboard-first text capture surface and first-use microphone permission panel.
- `xml/quick_capture_widget_info.xml`: 180 × 60dp minimum size, 2 × 1 target cells, horizontal resizing, and a picker preview that mirrors the live layout on Android 12+.
- `values/attrs.xml`, day/night theme colors, and app styles: system-aware semantic colors exposed to React Native through theme attributes, with matching light/dark status and navigation bar icon contrast.
- `drawable/rn_edit_text_material.xml`: React Native edit text drawable resource.
- `xml/data_extraction_rules.xml`: denies cloud backup and device transfer for every credential- and device-protected app storage domain.
- `xml/shortcuts.xml`: Assistant/App Actions capture capability and launcher shortcut metadata.

These resources support native Android hosting, not the main React Native UI design system.
