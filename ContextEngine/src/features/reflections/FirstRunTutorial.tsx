import React, { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { colors } from '../../shared/design/colors';
import { radius } from '../../shared/design/radius';
import { spacing } from '../../shared/design/spacing';
import { typography } from '../../shared/design/typography';
import { formatModelSize } from '../../ui/design';

const STEPS = [
  {
    title: 'Catch ideas before they drift',
    copy: Platform.OS === 'android' && RELEASE_CAPABILITIES.voiceCapture
      ? 'Long-press Home → Widgets → Thought Notes. Then tap Record or Write.'
      : 'Write a thought as soon as it comes to mind. It stays saved on this device.',
  },
  {
    title: 'Let related thoughts find each other',
    copy: 'On-device AI groups each thought with its related topic. Originals stay saved while it prepares.',
  },
  {
    title: 'Bring useful research back',
    copy: 'Share a topic with your AI assistant, then share the reply back. On-device AI files it with related notes.',
  },
] as const;

export function FirstRunTutorial({
  modelInstalled,
  modelDownloading,
  modelProgress,
  modelSizeBytes,
  voiceModelDownloading,
  voiceModelProgress,
  voiceModelReady,
  voiceModelError,
  onRetryVoiceModelDownload,
  onFinish,
}: {
  modelInstalled: boolean;
  modelDownloading: boolean;
  modelProgress: number;
  modelSizeBytes?: number;
  voiceModelDownloading: boolean;
  voiceModelProgress: number;
  voiceModelReady: boolean;
  voiceModelError: string | null;
  onRetryVoiceModelDownload: () => void;
  onFinish: () => void;
}) {
  const pager = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  const downloading = modelDownloading || voiceModelDownloading;

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    pager.current?.scrollTo({ x: nextPage * pageWidth, animated: true });
  };

  return (
    <View style={styles.screen} testID="first_run_tutorial">
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>A QUICK TOUR</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          onPress={onFinish}
          style={styles.skipButton}
          testID="first_run_skip">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <Text style={styles.introTitle}>Catch every idea. Keep it connected.</Text>
      <Text style={styles.introCopy}>Capture, organize, and build on every idea.</Text>

      <View style={styles.pagerFrame} onLayout={event => setPageWidth(event.nativeEvent.layout.width)}>
        {pageWidth > 0 ? (
          <ScrollView
            ref={pager}
            style={styles.pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={event => setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth))}
            testID="first_run_carousel">
            {STEPS.map((step, index) => (
              <View key={step.title} style={[styles.slide, { width: pageWidth }]}>
                <View style={styles.illustration}>
                  {index === 0 ? <CaptureIllustration /> : index === 1 ? <OrganizationIllustration /> : <ResearchIllustration />}
                </View>
                <View style={styles.slideText}>
                  <Text style={styles.stepLabel}>STEP {index + 1}</Text>
                  <Text style={styles.slideTitle}>{step.title}</Text>
                  <Text style={styles.slideCopy}>{step.copy}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.readinessCard} testID="first_run_model_status">
        {modelDownloading ? (
          <ModelProgress label="Topic organization" progress={modelProgress} detail={modelSizeBytes ? formatModelSize(modelSizeBytes) : undefined} />
        ) : null}
        {voiceModelDownloading ? <ModelProgress label="Voice notes" progress={voiceModelProgress} /> : null}
        {voiceModelError ? (
          <View style={styles.modelErrorRow}>
            <Text style={styles.readinessDetail}>Voice setup paused. Retry to enable voice notes.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry voice model download"
              onPress={onRetryVoiceModelDownload}
              style={styles.retryButton}
              testID="first_run_voice_retry">
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !voiceModelReady && !voiceModelDownloading ? (
          <View style={styles.modelErrorRow}>
            <Text style={styles.readinessDetail}>Preparing voice setup for the quick tour.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start voice model download"
              onPress={onRetryVoiceModelDownload}
              style={styles.retryButton}
              testID="first_run_voice_prepare">
              <Text style={styles.retryText}>Prepare</Text>
            </Pressable>
          </View>
        ) : voiceModelReady && !modelDownloading && !modelInstalled ? (
          <Text style={styles.readinessDetail}>Voice notes ready · topic organization can prepare in the background.</Text>
        ) : voiceModelReady && !modelDownloading ? (
          <Text style={styles.readinessDetail}>Voice and on-device topic organization are ready.</Text>
        ) : null}
        {downloading ? <Text style={styles.downloadDisclosure}>Captures stay saved on this device. Downloads may use mobile data.</Text> : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination} accessibilityLabel={`Step ${page + 1} of ${STEPS.length}`}>
          {STEPS.map((step, index) => (
            <Pressable
              key={step.title}
              accessibilityRole="button"
              accessibilityLabel={`Go to step ${index + 1}`}
              onPress={() => goToPage(index)}
              style={[styles.dot, page === index ? styles.activeDot : null]}
            />
          ))}
        </View>
        <View style={styles.actions}>
          {page > 0 ? (
            <Button label="Back" variant="secondary" onPress={() => goToPage(page - 1)} style={styles.backButton} />
          ) : <View style={styles.backSpacer} />}
          <Button
            label={page === STEPS.length - 1 ? 'Start capturing' : 'Next'}
            onPress={() => {
              if (page === STEPS.length - 1) onFinish();
              else goToPage(page + 1);
            }}
            testID={page === STEPS.length - 1 ? 'first_run_start' : 'first_run_next'}
            style={styles.nextButton}
          />
        </View>
      </View>
    </View>
  );
}

function ModelProgress({ label, progress, detail }: { label: string; progress: number; detail?: string }) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <View style={styles.modelProgress} accessibilityLabel={`${label} download ${safeProgress}%`}>
      <View style={styles.modelProgressLabelRow}>
        <Text style={styles.readinessDetail}>{label}{detail ? ` · ${detail}` : ''}</Text>
        <Text style={styles.readinessDetail}>{safeProgress}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${safeProgress}%` }]} />
      </View>
    </View>
  );
}

function CaptureIllustration() {
  return (
    <View style={styles.widget}>
      <View style={styles.widgetHeading}>
        <Icon name="brand" size={20} color={colors.primary} />
        <Text style={styles.widgetName}>Thought Notes</Text>
        <Text style={styles.widgetLabel}>HOME WIDGET</Text>
      </View>
      <View style={styles.widgetActions}>
        {RELEASE_CAPABILITIES.voiceCapture ? (
          <View style={[styles.widgetAction, styles.recordAction]}>
            <Icon name="mic" size={20} color={colors.surfaceContainerLowest} />
            <Text style={styles.recordText}>Record</Text>
          </View>
        ) : null}
        <View style={[styles.widgetAction, styles.writeAction]}>
          <Icon name="edit" size={20} color={colors.primary} />
          <Text style={styles.writeText}>Write</Text>
        </View>
      </View>
    </View>
  );
}

function OrganizationIllustration() {
  return (
    <View style={styles.organizationFlow}>
      <View style={[styles.flowCard, styles.noteCard]}>
        <Icon name="edit" size={18} color={colors.primary} />
        <Text style={styles.flowLabel}>NEW THOUGHT</Text>
        <Text style={styles.flowText}>Try the lakeside trail</Text>
      </View>
      <View style={styles.flowArrow}>
        <Icon name="spark" size={24} color={colors.tertiary} />
        <Icon name="chevronRight" size={18} color={colors.onSurfaceVariant} />
      </View>
      <View style={[styles.flowCard, styles.topicCard]}>
        <Text style={styles.flowLabel}>RELATED TOPIC</Text>
        <Text style={styles.flowTitle}>Weekend walk</Text>
        <View style={styles.topicLine}><View style={styles.topicBullet} /><Text style={styles.topicLineText}>Bring water</Text></View>
      </View>
    </View>
  );
}

function ResearchIllustration() {
  return (
    <View style={styles.researchFlow}>
      <FlowStep icon="reflections" label="Your topic" />
      <Icon name="chevronRight" size={20} color={colors.onSurfaceVariant} />
      <FlowStep icon="spark" label="AI assistant" accent />
      <Icon name="chevronRight" size={20} color={colors.onSurfaceVariant} />
      <FlowStep icon="check" label="Related notes" />
    </View>
  );
}

function FlowStep({ icon, label, accent = false }: { icon: 'reflections' | 'spark' | 'check'; label: string; accent?: boolean }) {
  return (
    <View style={styles.researchStep}>
      <Icon name={icon} size={23} color={accent ? colors.tertiary : colors.primary} />
      <Text style={styles.researchLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  eyebrow: {
    ...typography.labelCaps,
    color: colors.primary,
    letterSpacing: 1,
  },
  skipButton: {
    minWidth: 56,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  introTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  introCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  readinessCard: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.xs,
  },
  readinessDetail: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  modelProgress: {
    gap: 2,
  },
  modelProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modelErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  retryButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '700',
  },
  downloadDisclosure: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  progressTrack: {
    height: 3,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  pagerFrame: {
    flex: 1,
    minHeight: 0,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  illustration: {
    minHeight: 176,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xxl,
    padding: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  slideText: {
    gap: spacing.xs,
  },
  stepLabel: {
    ...typography.labelCaps,
    color: colors.primary,
    letterSpacing: 0.7,
  },
  slideTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  slideCopy: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  widget: {
    width: '100%',
    maxWidth: 340,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  widgetHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  widgetName: {
    ...typography.bodySm,
    flex: 1,
    color: colors.onSurface,
    fontWeight: '700',
  },
  widgetLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    fontSize: 9,
  },
  widgetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  widgetAction: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
  },
  recordAction: {
    backgroundColor: colors.primary,
  },
  writeAction: {
    backgroundColor: colors.secondaryContainer,
  },
  recordText: {
    ...typography.bodySm,
    color: colors.surfaceContainerLowest,
    fontWeight: '700',
  },
  writeText: {
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  organizationFlow: {
    width: '100%',
    maxWidth: 350,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flowCard: {
    flex: 1,
    minHeight: 108,
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  noteCard: {
    transform: [{ rotate: '-2deg' }],
  },
  topicCard: {
    transform: [{ rotate: '2deg' }],
  },
  flowArrow: {
    alignItems: 'center',
    gap: 2,
  },
  flowLabel: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    fontSize: 9,
  },
  flowText: {
    ...typography.caption,
    color: colors.onSurface,
  },
  flowTitle: {
    ...typography.bodySm,
    color: colors.onSurface,
    fontWeight: '700',
  },
  topicLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  topicBullet: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.tertiary,
  },
  topicLineText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
  researchFlow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  researchStep: {
    flex: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceContainerLowest,
  },
  researchLabel: {
    ...typography.caption,
    color: colors.onSurface,
    textAlign: 'center',
  },
  footer: {
    gap: spacing.sm,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.outlineVariant,
  },
  activeDot: {
    width: 24,
    backgroundColor: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  backSpacer: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
});
