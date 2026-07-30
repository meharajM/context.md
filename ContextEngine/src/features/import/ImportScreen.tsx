import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppStore } from '../../core/store';
import type { ImportPreview } from '../../core/importTypes';
import { QA_SAMPLE_WAV } from '../../shared/audio/sampleAudio';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { Pill } from '../../shared/components/Pill';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { ALLOWED_VOICE_IMPORT_LABEL, describeVoiceImportSource } from '../../shared/utils/voiceImport';
import { pickVoiceFile, VOICE_FILE_PICKER_CANCELLED } from '../../shared/utils/voiceFilePicker';

type SourceMode = 'text' | 'voice';

const getTopicFileName = (topic: string) => topic.trim().replace(/\s+/g, ' ').trim();

const topicMatches = (topic: string, query: string) => topic.toLowerCase().includes(query.toLowerCase());

export function ImportScreen() {
  const sections = useAppStore(state => state.sections);
  const status = useAppStore(state => state.status);
  const queueSize = useAppStore(state => state.queueSize);
  const queueBlockedReason = useAppStore(state => state.queueBlockedReason);
  const analyzeImportDraft = useAppStore(state => state.analyzeImportDraft);
  const queueImportedThought = useAppStore(state => state.queueImportedThought);

  const [sourceMode, setSourceMode] = useState<SourceMode>('text');
  const [textValue, setTextValue] = useState('');
  const [voiceFile, setVoiceFile] = useState<string | number | null>(null);
  const [voiceLabel, setVoiceLabel] = useState('No voice file selected');
  const [topicValue, setTopicValue] = useState('');
  const [topicQuery, setTopicQuery] = useState('');
  const [isTopicPickerOpen, setIsTopicPickerOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTopics = useMemo(
    () =>
      sections
        .map(section => getTopicFileName(section.header))
        .filter(header => header.length > 0 && header.trim().toLowerCase() !== 'inbox'),
    [sections],
  );

  const filteredTopics = useMemo(() => {
    const query = topicQuery.trim();
    const base = availableTopics.filter(Boolean);
    if (!query) {
      return base;
    }

    return base.filter(topic => topicMatches(topic, query));
  }, [availableTopics, topicQuery]);

  const resetPreview = () => {
    setPreview(null);
    setError(null);
  };

  const openTopicPicker = () => {
    if (availableTopics.length === 0) {
      return;
    }

    setTopicQuery(topicValue);
    setIsTopicPickerOpen(true);
  };

  const handlePickVoiceFile = async () => {
    setError(null);

    try {
      const selection = await pickVoiceFile();
      setVoiceFile(selection.path);
      setVoiceLabel(selection.name?.trim() || describeVoiceImportSource(selection.path));
      setSourceMode('voice');
      resetPreview();
    } catch (voiceFileError) {
      const message = voiceFileError instanceof Error ? voiceFileError.message : String(voiceFileError);
      if ((voiceFileError as { code?: string })?.code === VOICE_FILE_PICKER_CANCELLED) {
        return;
      }

      setError(message);
    }
  };

  const handleUseSampleVoice = () => {
    setSourceMode('voice');
    setVoiceFile(QA_SAMPLE_WAV);
    setVoiceLabel(describeVoiceImportSource(QA_SAMPLE_WAV));
    resetPreview();
  };

  const handleAnalyze = async () => {
    setIsBusy(true);
    setError(null);

    try {
      const nextPreview = await analyzeImportDraft(
        sourceMode === 'voice'
          ? {
              sourceKind: 'voice',
              voiceFile,
              selectedTopic: topicValue,
            }
          : {
              sourceKind: 'text',
              text: textValue,
              selectedTopic: topicValue,
            },
      );
      setPreview(nextPreview);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : String(importError);
      setPreview(null);
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleImport = async (approvedTopic?: string | null) => {
    if (!preview) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      await queueImportedThought(preview, { approvedTopic });
      setPreview(null);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : String(importError);
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroRow}>
        <View style={styles.heroIcon}>
          <Icon name="document" size={20} color={colors.primary} />
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.heroTopLine}>
            <Text style={styles.title}>Import</Text>
            <Pill label="Local only" variant="local" />
          </View>
          <Text style={styles.subtitle}>
            Paste text or import a voice file, then choose whether the result should land in a new topic or merge into an existing thread.
          </Text>
        </View>
      </View>

      <Card variant="wash" style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.statusValue}>{status || 'Ready to import a local note.'}</Text>
        {queueBlockedReason ? <Text style={styles.statusDetail}>{queueBlockedReason}</Text> : null}
        {queueSize > 0 ? <Text style={styles.statusDetail}>{queueSize} thought{queueSize === 1 ? '' : 's'} in the queue.</Text> : null}
      </Card>

      <Card variant="default" style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Source</Text>
          <View style={styles.modeButtons}>
            <Button
              testID="import_source_text_button"
              label="Text"
              variant={sourceMode === 'text' ? 'primary' : 'secondary'}
              icon="edit"
              onPress={() => {
                setSourceMode('text');
                resetPreview();
              }}
              style={styles.modeButton}
            />
            <Button
              testID="import_source_voice_button"
              label="Voice"
              variant={sourceMode === 'voice' ? 'primary' : 'secondary'}
              icon="mic"
              onPress={() => {
                setSourceMode('voice');
                resetPreview();
              }}
              style={styles.modeButton}
            />
          </View>
        </View>

        {sourceMode === 'text' ? (
          <TextInput
            testID="import_text_input"
            accessibilityLabel="Import text"
            value={textValue}
            onChangeText={value => {
              setTextValue(value);
              resetPreview();
            }}
            multiline
            textAlignVertical="top"
            style={styles.multiLineInput}
            placeholder="Paste a thought, meeting note, or idea"
            placeholderTextColor="rgba(66, 72, 75, 0.6)"
            autoCapitalize="sentences"
            autoCorrect
            spellCheck
          />
        ) : (
          <View style={styles.voiceBlock}>
            <Text style={styles.voiceLabel}>Voice file</Text>
            <Text style={styles.voiceValue} numberOfLines={2}>
              {voiceLabel}
            </Text>
            <Text style={styles.voiceHelp}>
              Supported formats: {ALLOWED_VOICE_IMPORT_LABEL}. Use the picker for a local file, or tap the sample clip for simulator QA.
            </Text>
            <View style={styles.voiceActions}>
              <Button
                testID="import_voice_pick_button"
                label="Pick file"
                variant="secondary"
                icon="document"
                onPress={() => {
                  handlePickVoiceFile().catch(pickError => {
                    console.error('Failed to pick voice file:', pickError);
                  });
                }}
                style={styles.voiceAction}
              />
              <Button
                testID="import_voice_sample_button"
                label="Use sample"
                variant="secondary"
                icon="spark"
                onPress={handleUseSampleVoice}
                style={styles.voiceAction}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setVoiceFile(null);
                setVoiceLabel('No voice file selected');
                resetPreview();
              }}
              hitSlop={8}>
              <Text style={styles.inlineAction}>Clear selection</Text>
            </Pressable>
          </View>
        )}
      </Card>

      <Card variant="default" style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Topic</Text>
          <Button
            testID="import_topic_browse_button"
            label="Browse"
            variant="ghost"
            icon="queue"
            onPress={openTopicPicker}
            disabled={availableTopics.length === 0}
            style={styles.inlineButton}
          />
        </View>
        <TextInput
          testID="import_topic_input"
          accessibilityLabel="Import topic"
          value={topicValue}
          onChangeText={value => {
            setTopicValue(value);
            resetPreview();
          }}
          style={styles.topicInput}
          placeholder="Choose or create a topic"
          placeholderTextColor="rgba(66, 72, 75, 0.6)"
          autoCapitalize="words"
          autoCorrect={false}
          spellCheck={false}
        />
        <Text style={styles.helperText}>
          Leave the topic blank to let synthesis decide, or type a new topic name to create a fresh thread.
        </Text>
      </Card>

      <Card variant="default" style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Preview</Text>
          {preview ? <Pill label={preview.source === 'raw-fallback' ? 'Fallback' : 'Ready'} variant={preview.source === 'raw-fallback' ? 'progress' : 'installed'} /> : null}
        </View>

        {preview ? (
          <View style={styles.previewBody}>
            <View style={styles.previewField}>
              <Text style={styles.previewLabel}>Transcript</Text>
              <Text style={styles.previewValue}>{preview.transcript}</Text>
            </View>
            <View style={styles.previewField}>
              <Text style={styles.previewLabel}>Topic</Text>
              <Text style={styles.previewValue}>
                {preview.selectedTopic ? preview.selectedTopic : preview.suggestedTopic}
              </Text>
              {preview.mergeCandidate ? (
                <Text style={styles.previewHint}>This matches an existing topic. Approve the merge to continue.</Text>
              ) : null}
              {preview.source === 'raw-fallback' ? (
                <Text style={styles.previewHint}>Synthesis fell back locally. The note will still persist.</Text>
              ) : null}
            </View>
            {preview.tags.length > 0 ? (
              <View style={styles.previewField}>
                <Text style={styles.previewLabel}>Tags</Text>
                <Text style={styles.previewValue}>{preview.tags.join(', ')}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.helperText}>
            Analyze the source first to see the target topic and confirm any merge.
          </Text>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {preview?.requiresApproval ? (
          <View style={styles.previewActions}>
            <Button
              testID="import_approve_button"
              label={`Approve merge into ${preview.suggestedTopic}`}
              variant="primary"
              icon="check"
              onPress={() => {
                handleImport(preview.suggestedTopic).catch(importError => {
                  console.error('Failed to approve merge import:', importError);
                });
              }}
              disabled={isBusy}
              style={styles.previewAction}
            />
            <Button
              label="Choose another topic"
              variant="secondary"
              icon="queue"
              onPress={openTopicPicker}
              disabled={isBusy}
              style={styles.previewAction}
            />
          </View>
        ) : preview ? (
          <View style={styles.previewActions}>
            <Button
              testID="import_analyze_button"
              label="Re-analyze"
              variant="secondary"
              icon="spark"
              onPress={() => {
                handleAnalyze().catch(analyzeError => {
                  console.error('Failed to analyze import draft:', analyzeError);
                });
              }}
              disabled={isBusy || (sourceMode === 'text' ? textValue.trim().length === 0 : voiceFile == null)}
              style={styles.previewAction}
            />
            <Button
              testID="import_submit_button"
              label="Import"
              variant="primary"
              icon="check"
              onPress={() => {
                handleImport().catch(importError => {
                  console.error('Failed to queue import:', importError);
                });
              }}
              disabled={isBusy || (sourceMode === 'text' ? textValue.trim().length === 0 : voiceFile == null)}
              style={styles.previewAction}
            />
          </View>
        ) : (
          <View style={styles.previewActions}>
            <Button
              testID="import_analyze_button"
              label="Analyze"
              variant="secondary"
              icon="spark"
              onPress={() => {
                handleAnalyze().catch(analyzeError => {
                  console.error('Failed to analyze import draft:', analyzeError);
                });
              }}
              disabled={isBusy || (sourceMode === 'text' ? textValue.trim().length === 0 : voiceFile == null)}
              style={styles.previewAction}
            />
          </View>
        )}
      </Card>

      <Card variant="inset" style={styles.card}>
        <Text style={styles.sectionLabel}>Workflow</Text>
        <Text style={styles.helperText}>
          Text and voice imports are queued for local synthesis first. If the model is unavailable, the note still persists instead of disappearing.
        </Text>
      </Card>

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
                testID="import_topic_search_input"
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
                      setTopicValue(entry);
                      setTopicQuery(entry);
                      setIsTopicPickerOpen(false);
                      resetPreview();
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
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
  statusCard: {
    gap: spacing.xs,
  },
  statusLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
  },
  statusValue: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '600',
  },
  statusDetail: {
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
  modeButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  modeButton: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  multiLineInput: {
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
  voiceBlock: {
    gap: spacing.sm,
  },
  voiceLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
  },
  voiceValue: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '600',
  },
  voiceHelp: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  voiceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  voiceAction: {
    flex: 1,
  },
  inlineAction: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
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
  inlineButton: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  helperText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  previewBody: {
    gap: spacing.md,
  },
  previewField: {
    gap: 4,
  },
  previewLabel: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  previewValue: {
    ...typography.bodySm,
    color: colors.onSurface,
    lineHeight: 20,
  },
  previewHint: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewAction: {
    flex: 1,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    lineHeight: 20,
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
  modalBody: {
    flexGrow: 0,
  },
  modalBodyContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
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
  metadataEmpty: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
});
