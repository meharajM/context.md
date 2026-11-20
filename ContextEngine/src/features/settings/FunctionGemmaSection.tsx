import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { formatModelSize } from '../../ui/design';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

interface FunctionGemmaModel {
  id: string;
  name: string;
  description: string;
  detailsUrl?: string;
  sizeInBytes: number;
  installed: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  statusMessage?: string | null;
}

interface FunctionGemmaSectionProps {
  model?: FunctionGemmaModel;
  downloadModel: (modelId: string, waitForActive?: boolean, userInitiated?: boolean, selectForSynthesis?: boolean) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
}

export function FunctionGemmaSection({ model, downloadModel, removeModel }: FunctionGemmaSectionProps) {
  if (!model) return null;

  const status = model.downloading
    ? `Downloading · ${model.progress}%`
    : model.error ?? model.statusMessage ?? (model.installed ? 'Ready on this device' : 'Not downloaded');

  return (
    <View style={styles.container}>
      <SectionHeader title="Research helper" />
      <Card variant="inset" style={styles.card}>
        <Text style={styles.title}>FunctionGemma 270M</Text>
        <Text style={styles.body}>
          Plans a research handoff on this device. It does not browse the web. Gemma Terms apply to this community-converted model. Thought Notes shares your task and this topic through the system share sheet; choose ChatGPT and send it there. Share ChatGPT’s answer back to Thought Notes to review and save it through Import.
        </Text>
        <Text style={styles.meta}>Download size · {formatModelSize(model.sizeInBytes)}</Text>
        <Text style={[styles.status, model.error ? styles.error : null]} accessibilityLiveRegion="polite">
          {status}
        </Text>
        <Button
          label={model.downloading
            ? `Downloading · ${model.progress}%`
            : model.installed
              ? 'Remove research helper'
              : model.statusMessage === 'Download paused' ? 'Resume download' : 'Download research helper'}
          variant={model.installed ? 'secondary' : 'primary'}
          onPress={() => {
            if (model.installed) {
              removeModel(model.id).catch(error => console.error('Could not remove FunctionGemma:', error));
            } else {
              downloadModel(model.id, false, true, false).catch(error => console.error('Could not download FunctionGemma:', error));
            }
          }}
          disabled={model.downloading}
          testID="functiongemma_install_button"
        />
        {model.detailsUrl ? (
          <Text
            accessibilityRole="link"
            onPress={() => Linking.openURL(model.detailsUrl!).catch(error => console.error('Could not open FunctionGemma model details:', error))}
            style={styles.link}>
            Model details
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  body: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  meta: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  status: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  error: {
    color: colors.error,
  },
  link: {
    ...typography.caption,
    color: colors.primary,
    paddingTop: spacing.xs,
  },
});
