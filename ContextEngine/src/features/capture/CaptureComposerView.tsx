import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { Pill } from '../../shared/components/Pill';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { selectVoiceLabel } from './captureSelectors';
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
  const voiceLabel = selectVoiceLabel({ canRecord, isRecording });
  const canSave = canType && value.trim().length > 0;

  return (
    <Card variant="default" style={styles.composer}>
      <View style={styles.headerRow}>
        <View style={styles.headerLabelRow}>
          <View style={styles.editIcon}>
            <Icon name="edit" size={14} color={colors.primaryContainer} />
          </View>
          <View>
            <Text style={styles.title}>Quick capture</Text>
            <Text style={styles.helper}>
              {canType ? 'Type a thought, decision, or task.' : 'Manual capture is disabled in settings.'}
            </Text>
          </View>
        </View>
        <Pill label={voiceLabel} variant={canRecord ? 'installed' : 'progress'} />
      </View>

      <View style={[styles.inputShell, !canType ? styles.inputShellDisabled : null]}>
        <TextInput
          testID="thought_input"
          accessibilityLabel="Thought Input"
          style={styles.input}
          placeholder="What should the engine remember?"
          placeholderTextColor={colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeValue}
          editable={canType}
          multiline
        />

        <Pressable
          testID="record_button"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canRecord, selected: isRecording }}
          disabled={!canRecord}
          onPress={onRecordPress}
          style={({ pressed }) => [
            styles.micButton,
            isRecording ? styles.micButtonRecording : styles.micButtonReady,
            pressed && canRecord ? styles.micButtonPressed : null,
          ]}>
          <Icon name={isRecording ? 'stop' : 'mic'} size={16} color={isRecording ? colors.error : colors.surfaceContainerLowest} />
        </Pressable>
      </View>

      <View style={styles.footerRow}>
        <Button
          testID="save_button"
          label="Save"
          onPress={onSavePress}
          disabled={!canSave}
          variant="secondary"
          style={styles.saveButton}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  composer: {
    marginHorizontal: spacing.marginMobile,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderRadius: radius.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerLabelRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  editIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  helper: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    maxWidth: 230,
  },
  inputShell: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainerLow,
    paddingRight: 58,
    overflow: 'hidden',
  },
  inputShellDisabled: {
    backgroundColor: colors.surfaceContainerHighest,
    opacity: 0.85,
  },
  input: {
    minHeight: 84,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    ...typography.bodySm,
    color: colors.onSurface,
    textAlignVertical: 'top',
  },
  micButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  micButtonReady: {
    backgroundColor: colors.primaryContainer,
  },
  micButtonRecording: {
    backgroundColor: colors.errorContainer,
    borderColor: colors.error,
  },
  micButtonPressed: {
    opacity: 0.88,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  saveButton: {
    width: 110,
  },
});
