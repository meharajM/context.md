import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
  availableTopics: string[];
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
  availableTopics,
  canEditTopic,
  canSave,
  metadataLines,
  onChangeValue,
  onChangeTopic,
  onSave,
  onCancel,
}: NoteEditorScreenProps) {
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isTopicPickerOpen, setIsTopicPickerOpen] = useState(false);
  const [topicQuery, setTopicQuery] = useState('');

  const filteredTopics = useMemo(() => {
    const base = availableTopics.filter(Boolean);
    const query = topicQuery.trim().toLowerCase();
    if (!query) {
      return base;
    }

    return base.filter(entry => entry.toLowerCase().includes(query));
  }, [availableTopics, topicQuery]);

  const openTopicPicker = () => {
    if (canEditTopic) {
      setTopicQuery(topic);
      setIsTopicPickerOpen(true);
    }
  };

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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Topic</Text>
          <Button
            label="Browse"
            variant="ghost"
            icon="queue"
            onPress={openTopicPicker}
            disabled={!canEditTopic || availableTopics.length === 0}
            style={styles.inlineButton}
          />
        </View>
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

      <View style={styles.actionsRow}>
        <Button label="Metadata" variant="secondary" icon="more" onPress={() => setIsMetadataOpen(true)} style={styles.actionButton} />
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

      <Modal visible={isMetadataOpen} transparent animationType="fade" onRequestClose={() => setIsMetadataOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsMetadataOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Metadata</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsMetadataOpen(false)} hitSlop={8}>
                <Icon name="chevronLeft" size={18} color={colors.primary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {metadataLines.length > 0 ? (
                metadataLines.map(line => (
                  <View key={line.label} style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>{line.label}</Text>
                    <Text style={styles.metadataValue}>{line.value}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.metadataEmpty}>No additional metadata available.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isTopicPickerOpen} transparent animationType="fade" onRequestClose={() => setIsTopicPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsTopicPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select topic</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsTopicPickerOpen(false)} hitSlop={8}>
                <Icon name="chevronLeft" size={18} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Icon name="document" size={16} color={colors.onSurfaceVariant} />
              <TextInput
                value={topicQuery}
                onChangeText={setTopicQuery}
                placeholder="Search topics"
                placeholderTextColor="rgba(66, 72, 75, 0.6)"
                style={styles.searchInput}
                autoCapitalize="words"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {filteredTopics.length > 0 ? (
                filteredTopics.map(entry => (
                  <Pressable
                    key={entry}
                    accessibilityRole="button"
                    onPress={() => {
                      onChangeTopic?.(entry);
                      setTopicQuery(entry);
                      setIsTopicPickerOpen(false);
                    }}
                    style={({ pressed }) => [styles.topicOption, pressed ? styles.topicOptionPressed : null]}>
                    <Text style={styles.topicOptionText}>{entry}</Text>
                    <Icon name="chevronRight" size={16} color={colors.onSurfaceVariant} />
                  </Pressable>
                ))
              ) : (
                <Text style={styles.metadataEmpty}>No matching topics.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  inlineButton: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 20, 0.45)',
    padding: spacing.lg,
    justifyContent: 'center',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  modalBody: {
    flexGrow: 0,
  },
  modalBodyContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  metadataRow: {
    gap: 2,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceContainerLowest,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    ...typography.bodySm,
    color: colors.onSurface,
  },
  topicOption: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLowest,
  },
  topicOptionPressed: {
    opacity: 0.86,
  },
  topicOptionText: {
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '600',
  },
});
