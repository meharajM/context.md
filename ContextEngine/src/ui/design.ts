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
  const notes = content
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^Source (kind|transcript):/i.test(trimmed)) return '';
      let bulletText = trimmed;
      if (trimmed.startsWith('-')) {
        bulletText = trimmed.substring(1).trim();
      }
      const timestampMatch = bulletText.match(/^\[([^\]]+)\]\s*(.*)$/);
      return timestampMatch ? timestampMatch[2].trim() : bulletText;
    })
    .filter(Boolean);

  if (notes.length === 0) {
    return 'No captured details yet.';
  }

  const combined = notes.join(' ').trim().replace(/\s+/g, ' ');
  return combined.length > 140 ? `${combined.slice(0, 140).trimEnd()}…` : combined;
}
