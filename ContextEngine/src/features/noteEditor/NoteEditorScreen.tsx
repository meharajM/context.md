import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

export interface NoteEditorMetadataLine {
  label: string;
  value: string;
}

interface NoteEditorScreenProps {
  title: string;
  bodyLabel: string;
  value: string;
  topic: string;
  canEditTopic: boolean;
  canSave: boolean;
  metadataLines: NoteEditorMetadataLine[];
  onChangeValue: (value: string) => void;
  onChangeTopic?: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function NoteEditorScreen({
  title,
  bodyLabel,
  value,
  topic,
  canEditTopic,
  canSave,
  metadataLines,
  onChangeValue,
  onChangeTopic,
  onSave,
  onCancel,
}: NoteEditorScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="edit" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Make the note text and topic explicit before saving.</Text>
        </View>
      </View>

      <Card variant="default" style={styles.card}>
        <Text style={styles.sectionLabel}>Note</Text>
        <TextInput
          testID="note_editor_input"
          accessibilityLabel="Note editor"
          value={value}
          onChangeText={onChangeValue}
          multiline
          textAlignVertical="top"
          style={styles.noteInput}
          placeholder={bodyLabel}
          placeholderTextColor="rgba(66, 72, 75, 0.6)"
          autoCapitalize="sentences"
          autoCorrect
          spellCheck
        />
      </Card>

      <Card variant="default" style={styles.card}>
        <Text style={styles.sectionLabel}>Topic</Text>
        {canEditTopic ? (
          <TextInput
            testID="note_editor_topic"
            accessibilityLabel="Note topic"
            value={topic}
            onChangeText={nextTopic => onChangeTopic?.(nextTopic)}
            style={styles.topicInput}
            placeholder="Choose a topic"
            placeholderTextColor="rgba(66, 72, 75, 0.6)"
            autoCapitalize="words"
            autoCorrect={false}
            spellCheck={false}
          />
        ) : (
          <Text style={styles.topicValue}>{topic || 'Unassigned'}</Text>
        )}
      </Card>

      <Card variant="inset" style={styles.metadataCard}>
        <Text style={styles.sectionLabel}>Metadata</Text>
        <View style={styles.metadataList}>
          {metadataLines.map(line => (
            <View key={line.label} style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>{line.label}</Text>
              <Text style={styles.metadataValue}>{line.value}</Text>
            </View>
          ))}
          {metadataLines.length === 0 ? (
            <Text style={styles.metadataEmpty}>No additional metadata available.</Text>
          ) : null}
        </View>
      </Card>

      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" icon="chevronLeft" onPress={onCancel} style={styles.actionButton} />
        <Button
          label="Save"
          variant="primary"
          icon="check"
          onPress={onSave}
          disabled={!canSave}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  card: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
  },
  noteInput: {
    minHeight: 160,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    ...typography.bodyLg,
    color: colors.onSurface,
    lineHeight: 22,
  },
  topicInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  topicValue: {
    ...typography.bodyLg,
    color: colors.onSurface,
    minHeight: 24,
    paddingVertical: 4,
  },
  metadataCard: {
    gap: spacing.sm,
  },
  metadataList: {
    gap: spacing.sm,
  },
  metadataRow: {
    gap: 2,
  },
  metadataLabel: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  metadataValue: {
    ...typography.bodySm,
    color: colors.onSurface,
    lineHeight: 20,
  },
  metadataEmpty: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
