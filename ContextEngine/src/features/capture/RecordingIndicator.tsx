import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { RecordingState } from './captureTypes';

function getIndicatorLabel(recordingState: RecordingState) {
  switch (recordingState) {
    case 'starting':
      return 'Starting recording';
    case 'recording':
      return 'Recording';
    case 'stopping':
      return 'Stopping recording';
    case 'transcribing':
      return 'Transcribing';
    case 'error':
      return 'Mic error';
    default:
      return null;
  }
}

export function RecordingIndicator({ recordingState }: { recordingState: RecordingState }) {
  const label = getIndicatorLabel(recordingState);
  const pulse = useRef(new Animated.Value(0)).current;
  const shouldAnimate = typeof process !== 'undefined' && !process.env.JEST_WORKER_ID;

  useEffect(() => {
    if (!shouldAnimate) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    if (recordingState !== 'recording' && recordingState !== 'starting' && recordingState !== 'transcribing') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: recordingState === 'recording' ? 780 : 960,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: recordingState === 'recording' ? 780 : 960,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse, recordingState, shouldAnimate]);

  const barScales = useMemo(
    () => [
      pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }),
      pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }),
      pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.1] }),
    ],
    [pulse],
  );

  if (!label) {
    return null;
  }

  const isError = recordingState === 'error';
  const isLive = recordingState === 'recording';

  return (
    <View
      testID="recording_indicator"
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.shell, isError ? styles.shellError : styles.shellGlass]}>
      <View style={[styles.dot, isError ? styles.dotError : isLive ? styles.dotLive : styles.dotPending]} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.wave}>
        {barScales.map((scale, index) => (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              isError ? styles.barError : isLive ? styles.barLive : styles.barPending,
              {
                transform: [{ scaleY: scale }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  shellGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.88)',
  },
  shellError: {
    backgroundColor: 'rgba(255, 250, 249, 0.76)',
    borderColor: 'rgba(186, 26, 26, 0.28)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  dotLive: {
    backgroundColor: colors.error,
  },
  dotPending: {
    backgroundColor: colors.primaryContainer,
  },
  dotError: {
    backgroundColor: colors.error,
  },
  label: {
    ...typography.labelCaps,
    color: colors.onSurface,
    marginRight: spacing.sm,
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 14,
  },
  bar: {
    width: 4,
    height: 14,
    borderRadius: radius.full,
  },
  barLive: {
    backgroundColor: colors.error,
  },
  barPending: {
    backgroundColor: colors.primaryContainer,
    opacity: 0.75,
  },
  barError: {
    backgroundColor: colors.error,
    opacity: 0.7,
  },
});
