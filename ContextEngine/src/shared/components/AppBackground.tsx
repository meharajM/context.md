import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../design/colors';

export function AppBackground({ children, style, ...rest }: ViewProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']} {...rest}>
      <View style={[styles.background, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
