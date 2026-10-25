import React, { useEffect, useRef } from 'react';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { CaptureComposerViewProps } from './captureTypes';
import { selectVoiceLabel } from './captureSelectors';
import { RecordingIndicator } from './RecordingIndicator';

export function refocusInputForQuickCapture(input: { blur: () => void; focus: () => void }) {
  input.blur();
  return setTimeout(() => input.focus(), 100);
}

export function CaptureComposerView({
  focusRequest = 0,
  keyboardDismissRequest = 0,
  value,
  canType,
  canRecord,
  recordingState,
  recordingMessage = '',
  onChangeValue,
  onRecordPress,
  onSavePress,
}: CaptureComposerViewProps) {
  const inputRef = useRef<TextInput>(null);
  const hasText = value.trim().length > 0;
  const canSave = canType && hasText;
  const voiceLabel = selectVoiceLabel({ canRecord, recordingState });
  const isBusy = recordingState === 'starting' || recordingState === 'stopping' || recordingState === 'transcribing';
  const recordDisabled = isBusy || (!canRecord && recordingState !== 'recording');

  useEffect(() => {
    if (focusRequest <= 0 || !inputRef.current) return;
    // Android can retain focus while hiding the keyboard when returning from the home screen.
    const focusTimer = refocusInputForQuickCapture(inputRef.current);
    return () => clearTimeout(focusTimer);
  }, [focusRequest]);

  useEffect(() => {
    if (keyboardDismissRequest > 0) inputRef.current?.blur();
  }, [keyboardDismissRequest]);

  return (
    <View style={styles.stack}>
      {RELEASE_CAPABILITIES.voiceCapture && (
        <RecordingIndicator recordingState={recordingState} message={recordingMessage} />
      )}

      <View style={[styles.composerPill, !canType ? styles.composerDisabled : null]}>
        <View style={styles.editIcon}>
          <Icon name="edit" size={16} color={colors.onSurfaceVariant} />
        </View>

        <TextInput
          ref={inputRef}
          testID="thought_input"
          accessibilityLabel="Note input"
          style={styles.input}
          placeholder={canType ? (RELEASE_CAPABILITIES.voiceCapture ? 'Type a note or tap to record' : 'Type a note') : 'Note entry is off in Settings'}
          placeholderTextColor={colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeValue}
          editable={canType}
          multiline={false}
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="sentences"
          textContentType="none"
          blurOnSubmit={true}
          returnKeyType="done"
          onSubmitEditing={onSavePress}
        />

        {hasText ? (
          <Pressable
            testID="save_button"
            accessibilityLabel="Save note"
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
        ) : null}

        {RELEASE_CAPABILITIES.voiceCapture && (!hasText || recordingState === 'recording') ? (
          <Pressable
            testID="record_button"
            accessibilityRole="button"
            accessibilityLabel={voiceLabel}
            accessibilityState={{ disabled: recordDisabled, selected: recordingState === 'recording' }}
            disabled={recordDisabled}
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
              pressed && !recordDisabled ? styles.actionButtonPressed : null,
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
        ) : null}
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
    width: 48,
    height: 48,
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
