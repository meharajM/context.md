import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../shared/components/Button';
import { Card } from '../shared/components/Card';
import { Pill } from '../shared/components/Pill';
import { Icon } from '../shared/components/Icon';
import { colors } from '../shared/design/colors';
import { radius } from '../shared/design/radius';
import { spacing } from '../shared/design/spacing';
import { typography } from '../shared/design/typography';

export function CaptureComposer({
  isRecording,
  manualCaptureEnabled,
  newThought,
  onChangeThought,
  onRecordPress,
  onSavePress,
  pushToRecordEnabled,
}: {
  isRecording: boolean;
  manualCaptureEnabled: boolean;
  newThought: string;
  onChangeThought: (value: string) => void;
  onRecordPress: () => void;
  onSavePress: () => void;
  pushToRecordEnabled: boolean;
}) {
  const canSave = manualCaptureEnabled && newThought.trim().length > 0;
  const voiceLabel = pushToRecordEnabled ? (isRecording ? 'Listening' : 'Voice ready') : 'Voice off';

  return (
    <Card variant="default" style={styles.composer}>
      <View style={styles.composerHeader}>
        <View style={styles.composerTitleBlock}>
          <View style={styles.titleRow}>
            <Icon name="edit" size={14} color={colors.primaryContainer} />
            <Text style={styles.composerLabel}>Quick capture</Text>
          </View>
          <Text style={styles.composerHelper}>
            {manualCaptureEnabled ? 'Type a thought, decision, or task.' : 'Manual capture is disabled in settings.'}
          </Text>
        </View>
        <Pill label={voiceLabel} variant={pushToRecordEnabled ? 'installed' : 'progress'} />
      </View>

      <View style={[styles.inputShell, !manualCaptureEnabled ? styles.inputShellDisabled : null]}>
        <TextInput
          testID="thought_input"
          accessibilityLabel="Thought Input"
          style={styles.input}
          placeholder="What should the engine remember?"
          placeholderTextColor={colors.onSurfaceVariant}
          value={newThought}
          onChangeText={onChangeThought}
          editable={manualCaptureEnabled}
          multiline
        />
      </View>

      <View style={styles.buttonRow}>
        <Button
          testID="record_button"
          label={isRecording ? 'Stop' : 'Record'}
          icon={isRecording ? 'stop' : 'mic'}
          onPress={onRecordPress}
          disabled={!pushToRecordEnabled}
          variant={isRecording ? 'secondary' : 'primary'}
          style={styles.flexButton}
        />
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
  composerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  composerTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  composerLabel: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  composerHelper: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  inputShell: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainerLow,
  },
  inputShellDisabled: {
    backgroundColor: colors.surfaceContainerHighest,
    opacity: 0.85,
  },
  input: {
    minHeight: 82,
    padding: spacing.md,
    ...typography.bodySm,
    color: colors.onSurface,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  saveButton: {
    width: 110,
  },
});
