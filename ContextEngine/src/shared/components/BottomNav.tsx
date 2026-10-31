import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../design/colors';
import { spacing } from '../design/spacing';
import { typography } from '../design/typography';
import { Icon, type IconName } from './Icon';
import { primaryNavigationItems, type PrimaryRoute } from '../../app/navigation';

export function BottomNav({
  activeRoute,
  onChangeRoute,
}: {
  activeRoute: PrimaryRoute;
  onChangeRoute: (route: PrimaryRoute) => void;
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.nav}>
        {primaryNavigationItems.map(item => {
          const active = item.route === activeRoute;

          return (
            <Pressable
              key={item.route}
              testID={`tab_${item.route}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChangeRoute(item.route)}
              hitSlop={8}
              collapsable={false}
              style={({ pressed }) => [
                styles.navItem,
                styles.navItemInactive,
                pressed ? styles.navItemPressed : null,
              ]}>
              <View style={[styles.iconShell, active ? styles.iconShellActive : null]}>
                <Icon name={item.icon as IconName} size={22} color={active ? colors.primary : colors.onSurfaceVariant} />
              </View>
              <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    // No outer padding, full width
  },
  nav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopColor: colors.surfaceContainerHigh,
    borderTopWidth: 1,
    paddingHorizontal: spacing.marginMobile,
    height: 64,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navItemInactive: {
  },
  navItemPressed: {
    opacity: 0.88,
  },
  iconShell: {
    width: 46,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShellActive: {
    backgroundColor: colors.secondaryContainer,
  },
  label: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  labelInactive: {
    color: colors.onSurfaceVariant,
  },
});
