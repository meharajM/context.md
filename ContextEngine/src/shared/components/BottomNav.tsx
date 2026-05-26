import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../design/colors';
import { radius } from '../design/radius';
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
              style={({ pressed }) => [
                styles.navItem,
                active ? styles.navItemActive : styles.navItemInactive,
                pressed ? styles.navItemPressed : null,
              ]}>
              <Icon name={item.icon as IconName} size={17} color={active ? colors.primaryContainer : colors.onSurfaceVariant} />
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
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
  },
  nav: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.xxl,
  },
  navItem: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    paddingVertical: 8,
  },
  navItemActive: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  navItemInactive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  navItemPressed: {
    opacity: 0.88,
  },
  label: {
    ...typography.caption,
  },
  labelActive: {
    color: colors.primaryContainer,
    fontWeight: '600',
  },
  labelInactive: {
    color: colors.onSurfaceVariant,
  },
});
