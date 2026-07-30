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
      <SectionHeader title="Assistant shortcuts" />
      <Card variant="inset" style={styles.card}>
        <Text style={styles.title}>{isIOS ? 'Capture with Siri or Shortcuts' : 'Capture with Google Assistant'}</Text>
        <Text style={styles.body}>
          {isIOS
            ? 'Add the Context Engine action in Shortcuts, then bind a phrase that passes text directly into the app.'
            : 'Context Engine publishes a capture shortcut and Assistant action that pass text directly into the app.'}
        </Text>
        <View style={styles.list}>
          <Text style={styles.bullet}>
            {isIOS
              ? '1. Open Apple Shortcuts and add the Context Engine capture action.'
              : '1. Install and open the Play Store build so Google Assistant can index the Capture thought action.'}
          </Text>
          <Text style={styles.bullet}>
            {isIOS
              ? '2. Say "Add this to my context" followed by your thought.'
              : '2. Say "Add [your thought] to my context" or bind Capture thought in an Assistant Routine.'}
          </Text>
          <Text style={styles.bullet}>3. Confirm Assistant opens Context Engine and queues the text locally.</Text>
        </View>
        <Text style={styles.limit}>
          Assistant capture is text-only. It does not replace manual capture, and it does not parse arbitrary assistant
          output.
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
