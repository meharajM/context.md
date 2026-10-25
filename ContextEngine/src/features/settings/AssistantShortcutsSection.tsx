import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { ShortcutsSetupButton } from '../../shared/components/ShortcutsSetupButton';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

export function AssistantShortcutsSection() {
  const isIOS = Platform.OS === 'ios';

  return (
    <View style={styles.container}>
      <SectionHeader title="Use your voice assistant" />
      <Card variant="inset" style={styles.card}>
        <Text style={styles.title}>{isIOS ? 'Save notes with Siri' : 'Save notes with your voice assistant'}</Text>
        <Text style={styles.body}>
          {isIOS
            ? 'Add Thought Notes to Shortcuts, then ask Siri to save a note.'
            : 'Set up Thought Notes with your voice assistant to save spoken notes.'}
        </Text>
        <View style={styles.list}>
          <Text style={styles.bullet}>
            {isIOS
              ? '1. Open Shortcuts and add Thought Notes.'
              : '1. Install Thought Notes from the Play Store and open it once.'}
          </Text>
          <Text style={styles.bullet}>
            {isIOS
              ? '2. Say “Add this to my context,” then speak your note.'
              : '2. Say “Add [your note] to my context.”'}
          </Text>
          <Text style={styles.bullet}>3. Check that Thought Notes opens and your note appears in the app.</Text>
        </View>
        <Text style={styles.limit}>
          Voice assistant notes are saved as text. You can also type or record notes in the app.
        </Text>
        {isIOS ? <ShortcutsSetupButton style={styles.shortcutsButton} /> : null}
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
  shortcutsButton: {
    alignSelf: 'flex-start',
  },
});
