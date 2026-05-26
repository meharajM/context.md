import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../shared/design/colors';
import { radius } from '../shared/design/radius';
import { typography } from '../shared/design/typography';
import type { AppScreen } from '../ui/design';

export function ScreenTabs({
  activeScreen,
  onHome,
  onSettings,
}: {
  activeScreen: AppScreen;
  onHome: () => void;
  onSettings: () => void;
}) {
  return (
    <View style={styles.screenTabs}>
      <TabButton label="Home" active={activeScreen === 'home'} onPress={onHome} testID="tab_home" />
      <TabButton label="Settings" active={activeScreen === 'settings'} onPress={onSettings} testID="tab_settings" />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.tabButton,
        active ? styles.tabButtonActive : styles.tabButtonInactive,
        pressed ? styles.tabButtonPressed : null,
      ]}
      onPress={onPress}>
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : styles.tabButtonTextInactive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.xl,
    padding: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tabButtonActive: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.primaryContainer,
  },
  tabButtonInactive: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
  },
  tabButtonPressed: {
    opacity: 0.9,
  },
  tabButtonText: {
    ...typography.bodySm,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: colors.primaryContainer,
  },
  tabButtonTextInactive: {
    color: colors.onSurfaceVariant,
  },
});
