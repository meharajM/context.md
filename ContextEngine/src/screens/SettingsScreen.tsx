import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatModelSize, formatSectionPreview, palette as designPalette, type Palette } from '../ui/design';

type CaptureSettingSetter = (
  key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'liteRtEnabled',
  value: boolean,
) => void;

export function SettingsScreen({
  activeModel,
  audioReadiness,
  bootMessage,
  liteRtEnabled,
  manualCaptureEnabled,
  models,
  palette: paletteProp,
  contextPath,
  displayStatus,
  isRecording,
  pushToRecordEnabled,
  selectedModelDownloading,
  selectedModelError,
  selectedModelId,
  selectedModelInstalled,
  selectedModelProgress,
  setCaptureSetting,
  selectModel,
  downloadModel,
  removeModel,
  sections,
  wakeWordEnabled,
}: {
  activeModel: {
    id: string;
    name: string;
    description: string;
    sizeInBytes: number;
    minDeviceMemoryInGb: number;
    backend: string;
    recommended?: boolean;
  };
  audioReadiness: {
    transcriptionReady: boolean;
    wakeWordReady: boolean;
    missingModels: string[];
    errors: string[];
  };
  bootMessage: string;
  liteRtEnabled: boolean;
  manualCaptureEnabled: boolean;
  models: {
    id: string;
    name: string;
    description: string;
    sizeInBytes: number;
    minDeviceMemoryInGb: number;
    backend: string;
    installed: boolean;
    downloading: boolean;
    progress: number;
    error: string | null;
    recommended?: boolean;
  }[];
  palette?: Palette;
  contextPath: string;
  displayStatus: string;
  isRecording: boolean;
  pushToRecordEnabled: boolean;
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
  setCaptureSetting: CaptureSettingSetter;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  sections: { header: string; content: string }[];
  wakeWordEnabled: boolean;
}) {
  const palette = paletteProp ?? designPalette;

  return (
    <>
      <View style={styles.settingsIntroBlock}>
        <Text style={[styles.settingsEyebrow, { color: palette.accent }]}>SETTINGS</Text>
        <Text style={[styles.settingsTitle, { color: palette.text }]}>Everything operational lives here.</Text>
        <Text style={[styles.settingsSubtitle, { color: palette.muted }]}>
          Model choice, capture modes, diagnostics, and context review are grouped into inset sections.
        </Text>
      </View>

      <SettingsSection title="Runtime" palette={palette}>
        <RuntimeOverviewCard audioReadiness={audioReadiness} contextPath={contextPath} displayStatus={displayStatus} palette={palette} />
        <View style={styles.sectionDivider} />
        <View style={styles.settingsMiniRow}>
          <MiniStat label="Status" value={isRecording ? 'Recording' : displayStatus} palette={palette} tone={isRecording ? 'danger' : 'neutral'} />
          <MiniStat label="Boot" value={bootMessage} palette={palette} />
          <MiniStat label="Context" value={contextPath.split('/').pop() ?? 'context.md'} palette={palette} />
        </View>
      </SettingsSection>

      <SettingsSection title="Local model" palette={palette}>
        <ModelSummaryCard
          activeModel={activeModel}
          palette={palette}
          selectedModelDownloading={selectedModelDownloading}
          selectedModelError={selectedModelError}
          selectedModelId={selectedModelId}
          selectedModelInstalled={selectedModelInstalled}
          selectedModelProgress={selectedModelProgress}
          onSelect={selectModel}
          onInstallOrDelete={selectedModelInstalled ? removeModel : downloadModel}
        />
        <View style={styles.modelList}>
          {models.map(model => {
            const isSelected = selectedModelId === model.id;

            return (
              <View
                key={model.id}
                style={[
                  styles.modelListItem,
                  {
                    backgroundColor: isSelected ? palette.accentWash : palette.panel,
                    borderColor: isSelected ? palette.accent : palette.border,
                  },
                ]}>
                <TouchableOpacity style={styles.modelListMain} onPress={() => selectModel(model.id)}>
                  <View style={styles.modelListHeader}>
                    <Text style={[styles.modelListName, { color: palette.text }]}>{model.name}</Text>
                    <Text style={[styles.modelListStatus, { color: model.installed ? palette.accent : palette.muted }]}>
                      {model.installed ? 'Installed' : 'Missing'}
                    </Text>
                  </View>
                  <Text style={[styles.modelListMeta, { color: palette.muted }]}>
                    {formatModelSize(model.sizeInBytes)} · {model.minDeviceMemoryInGb} GB · {model.backend.toUpperCase()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  testID={`model_${model.id}_${model.installed ? 'delete' : 'install'}_button`}
                  style={[
                    styles.modelListAction,
                    {
                      backgroundColor: model.installed ? palette.panelAlt : palette.accent,
                      borderColor: model.installed ? palette.danger : palette.accent,
                    },
                  ]}
                  onPress={() => (model.installed ? removeModel(model.id) : downloadModel(model.id))}>
                  <Text style={[styles.modelListActionText, { color: model.installed ? palette.danger : palette.accentText }]}>
                    {model.installed ? 'Delete' : 'Install'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </SettingsSection>

      <SettingsSection title="Capture modes" palette={palette}>
        <CaptureModesCard
          audioReadiness={audioReadiness}
          liteRtEnabled={liteRtEnabled}
          manualCaptureEnabled={manualCaptureEnabled}
          palette={palette}
          pushToRecordEnabled={pushToRecordEnabled}
          setCaptureSetting={setCaptureSetting}
          wakeWordEnabled={wakeWordEnabled}
        />
      </SettingsSection>

      <SettingsSection title="Context review" palette={palette}>
        <ContextSnapshotList palette={palette} sections={sections} />
      </SettingsSection>
    </>
  );
}

function SettingsSection({
  title,
  palette,
  children,
}: {
  title: string;
  palette: Palette;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.sectionGroup, { backgroundColor: palette.panel, borderColor: palette.border }]}>
      <Text style={[styles.sectionTitle, { color: palette.muted }]}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function ModeTile({ label, value, onPress, palette, disabled = false }: ModeTileProps) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.modeTile,
        {
          backgroundColor: disabled ? palette.disabled : value ? palette.accentWash : palette.panelAlt,
          borderColor: disabled ? palette.border : value ? palette.accent : palette.border,
        },
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.modeLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.modeState, { color: disabled ? palette.muted : value ? palette.accent : palette.muted }]}>
        {disabled ? 'Unavailable' : value ? 'On' : 'Off'}
      </Text>
    </TouchableOpacity>
  );
}

function ModelSummaryCard({
  activeModel,
  palette,
  selectedModelDownloading,
  selectedModelError,
  selectedModelInstalled,
  selectedModelProgress,
  selectedModelId,
  onSelect,
  onInstallOrDelete,
}: {
  activeModel: {
    id: string;
    name: string;
    description: string;
    sizeInBytes: number;
    minDeviceMemoryInGb: number;
    backend: string;
    recommended?: boolean;
  };
  palette: Palette;
  selectedModelDownloading: boolean;
  selectedModelError: string | null;
  selectedModelInstalled: boolean;
  selectedModelProgress: number;
  selectedModelId: string;
  onSelect: (modelId: string) => void;
  onInstallOrDelete: (modelId: string) => void;
}) {
  return (
    <View style={[styles.modelCard, { borderColor: palette.border, backgroundColor: palette.panelAlt }]}>
      <View style={styles.modelCardHeader}>
        <View style={styles.modelCardTitleBlock}>
          <Text style={[styles.modelCardTitle, { color: palette.text }]}>{activeModel.name}</Text>
          <Text style={[styles.modelCardSubtitle, { color: palette.muted }]}>{activeModel.description}</Text>
        </View>
        <View
          style={[
            styles.modelBadge,
            {
              borderColor: activeModel.recommended ? palette.accent : palette.border,
              backgroundColor: activeModel.recommended ? palette.accentWash : palette.panel,
            },
          ]}>
          <Text style={[styles.modelBadgeText, { color: activeModel.recommended ? palette.accent : palette.muted }]}>
            {activeModel.recommended ? 'Recommended' : 'Option'}
          </Text>
        </View>
      </View>
      <View style={styles.modelMetaRow}>
        <Text style={[styles.modelMeta, { color: palette.muted }]}>{formatModelSize(activeModel.sizeInBytes)}</Text>
        <Text style={[styles.modelMeta, { color: palette.muted }]}>{activeModel.minDeviceMemoryInGb} GB min</Text>
        <Text style={[styles.modelMeta, { color: palette.muted }]}>{activeModel.backend.toUpperCase()}</Text>
      </View>
      <Text style={[styles.modelStatusLine, { color: selectedModelError ? palette.danger : palette.muted }]}>
        {selectedModelError
          ? selectedModelError
          : selectedModelDownloading
            ? `Downloading ${selectedModelProgress}%`
            : selectedModelInstalled
              ? 'Ready on device'
              : 'Not downloaded'}
      </Text>
      <View style={styles.modelActionRow}>
        <TouchableOpacity
          testID="model_select_button"
          accessibilityRole="button"
          style={[
            styles.secondaryButton,
            {
              backgroundColor: selectedModelId === activeModel.id ? palette.accentWash : palette.panel,
              borderColor: palette.border,
            },
          ]}
          onPress={() => onSelect(activeModel.id)}>
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
            {selectedModelId === activeModel.id ? 'Selected' : 'Use model'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={selectedModelInstalled ? 'model_delete_button' : 'model_install_button'}
          accessibilityRole="button"
          style={[
            styles.actionButton,
            {
              backgroundColor: selectedModelDownloading
                ? palette.disabled
                : selectedModelInstalled
                  ? palette.panelAlt
                  : palette.accent,
            },
          ]}
          onPress={() => onInstallOrDelete(activeModel.id)}
          disabled={selectedModelDownloading}>
          <Text style={[styles.actionButtonText, { color: selectedModelInstalled ? palette.danger : palette.accentText }]}>
            {selectedModelDownloading
              ? `Downloading ${selectedModelProgress}%`
              : selectedModelInstalled
                ? 'Delete'
                : 'Install'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CaptureModesCard({
  audioReadiness,
  liteRtEnabled,
  manualCaptureEnabled,
  palette,
  pushToRecordEnabled,
  setCaptureSetting,
  wakeWordEnabled,
}: {
  audioReadiness: {
    transcriptionReady: boolean;
    wakeWordReady: boolean;
    missingModels: string[];
    errors: string[];
  };
  liteRtEnabled: boolean;
  manualCaptureEnabled: boolean;
  palette: Palette;
  pushToRecordEnabled: boolean;
  setCaptureSetting: CaptureSettingSetter;
  wakeWordEnabled: boolean;
}) {
  return (
    <View style={styles.capturePanel}>
      <View style={styles.modeGrid}>
        <ModeTile
          label="Manual"
          value={manualCaptureEnabled}
          onPress={() => setCaptureSetting('manualCaptureEnabled', !manualCaptureEnabled)}
          palette={palette}
        />
        <ModeTile
          label="Record"
          value={pushToRecordEnabled}
          onPress={() => setCaptureSetting('pushToRecordEnabled', !pushToRecordEnabled)}
          palette={palette}
          disabled={!audioReadiness.transcriptionReady}
        />
        <ModeTile
          label="Wake word"
          value={wakeWordEnabled}
          onPress={() => setCaptureSetting('wakeWordEnabled', !wakeWordEnabled)}
          palette={palette}
          disabled={!audioReadiness.wakeWordReady}
        />
        <ModeTile
          label="LiteRT"
          value={liteRtEnabled}
          onPress={() => setCaptureSetting('liteRtEnabled', !liteRtEnabled)}
          palette={palette}
        />
      </View>
      <Text style={[styles.helperText, { color: palette.muted }]}>
        If synthesis is unavailable, captured thoughts are kept in Inbox.
      </Text>
      {!audioReadiness.transcriptionReady ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Record stays disabled until `whisper-tiny.en.bin` is bundled for this platform.
        </Text>
      ) : null}
      {!audioReadiness.wakeWordReady ? (
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Wake word is foreground-only and remains off until a keyword-spotter model is bundled.
        </Text>
      ) : null}
    </View>
  );
}

function MiniStat({
  label,
  value,
  palette,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  palette: Palette;
  tone?: 'neutral' | 'accent' | 'danger';
}) {
  const color = tone === 'accent' ? palette.accent : tone === 'danger' ? palette.danger : palette.text;

  return (
    <View style={[styles.miniStat, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.miniStatLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.miniStatValue, { color }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function RuntimeOverviewCard({
  audioReadiness,
  contextPath,
  displayStatus,
  palette,
}: {
  audioReadiness: {
    transcriptionReady: boolean;
    wakeWordReady: boolean;
    missingModels: string[];
    errors: string[];
  };
  contextPath: string;
  displayStatus: string;
  palette: Palette;
}) {
  return (
    <View style={styles.runtimePanel}>
      <View style={styles.runtimeGrid}>
        <MiniStat label="Status" value={displayStatus} palette={palette} />
        <MiniStat label="Context file" value={contextPath} palette={palette} />
        <MiniStat
          label="Transcription"
          value={audioReadiness.transcriptionReady ? 'Ready' : 'Unavailable'}
          palette={palette}
          tone={audioReadiness.transcriptionReady ? 'accent' : 'danger'}
        />
        <MiniStat
          label="Wake word"
          value={audioReadiness.wakeWordReady ? 'Ready' : 'Unavailable'}
          palette={palette}
          tone={audioReadiness.wakeWordReady ? 'accent' : 'danger'}
        />
      </View>
      {audioReadiness.missingModels.length > 0 ? (
        <Text style={[styles.runtimeNote, { color: palette.muted }]}>
          Missing models: {audioReadiness.missingModels.join(', ')}
        </Text>
      ) : null}
      {audioReadiness.errors.length > 0 ? (
        <Text style={[styles.runtimeNote, { color: palette.danger }]}>{audioReadiness.errors.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

function ContextSnapshotList({
  palette,
  sections,
}: {
  palette: Palette;
  sections: { header: string; content: string }[];
}) {
  if (sections.length === 0) {
    return (
      <View style={[styles.emptyState, { backgroundColor: palette.panel, borderColor: palette.border }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>No topics yet</Text>
        <Text style={[styles.emptyText, { color: palette.muted }]}>Capture something and the topic list will appear here.</Text>
      </View>
    );
  }

  return (
    <>
      {sections.map((section, index) => (
        <View
          key={`${section.header}-${index}`}
          testID={`topic_${index}`}
          style={[styles.topicCard, { backgroundColor: palette.panel, borderColor: palette.border }]}>
          <View style={styles.topicCardHeader}>
            <Text style={[styles.topicLabel, { color: palette.accent }]}>{section.header}</Text>
            <Text style={[styles.topicMeta, { color: palette.muted }]}>Review</Text>
          </View>
          <Text style={[styles.topicPreview, { color: palette.text }]} numberOfLines={3}>
            {formatSectionPreview(section.content)}
          </Text>
          <Text style={[styles.topicFooter, { color: palette.muted }]}>From the local context file</Text>
        </View>
      ))}
    </>
  );
}

interface ModeTileProps {
  label: string;
  value: boolean;
  onPress: () => void;
  disabled?: boolean;
  palette: Palette;
}

const styles = StyleSheet.create({
  settingsIntroBlock: {
    gap: 8,
    marginBottom: 16,
  },
  settingsEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  settingsTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  settingsSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionGroup: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionContent: {
    gap: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  settingsMiniRow: {
    flexDirection: 'row',
    gap: 8,
  },
  runtimePanel: {
    gap: 10,
  },
  capturePanel: {
    gap: 10,
  },
  modelCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  modelCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modelCardTitleBlock: {
    flex: 1,
    gap: 4,
  },
  modelCardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  modelCardSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  modelBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  modelBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modelStateChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modelMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  modelMeta: {
    fontSize: 11,
    fontWeight: '700',
  },
  modelStatusLine: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  modelActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  actionButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  modelList: {
    gap: 8,
    marginTop: 12,
  },
  modelListItem: {
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  modelListMain: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modelListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modelListName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  modelListStatus: {
    fontSize: 11,
    fontWeight: '800',
  },
  modelListMeta: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
  },
  modelListAction: {
    minWidth: 84,
    borderLeftWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modelListActionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeTile: {
    width: '48.8%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  modeState: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
  },
  helperText: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(120, 113, 108, 0.28)',
    marginTop: 12,
    paddingTop: 10,
    fontSize: 12,
    lineHeight: 17,
  },
  miniStat: {
    flex: 1,
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  miniStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  miniStatValue: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  runtimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  runtimeNote: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  topicCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  topicCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  topicLabel: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  topicPreview: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  topicMeta: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  topicFooter: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
});
