import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../design/colors';
import { radius } from '../design/radius';
import { spacing } from '../design/spacing';
import { typography } from '../design/typography';
import { Icon } from './Icon';
import { Pill } from './Pill';

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
}: {
  variant: AppHeaderVariant;
  title: string;
  subtitle?: string;
  pillLabel?: string;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  onAccountPress?: () => void;
  onSharePress?: () => void;
}) {
  if (variant === 'queue') {
    return (
      <View style={styles.queueHeader}>
        <HeaderIconButton icon="menu" onPress={onMenuPress} accessibilityLabel="Open menu" />
        <Text style={styles.queueTitle}>{title}</Text>
        <HeaderIconButton icon="account" onPress={onAccountPress} accessibilityLabel="Open account" />
      </View>
    );
  }

  if (variant === 'thread') {
    return (
      <View style={styles.threadHeader}>
        <HeaderIconButton icon="chevronLeft" onPress={onBackPress} accessibilityLabel="Go back" />
        <Text style={styles.threadTitle} numberOfLines={1}>
          {title}
        </Text>
        <HeaderIconButton icon="share" onPress={onSharePress} accessibilityLabel="Share thread" />
      </View>
    );
  }

  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandRow}>
        <View style={styles.brandBlock}>
          <View style={styles.brandIcon}>
            <Icon name="shield" size={18} color={colors.primaryContainer} />
          </View>
          <View style={styles.brandCopy}>
            <Text testID="app_title" style={styles.brandTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.brandSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {pillLabel ? <Pill label={pillLabel} variant="local" /> : null}
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
      <Icon name={icon} size={18} color={colors.onSurface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  brandBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: {
    flex: 1,
    gap: 3,
  },
  brandTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  brandSubtitle: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  queueHeader: {
    minHeight: 72,
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    textAlign: 'center',
    flex: 1,
  },
  threadHeader: {
    minHeight: 72,
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  threadTitle: {
    flex: 1,
    ...typography.headlineSm,
    color: colors.onSurface,
    textAlign: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  iconButtonPressed: {
    opacity: 0.85,
  },
});
