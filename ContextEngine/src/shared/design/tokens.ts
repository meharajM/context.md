import { colors } from './colors';

export { colors } from './colors';
export { radius } from './radius';
export { shadows } from './shadows';
export { spacing } from './spacing';
export { typography } from './typography';

export const tokens = {
  colors,
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
