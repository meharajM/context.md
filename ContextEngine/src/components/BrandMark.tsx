import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../shared/design/colors';
import { radius } from '../shared/design/radius';
import { Icon } from '../shared/components/Icon';

export function BrandMark() {
  return (
    <View accessibilityLabel="Context Engine logo" accessibilityRole="image" style={styles.brandMark}>
      <View style={styles.outer}>
        <View style={styles.inner}>
          <Icon name="brand" size={18} color={colors.primaryContainer} />
        </View>
      </View>
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  outer: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  inner: {
    width: 22,
    height: 22,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryContainer,
  },
});
