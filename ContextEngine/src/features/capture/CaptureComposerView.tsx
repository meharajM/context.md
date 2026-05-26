import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { CaptureComposerViewProps } from './captureTypes';

export function CaptureComposerView({
  value,
  canType,
  canRecord,
  isRecording,
  onChangeValue,
  onRecordPress,
  onSavePress,
}: CaptureComposerViewProps) {
  const hasText = value.trim().length > 0;
  const canSave = canType && hasText;

  return (
    <View style={[styles.composerPill, !canType ? styles.composerDisabled : null]}>
      {/* Edit/Pencil icon on the left */}
      <View style={styles.editIcon}>
        <Icon name="edit" size={16} color={colors.onSurfaceVariant} />
      </View>

      {/* TextInput in the center */}
      <TextInput
        testID="thought_input"
        accessibilityLabel="Thought Input"
        style={styles.input}
        placeholder={canType ? 'Type or tap to record...' : 'Capture is disabled in settings'}
        placeholderTextColor="rgba(66, 72, 75, 0.6)"
        value={value}
        onChangeText={onChangeValue}
        editable={canType}
        multiline={false}
        onSubmitEditing={onSavePress}
        returnKeyType="send"
      />

      {/* Dynamic button on the right */}
      {hasText ? (
        <Pressable
          testID="save_button"
          accessibilityLabel="Save Button"
          accessibilityRole="button"
          disabled={!canSave}
          onPress={onSavePress}
          style={({ pressed }) => [
            styles.actionButton,
            styles.saveButtonActive,
            pressed ? styles.actionButtonPressed : null,
          ]}>
          <Icon name="check" size={18} color={colors.surfaceContainerLowest} />
        </Pressable>
      ) : (
        <Pressable
          testID="record_button"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canRecord, selected: isRecording }}
          disabled={!canRecord}
          onPress={onRecordPress}
          style={({ pressed }) => [
            styles.actionButton,
            isRecording ? styles.actionButtonRecording : styles.actionButtonReady,
            pressed && canRecord ? styles.actionButtonPressed : null,
          ]}>
          <Icon
            name={isRecording ? 'stop' : 'mic'}
            size={18}
            color={isRecording ? colors.error : colors.surfaceContainerLowest}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  composerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    marginHorizontal: spacing.marginMobile,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  composerDisabled: {
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.outlineVariant,
    opacity: 0.8,
  },
  editIcon: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    ...typography.bodyLg,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionButtonReady: {
    backgroundColor: colors.primary,
  },
  actionButtonRecording: {
    backgroundColor: colors.errorContainer,
    borderColor: colors.error,
  },
  saveButtonActive: {
    backgroundColor: colors.primaryContainer,
  },
  actionButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
