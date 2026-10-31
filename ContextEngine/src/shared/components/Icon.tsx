import React from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';

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
  | 'play'
  | 'storage'
  | 'lock'
  | 'image'
  | 'trash'
  | 'more';

type DrawnIconName = 'mic' | 'document' | 'account' | 'lock' | 'image' | 'trash';
type TextIconName = Exclude<IconName, DrawnIconName>;

const glyphs: Record<TextIconName, string> = {
  brand: '✦',
  edit: '✎',
  stop: '■',
  queue: '⌛︎',
  settings: '⚙︎',
  reflections: '✦',
  share: '↗',
  menu: '☰',
  shield: '⛨︎',
  spark: '✦',
  chevronLeft: '‹',
  chevronRight: '›',
  plus: '+',
  clock: '◷',
  check: '✓',
  play: '▶',
  storage: '▣',
  more: '⋮',
};

function IconGlyph({ name, size, color }: { name: IconName; size: number; color: ColorValue }) {
  const stroke = Math.max(1, size * 0.09);

  switch (name) {
    case 'mic':
      return (
        <View style={{ width: size, height: size }}>
          <View style={[styles.micBody, { top: size * 0.02, left: size * 0.36, width: size * 0.28, height: size * 0.5, borderWidth: stroke, borderColor: color, borderRadius: size * 0.2 }]} />
          <View style={[styles.micArch, { top: size * 0.35, left: size * 0.19, width: size * 0.62, height: size * 0.36, borderLeftWidth: stroke, borderRightWidth: stroke, borderBottomWidth: stroke, borderColor: color, borderBottomLeftRadius: size * 0.4, borderBottomRightRadius: size * 0.4 }]} />
          <View style={[styles.micStem, { top: size * 0.7, left: size * 0.48, width: stroke, height: size * 0.16, backgroundColor: color }]} />
          <View style={[styles.micBase, { top: size * 0.87, left: size * 0.31, width: size * 0.38, height: stroke, backgroundColor: color }]} />
        </View>
      );
    case 'document':
      return (
        <View style={[styles.document, { width: size * 0.68, height: size * 0.84, borderWidth: stroke, borderColor: color, paddingHorizontal: size * 0.12, gap: size * 0.12 }]}>
          <View style={[styles.documentLine, { height: stroke, backgroundColor: color }]} />
          <View style={[styles.documentLine, { height: stroke, backgroundColor: color }]} />
          <View style={[styles.documentShortLine, { height: stroke, backgroundColor: color }]} />
        </View>
      );
    case 'account':
      return (
        <View style={{ width: size, height: size }}>
          <View style={[styles.accountHead, { top: size * 0.12, left: size * 0.38, width: size * 0.24, height: size * 0.24, borderRadius: size * 0.12, backgroundColor: color }]} />
          <View style={[styles.accountShoulders, { top: size * 0.47, left: size * 0.16, width: size * 0.68, height: size * 0.4, borderTopLeftRadius: size * 0.34, borderTopRightRadius: size * 0.34, backgroundColor: color }]} />
        </View>
      );
    case 'lock':
      return (
        <View style={{ width: size, height: size }}>
          <View style={[styles.lockShackle, { top: size * 0.12, left: size * 0.27, width: size * 0.46, height: size * 0.48, borderWidth: stroke, borderBottomWidth: 0, borderColor: color, borderTopLeftRadius: size * 0.24, borderTopRightRadius: size * 0.24 }]} />
          <View style={[styles.lockBody, { top: size * 0.46, left: size * 0.16, width: size * 0.68, height: size * 0.44, borderWidth: stroke, borderColor: color, borderRadius: size * 0.08 }]} />
          <View style={[styles.lockKey, { top: size * 0.6, left: size * 0.47, width: stroke, height: size * 0.16, backgroundColor: color }]} />
        </View>
      );
    case 'image':
      return (
        <View style={[styles.imageFrame, { width: size * 0.86, height: size * 0.68, borderWidth: stroke, borderColor: color, borderRadius: size * 0.08 }]}>
          <View style={[styles.imageSun, { top: size * 0.12, right: size * 0.12, width: size * 0.16, height: size * 0.16, borderRadius: size * 0.08, backgroundColor: color }]} />
          <View style={[styles.imageHill, { left: size * 0.1, bottom: size * 0.08, width: 0, height: 0, borderLeftWidth: size * 0.21, borderRightWidth: size * 0.21, borderBottomWidth: size * 0.28, borderBottomColor: color }]} />
          <View style={[styles.imageHillSmall, { right: size * 0.06, bottom: size * 0.08, width: 0, height: 0, borderLeftWidth: size * 0.15, borderRightWidth: size * 0.15, borderBottomWidth: size * 0.2, borderBottomColor: color }]} />
        </View>
      );
    case 'trash':
      return (
        <View style={{ width: size, height: size }}>
          <View style={[styles.trashHandle, { top: size * 0.12, left: size * 0.35, width: size * 0.3, height: stroke, backgroundColor: color }]} />
          <View style={[styles.trashLid, { top: size * 0.23, left: size * 0.2, width: size * 0.6, height: stroke, backgroundColor: color }]} />
          <View style={[styles.trashBody, { top: size * 0.31, left: size * 0.27, width: size * 0.46, height: size * 0.56, borderWidth: stroke, borderColor: color, borderBottomLeftRadius: size * 0.08, borderBottomRightRadius: size * 0.08 }]} />
          <View style={[styles.trashLine, { top: size * 0.42, left: size * 0.44, width: stroke, height: size * 0.31, backgroundColor: color }]} />
        </View>
      );
    default:
      return <Text style={[styles.glyph, { color, fontSize: size, lineHeight: size + 2 }]}>{glyphs[name]}</Text>;
  }
}

export function Icon({
  name,
  size = 18,
  color = colors.onSurface,
  backgroundColor = 'transparent',
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  backgroundColor?: ColorValue;
}) {
  return (
    <View style={[styles.base, { width: size + 6, height: size + 6, backgroundColor, borderRadius: radius.md }]}>
      <IconGlyph name={name} size={size} color={color} />
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
  micBody: { position: 'absolute' },
  micArch: { position: 'absolute', borderTopWidth: 0 },
  micStem: { position: 'absolute' },
  micBase: { position: 'absolute' },
  document: { borderRadius: 2, justifyContent: 'center' },
  documentLine: {},
  documentShortLine: { width: '72%' },
  accountHead: { position: 'absolute' },
  accountShoulders: { position: 'absolute', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  lockShackle: { position: 'absolute' },
  lockBody: { position: 'absolute' },
  lockKey: { position: 'absolute' },
  imageFrame: { overflow: 'hidden', position: 'relative' },
  imageSun: { position: 'absolute' },
  imageHill: { position: 'absolute', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopWidth: 0 },
  imageHillSmall: { position: 'absolute', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopWidth: 0 },
  trashHandle: { position: 'absolute' },
  trashLid: { position: 'absolute' },
  trashBody: { position: 'absolute' },
  trashLine: { position: 'absolute' },
});
