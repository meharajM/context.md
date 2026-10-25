# Android Resources Architecture

Android XML resources.

## Contents

- `values/strings.xml`: Android string resources.
- `layout/quick_capture_widget.xml` and the matching `drawable/quick_capture_widget_*` and `values/quick_capture_widget_colors.xml` resources: compact home-screen Write/Record actions, with an outlined Record target, day/night palettes, and concise screen-reader labels.
- `xml/quick_capture_widget_info.xml`: widget sizing, labels, and a picker preview that mirrors the live layout on Android 12+.
- `values/styles.xml`: app styles.
- `drawable/rn_edit_text_material.xml`: React Native edit text drawable resource.
- `xml/data_extraction_rules.xml`: denies cloud backup and device transfer for every credential- and device-protected app storage domain.
- `xml/shortcuts.xml`: Assistant/App Actions capture capability and launcher shortcut metadata.

These resources support native Android hosting, not the main React Native UI design system.
