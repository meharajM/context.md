import { colors } from '../shared/design/colors';
import { radius } from '../shared/design/radius';
import { shadows } from '../shared/design/shadows';
import { spacing } from '../shared/design/spacing';
import { typography } from '../shared/design/typography';
import { tokens } from '../shared/design/tokens';

export type AppScreen = 'home' | 'settings';

export type Palette = {
  background: string;
  panel: string;
  panelAlt: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentWash: string;
  accentText: string;
  danger: string;
  disabled: string;
};

export const palette: Palette = {
  background: colors.background,
  panel: colors.surfaceContainerLowest,
  panelAlt: colors.surfaceContainerLow,
  text: colors.onSurface,
  muted: colors.onSurfaceVariant,
  border: colors.outlineVariant,
  accent: colors.primaryContainer,
  accentWash: colors.secondaryContainer,
  accentText: colors.surfaceContainerLowest,
  danger: colors.error,
  disabled: colors.surfaceContainer,
};

export { colors, radius, shadows, spacing, typography, tokens };

export function formatModelSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function formatSectionPreview(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return 'No captured details yet.';
  }

  return trimmed.length > 140 ? `${trimmed.slice(0, 140).trimEnd()}…` : trimmed;
}
