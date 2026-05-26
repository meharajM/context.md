export const spacing = {
  xs: 4,
  sm: 12,
  base: 8,
  md: 16,
  lg: 24,
  xl: 32,
  marginMobile: 20,
  gutterMobile: 16,
} as const;

export type SpacingToken = keyof typeof spacing;
