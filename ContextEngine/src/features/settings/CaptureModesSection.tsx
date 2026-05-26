import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { SwitchRow } from '../../shared/components/SwitchRow';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

interface AudioReadiness {
  transcriptionReady: boolean;
  wakeWordReady: boolean;
  missingModels: string[];
  errors: string[];
}

interface CaptureModesSectionProps {
  audioReadiness: AudioReadiness;
  liteRtEnabled: boolean;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  wakeWordEnabled: boolean;
  setCaptureSetting: (
    key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'liteRtEnabled',
    value: boolean,
  ) => void;
}

export function CaptureModesSection({
  audioReadiness,
  liteRtEnabled,
  manualCaptureEnabled,
  pushToRecordEnabled,
  wakeWordEnabled,
  setCaptureSetting,
}: CaptureModesSectionProps) {
  return (
    <View style={styles.container}>
      <SectionHeader title="Capture modes" />
      <Card variant="inset" style={styles.card}>
        <SwitchRow
          label="Manual Capture"
          description="Type thoughts manually via keyboard"
          value={manualCaptureEnabled}
          onValueChange={val => setCaptureSetting('manualCaptureEnabled', val)}
          testID="switch_manual"
        />
        <View style={styles.separator} />
        <SwitchRow
          label="Push to Record"
          description="Hold or tap to capture audio notes"
          value={pushToRecordEnabled}
          onValueChange={val => setCaptureSetting('pushToRecordEnabled', val)}
          disabled={!audioReadiness.transcriptionReady}
          testID="switch_record"
        />
        <View style={styles.separator} />
        <SwitchRow
          label="Wake Word Detect"
          description="Trigger listening with wake phrase"
          value={wakeWordEnabled}
          onValueChange={val => setCaptureSetting('wakeWordEnabled', val)}
          disabled={!audioReadiness.wakeWordReady}
          testID="switch_wakeword"
        />
        <View style={styles.separator} />
        <SwitchRow
          label="LiteRT Synthesis"
          description="Generate topic summaries locally"
          value={liteRtEnabled}
          onValueChange={val => setCaptureSetting('liteRtEnabled', val)}
          testID="switch_litert"
        />

        <Text style={styles.helperText}>
          If synthesis is unavailable, captured thoughts are kept in Inbox.
        </Text>
        
        {!audioReadiness.transcriptionReady && (
          <Text style={styles.warningText}>
            Record stays disabled until `whisper-tiny.en.bin` is bundled for this platform.
          </Text>
        )}
        
        {!audioReadiness.wakeWordReady && (
          <Text style={styles.warningText}>
            Wake word is foreground-only and remains off until a keyword-spotter model is bundled.
          </Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.surfaceContainer,
  },
  helperText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
    marginTop: spacing.xs,
  },
  warningText: {
    ...typography.caption,
    color: colors.error,
    paddingBottom: spacing.sm,
  },
});
