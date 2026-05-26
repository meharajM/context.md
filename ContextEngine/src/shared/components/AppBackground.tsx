import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../design/colors';

export function AppBackground({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.background, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
