import type { TextStyle } from 'react-native';

export const typography = {
  displayLg: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 41,
    letterSpacing: -0.68,
  } satisfies TextStyle,
  headlineMd: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.22,
  } satisfies TextStyle,
  headlineSm: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.17,
  } satisfies TextStyle,
  bodyLg: {
    fontFamily: 'Inter',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: -0.17,
  } satisfies TextStyle,
  bodySm: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0,
  } satisfies TextStyle,
  labelCaps: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.6,
  } satisfies TextStyle,
  caption: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0,
  } satisfies TextStyle,
} as const;
