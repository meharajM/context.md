import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getReminderState, isAutomaticReminderSupported, setAutomaticRemindersEnabled } from '../../modules/AutomaticReminders';
import { Card } from '../../shared/components/Card';
import { SectionHeader } from '../../shared/components/SectionHeader';
import { SwitchRow } from '../../shared/components/SwitchRow';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';

export function AutomaticRemindersSection() {
  const supported = isAutomaticReminderSupported();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Loading reminders…');
  const mounted = useRef(false);
  const pending = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (supported) {
      getReminderState().then(state => {
        if (mounted.current) {
          setEnabled(state.enabled);
          setMessage('');
        }
      }).catch(error => {
        if (mounted.current) {
          setMessage(error instanceof Error ? error.message : 'Could not load reminders. Try again.');
        }
      }).finally(() => {
        pending.current = false;
        if (mounted.current) { setBusy(false); }
      });
    }
    return () => { mounted.current = false; };
  }, [supported]);

  const changeEnabled = async (value: boolean) => {
    if (pending.current) { return; }
    pending.current = true;
    setBusy(true);
    setMessage('Updating reminders…');
    try {
      const state = await setAutomaticRemindersEnabled(value);
      if (mounted.current) {
        setEnabled(state.enabled);
        setMessage('');
      }
    } catch (error) {
      if (mounted.current) {
        setMessage(error instanceof Error ? error.message : 'Could not update reminders. Try again.');
      }
    } finally {
      pending.current = false;
      if (mounted.current) { setBusy(false); }
    }
  };

  if (!supported) { return null; }

  return (
    <View style={styles.container}>
      <SectionHeader title="Reminders" />
      <Card variant="inset" style={styles.card}>
        <SwitchRow
          label="Automatic reminders"
          description="Find tasks in new notes and choose a useful reminder time, privately on your device."
          value={enabled}
          disabled={busy}
          onValueChange={changeEnabled}
          testID="switch_automatic_reminders"
        />
        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  card: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  message: { ...typography.caption, color: colors.onSurfaceVariant, paddingBottom: spacing.sm },
});
