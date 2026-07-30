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
                active ? styles.navItemActive : styles.navItemInactive,
                pressed ? styles.navItemPressed : null,
              ]}>
              <Icon name={item.icon as IconName} size={24} color={active ? colors.primary : colors.onSurfaceVariant} />
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
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
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
    gap: 4,
  },
  navItemActive: {
    // Handled purely by icon color in Stitch design
  },
  navItemInactive: {
  },
  navItemPressed: {
    opacity: 0.88,
  },
  label: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 10,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  labelInactive: {
    color: colors.onSurfaceVariant,
  },
});
