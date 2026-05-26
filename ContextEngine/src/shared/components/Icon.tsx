import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../design/colors';
import { radius } from '../design/radius';

export type IconName =
  | 'brand'
  | 'edit'
  | 'mic'
  | 'stop'
  | 'queue'
  | 'settings'
  | 'reflections'
  | 'share'
  | 'menu'
  | 'account'
  | 'shield'
  | 'document'
  | 'spark'
  | 'chevronLeft'
  | 'chevronRight'
  | 'plus'
  | 'clock'
  | 'check'
  | 'storage'
  | 'lock'
  | 'image';

const glyphs: Record<IconName, string> = {
  brand: '◫',
  edit: '✎',
  mic: '◉',
  stop: '■',
  queue: '≣',
  settings: '⚙',
  reflections: '◔',
  share: '↗',
  menu: '⋯',
  account: '◡',
  shield: '⬟',
  document: '▤',
  spark: '✦',
  chevronLeft: '‹',
  chevronRight: '›',
  plus: '+',
  clock: '◷',
  check: '✓',
  storage: '▣',
  lock: '▥',
  image: '▧',
};

export function Icon({
  name,
  size = 18,
  color = colors.onSurface,
  backgroundColor = 'transparent',
}: {
  name: IconName;
  size?: number;
  color?: string;
  backgroundColor?: string;
}) {
  return (
    <View style={[styles.base, { width: size + 6, height: size + 6, backgroundColor, borderRadius: radius.md }]}>
      <Text style={[styles.glyph, { color, fontSize: size, lineHeight: size + 2 }]}>{glyphs[name]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '600',
  },
});
