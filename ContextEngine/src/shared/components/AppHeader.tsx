import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../design/colors';
import { spacing } from '../design/spacing';
import { typography } from '../design/typography';
import { Icon } from './Icon';

type AppHeaderVariant = 'brand' | 'queue' | 'thread';

export function AppHeader({
  variant,
  title,
  subtitle,
  pillLabel,
  onBackPress,
  onMenuPress,
  onAccountPress,
  onSharePress,
  keyboardVisible = false,
  onKeyboardDone,
}: {
  variant: AppHeaderVariant;
  title: string;
  subtitle?: string;
  pillLabel?: string;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  onAccountPress?: () => void;
  onSharePress?: () => void;
  keyboardVisible?: boolean;
  onKeyboardDone?: () => void;
}) {
  const insets = useSafeAreaInsets();

  if (variant === 'queue') {
    return (
      <View style={[styles.queueHeader, { paddingTop: insets.top + spacing.xs }]}>
        <HeaderIconButton icon="menu" onPress={onMenuPress} accessibilityLabel="Go to Home" />
        <Text style={styles.queueTitle}>{title}</Text>
        <HeaderIconButton icon="account" onPress={onAccountPress} accessibilityLabel="Open settings" />
      </View>
    );
  }

  if (variant === 'thread') {
    return (
      <View style={[styles.threadHeader, { paddingTop: insets.top + spacing.xs }]}>
        <HeaderIconButton icon="chevronLeft" onPress={onBackPress} accessibilityLabel="Go back" />
        <Text style={styles.threadTitle} numberOfLines={1}>
          {title}
        </Text>
        <HeaderIconButton icon="share" onPress={onSharePress} accessibilityLabel="Share notes" />
      </View>
    );
  }

  return (
    <View style={[styles.brandHeader, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.brandRow}>
        <View style={styles.brandCopy}>
          <Text testID="app_title" style={styles.brandTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.brandSubtitle}>{subtitle}</Text> : null}
        </View>
        {keyboardVisible && onKeyboardDone ? (
          <Pressable
            testID="keyboard_done_button"
            accessibilityRole="button"
            accessibilityLabel="Hide keyboard"
            onPress={onKeyboardDone}
            hitSlop={8}
            style={styles.keyboardDoneButton}>
            <Text style={styles.keyboardDoneText}>Done</Text>
          </Pressable>
        ) : pillLabel ? (
          <View accessibilityLabel={pillLabel} style={styles.deviceMark}>
            <Icon name="lock" size={12} color={colors.primary} />
            <Text style={styles.deviceMarkText}>{pillLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && onPress ? styles.iconButtonPressed : null,
      ]}>
      <Icon name={icon} size={24} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  brandCopy: {
    justifyContent: 'center',
    gap: 2,
  },
  brandTitle: {
    ...typography.headlineSm,
    color: colors.primary,
    fontWeight: '700',
  },
  brandSubtitle: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  keyboardDoneButton: {
    minWidth: 48,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  keyboardDoneText: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '600',
  },
  deviceMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  deviceMarkText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  queueHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    minHeight: 64,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  queueTitle: {
    ...typography.headlineMd,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  threadHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    minHeight: 64,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  threadTitle: {
    flex: 1,
    ...typography.headlineMd,
    color: colors.onSurface,
    fontWeight: '600',
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    opacity: 0.7,
  },
});
