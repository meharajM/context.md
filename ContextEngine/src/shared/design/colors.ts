export const colors = {
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
  shadow: 'rgba(28, 27, 27, 0.08)',
} as const;

export type ColorToken = keyof typeof colors;
