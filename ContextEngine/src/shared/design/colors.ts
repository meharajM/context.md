import { DynamicColorIOS, Platform, PlatformColor } from 'react-native';

const adaptiveColor = (attribute: string, light: string, dark: string) => {
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({ light, dark });
  }

  if (Platform.OS === 'android') {
    return PlatformColor(`?attr/${attribute}`);
  }

  return light;
};

/**
 * Semantic colors are resolved by the operating system, so the complete UI
 * follows the device appearance without each screen maintaining its own theme.
 * Android values are backed by day/night theme attributes in res/values*.
 */
export const colors = {
  background: adaptiveColor('tnColorBackground', '#fcf9f8', '#141718'),
  surface: adaptiveColor('tnColorSurface', '#fcf9f8', '#191c1d'),
  surfaceContainerLowest: adaptiveColor('tnColorSurfaceContainerLowest', '#ffffff', '#1b1e1f'),
  surfaceContainerLow: adaptiveColor('tnColorSurfaceContainerLow', '#f6f3f2', '#202426'),
  surfaceContainer: adaptiveColor('tnColorSurfaceContainer', '#f0edec', '#252a2c'),
  surfaceContainerHigh: adaptiveColor('tnColorSurfaceContainerHigh', '#ebe7e7', '#2b3032'),
  surfaceContainerHighest: adaptiveColor('tnColorSurfaceContainerHighest', '#e5e2e1', '#31373a'),
  surfaceVariant: adaptiveColor('tnColorSurfaceVariant', '#e5e2e1', '#40484b'),
  onSurface: adaptiveColor('tnColorOnSurface', '#1c1b1b', '#e4e6e5'),
  onSurfaceVariant: adaptiveColor('tnColorOnSurfaceVariant', '#42484b', '#b8c1c3'),
  outline: adaptiveColor('tnColorOutline', '#72787b', '#899396'),
  outlineVariant: adaptiveColor('tnColorOutlineVariant', '#c2c7cb', '#424c4f'),
  primary: adaptiveColor('tnColorPrimary', '#3e5661', '#b8cdd5'),
  primaryContainer: adaptiveColor('tnColorPrimaryContainer', '#566e7a', '#b8cdd5'),
  onPrimaryContainer: adaptiveColor('tnColorOnPrimaryContainer', '#ffffff', '#16262c'),
  switchThumb: adaptiveColor('tnColorSwitchThumb', '#ffffff', '#e4e6e5'),
  secondaryContainer: adaptiveColor('tnColorSecondaryContainer', '#dde3eb', '#364149'),
  tertiary: adaptiveColor('tnColorTertiary', '#694c35', '#d3b79c'),
  error: adaptiveColor('tnColorError', '#ba1a1a', '#ffb4ab'),
  errorContainer: adaptiveColor('tnColorErrorContainer', '#ffdad6', '#5c1812'),
  shadow: adaptiveColor('tnColorShadow', 'rgba(28, 27, 27, 0.08)', '#000000'),
} as const;

export type ColorToken = keyof typeof colors;
