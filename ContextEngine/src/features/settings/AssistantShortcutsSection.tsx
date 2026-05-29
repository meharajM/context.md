import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { ShortcutsSetupButton } from '../../shared/components/ShortcutsSetupButton';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

export function AssistantShortcutsSection() {
  return (
    <View style={styles.container}>
      <SectionHeader title="Assistant shortcuts" />
      <Card variant="inset" style={styles.card}>
        <Text style={styles.title}>Capture with Siri or Shortcuts</Text>
        <Text style={styles.body}>
          Add the Context Engine action in Shortcuts, then bind a phrase that passes text directly into the app.
        </Text>
        <View style={styles.list}>
          <Text style={styles.bullet}>1. Open Apple Shortcuts and add the Context Engine capture action.</Text>
          <Text style={styles.bullet}>2. Assign a phrase such as "Add this to my context".</Text>
          <Text style={styles.bullet}>3. Send spoken or typed content as plain text only.</Text>
        </View>
        <Text style={styles.limit}>
          Assistant capture is text-only. It does not replace manual capture, and it does not parse arbitrary assistant
          output.
        </Text>
        <ShortcutsSetupButton style={styles.shortcutsButton} />
        <Button
          label="Open Settings"
          variant="secondary"
          icon="settings"
          onPress={() => {
            Linking.openSettings().catch(error => {
              console.error('Failed to open app settings:', error);
            });
          }}
          style={styles.button}
        />
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
    paddingVertical: spacing.md,
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
  list: {
    gap: spacing.xs,
  },
  bullet: {
    ...typography.caption,
    color: colors.onSurface,
    lineHeight: 18,
  },
  limit: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
    paddingTop: spacing.xs,
  },
  button: {
    alignSelf: 'flex-start',
  },
  shortcutsButton: {
    alignSelf: 'flex-start',
  },
});
