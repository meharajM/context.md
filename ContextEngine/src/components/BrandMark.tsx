import React from 'react';
import { Image, StyleSheet } from 'react-native';

import { colors } from '../shared/design/colors';

export function BrandMark() {
  return (
    <Image
      accessibilityLabel="Thought Notes"
      accessibilityRole="image"
      source={require('../assets/app-icon.png')}
      style={styles.brandMark}
    />
  );
}

const styles = StyleSheet.create({
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
});
