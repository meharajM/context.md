import React from 'react';
import { Linking, Platform, UIManager, requireNativeComponent, type ViewStyle } from 'react-native';

import { Button } from './Button';

type ShortcutsSetupButtonProps = {
  style?: ViewStyle;
};

const hasNativeShortcutsButton =
  Platform.OS === 'ios' && UIManager.getViewManagerConfig?.('ShortcutsSetupButton') != null;

const NativeShortcutsSetupButton = hasNativeShortcutsButton
  ? requireNativeComponent<ShortcutsSetupButtonProps>('ShortcutsSetupButton')
  : null;

const SHORTCUTS_SETUP_URL = 'shortcuts://';

export function openShortcutsSetupSurface() {
  return Linking.openURL(SHORTCUTS_SETUP_URL).catch(error => {
    console.error('Failed to open Shortcuts from fallback shortcuts button:', error);
  });
}

export function ShortcutsSetupButton({ style }: ShortcutsSetupButtonProps) {
  if (NativeShortcutsSetupButton) {
    return <NativeShortcutsSetupButton style={style} />;
  }

  return (
    <Button
      label="Open Shortcuts"
      variant="secondary"
      icon="spark"
      onPress={openShortcutsSetupSurface}
      style={style}
    />
  );
}
