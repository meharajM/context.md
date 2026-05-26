export { colors } from './colors';
export { radius } from './radius';
export { shadows } from './shadows';
export { spacing } from './spacing';
export { typography } from './typography';

export const tokens = {
  colors: {
    background: '#fcf9f8',
    surface: '#fcf9f8',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f6f3f2',
    surfaceContainer: '#f0edec',
    surfaceContainerHigh: '#ebe7e7',
    surfaceContainerHighest: '#e5e2e1',
    surfaceVariant: '#e5e2e1',
    onSurface: '#1c1b1b',
    onSurfaceVariant: '#42484b',
    outline: '#72787b',
    outlineVariant: '#c2c7cb',
    primary: '#3e5661',
    primaryContainer: '#566e7a',
    secondaryContainer: '#dde3eb',
    tertiary: '#694c35',
    error: '#ba1a1a',
    errorContainer: '#ffdad6',
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 12,
    base: 8,
    md: 16,
    lg: 24,
    xl: 32,
    marginMobile: 20,
    gutterMobile: 16,
  },
  typography: {
    displayLg: {
      fontFamily: 'Hanken Grotesk',
      fontSize: 34,
      fontWeight: '700',
      lineHeight: 41,
      letterSpacing: -0.68,
    },
    headlineMd: {
      fontFamily: 'Hanken Grotesk',
      fontSize: 22,
      fontWeight: '600',
      lineHeight: 28,
      letterSpacing: -0.22,
    },
    headlineSm: {
      fontFamily: 'Hanken Grotesk',
      fontSize: 17,
      fontWeight: '600',
      lineHeight: 22,
      letterSpacing: -0.17,
    },
    bodyLg: {
      fontFamily: 'Inter',
      fontSize: 17,
      fontWeight: '400',
      lineHeight: 24,
      letterSpacing: -0.17,
    },
    bodySm: {
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0,
    },
    labelCaps: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      letterSpacing: 0.6,
    },
    caption: {
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      letterSpacing: 0,
    },
  },
} as const;
