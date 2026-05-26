import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../shared/components/Card';
import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import type { SourceCaptureView } from './threadTypes';

interface SourceCaptureTimelineProps {
  captures: SourceCaptureView[];
}

export function SourceCaptureTimeline({ captures }: SourceCaptureTimelineProps) {
  if (captures.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No source captures in this thread.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {captures.map((capture, index) => {
        const isLast = index === captures.length - 1;
        
        return (
          <View key={capture.id} style={styles.timelineItem}>
            {/* Timeline rail and icon column */}
            <View style={styles.leftColumn}>
              <View style={styles.iconWrapper}>
                <Icon 
                  name={capture.icon} 
                  size={16} 
                  color={colors.primary} 
                  backgroundColor={colors.surfaceContainer}
                />
              </View>
              {!isLast && <View style={styles.rail} />}
            </View>

            {/* Content card column */}
            <View style={styles.rightColumn}>
              <Card variant="default" style={styles.captureCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.typeLabel}>{capture.typeLabel}</Text>
                  <Text style={styles.timeLabel}>{capture.timestampLabel}</Text>
                </View>
                <Text style={styles.previewText}>{capture.preview}</Text>
              </Card>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.sm,
  },
  leftColumn: {
    alignItems: 'center',
    width: 32,
    marginRight: spacing.sm,
  },
  iconWrapper: {
    zIndex: 1,
    backgroundColor: colors.background,
    borderRadius: 999,
  },
  rail: {
    position: 'absolute',
    top: 24,
    bottom: -spacing.sm, // Extend rail to the next item's icon
    left: 15, // Centered inside the 32px column (15px + 2px width / 2 = 16px center)
    width: 2,
    backgroundColor: colors.surfaceContainerHigh,
  },
  rightColumn: {
    flex: 1,
  },
  captureCard: {
    padding: spacing.md,
    gap: spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  typeLabel: {
    ...typography.labelCaps,
    color: colors.primary,
    fontWeight: '700',
  },
  timeLabel: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  previewText: {
    ...typography.bodySm,
    color: colors.onSurface,
    lineHeight: 20,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
