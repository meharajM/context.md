import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { CaptureComposerViewProps } from './captureTypes';
import { selectVoiceLabel } from './captureSelectors';
import { RecordingIndicator } from './RecordingIndicator';

export function CaptureComposerView({
  value,
  canType,
  canRecord,
  recordingState,
  onChangeValue,
  onRecordPress,
  onSavePress,
}: CaptureComposerViewProps) {
  const hasText = value.trim().length > 0;
  const canSave = canType && hasText;
  const voiceLabel = selectVoiceLabel({ canRecord, recordingState });
  const isBusy = recordingState === 'starting' || recordingState === 'stopping' || recordingState === 'transcribing';

  return (
    <View style={styles.stack}>
      <RecordingIndicator recordingState={recordingState} />

      <View style={[styles.composerPill, !canType ? styles.composerDisabled : null]}>
        <View style={styles.editIcon}>
          <Icon name="edit" size={16} color={colors.onSurfaceVariant} />
        </View>

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
            accessibilityLabel={voiceLabel}
            accessibilityState={{ disabled: !canRecord || isBusy, selected: recordingState === 'recording' }}
            disabled={!canRecord || isBusy}
            onPress={onRecordPress}
            style={({ pressed }) => [
              styles.actionButton,
              recordingState === 'recording'
                ? styles.actionButtonRecording
                : recordingState === 'starting'
                  ? styles.actionButtonStarting
                  : recordingState === 'stopping' || recordingState === 'transcribing'
                    ? styles.actionButtonStopping
                    : recordingState === 'error'
                      ? styles.actionButtonError
                      : styles.actionButtonReady,
              pressed && canRecord && !isBusy ? styles.actionButtonPressed : null,
            ]}>
            <Icon
              name={
                recordingState === 'recording'
                  ? 'stop'
                  : recordingState === 'starting' || recordingState === 'stopping' || recordingState === 'transcribing'
                    ? 'clock'
                    : 'mic'
              }
              size={18}
              color={
                recordingState === 'recording'
                  ? colors.error
                  : recordingState === 'starting'
                    ? colors.primaryContainer
                    : recordingState === 'stopping' || recordingState === 'transcribing'
                      ? colors.onSurfaceVariant
                      : recordingState === 'error'
                        ? colors.error
                        : colors.surfaceContainerLowest
              }
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xs,
    paddingHorizontal: spacing.marginMobile,
  },
  composerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
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
  actionButtonStarting: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  actionButtonStopping: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.outlineVariant,
  },
  actionButtonError: {
    backgroundColor: colors.surfaceContainerHigh,
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
