import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

import { SYNTHESIS_MINIMUM_RAM_GB } from '../../../modules/DeviceReadiness';
import { DeviceReadinessNotice } from '../DeviceReadinessNotice';

const gibibyte = 1024 ** 3;

const readText = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root.findAllByType(Text).map(node => node.props.children).flat().join(' ');

describe('DeviceReadinessNotice', () => {
  it('offers an optional download on a ready phone without starting it on dismissal', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const onInstallModel = jest.fn();
    const onDismiss = jest.fn();
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <DeviceReadinessNotice
          readiness={{
            checkAvailable: true,
            isSimulator: false,
            platform: 'android',
            osVersion: '14',
            apiLevel: 34,
            totalMemoryBytes: 6 * gibibyte,
            availableMemoryBytes: 2 * gibibyte,
            freeStorageBytes: 8 * gibibyte,
            lowMemory: false,
            thermalState: 'nominal',
            minimumMemoryBytes: SYNTHESIS_MINIMUM_RAM_GB * gibibyte,
            meetsSynthesisMinimum: true,
            resourcesAvailable: true,
            reason: 'ready',
          }}
          canInstallModel
          onInstallModel={onInstallModel}
          onDismiss={onDismiss}
        />,
      );
    });

    expect(readText(renderer)).toContain('Phone check');
    expect(readText(renderer)).toContain('This phone has enough memory for the writing assistant. Keep about 1.0 GB free to download the writing assistant.');
    expect(readText(renderer)).not.toContain('2.0 GB free memory now');
    expect(readText(renderer)).not.toContain('Download size: 557 MB');
    expect(renderer.root.findByProps({ testID: 'device_readiness_install_button' }).props.label).toBe('Download assistant · 557 MB');
    const dismissButton = renderer.root.findByProps({ testID: 'device_readiness_dismiss_button' });
    expect(dismissButton.props.label).toBe('Continue without assistant');
    ReactTestRenderer.act(() => dismissButton.props.onPress());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onInstallModel).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'device_readiness_install_button' }).props.onPress());
    expect(onInstallModel).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('explains the performance tradeoff and lets a user continue below the synthesis memory baseline', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const onInstallModel = jest.fn();
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <DeviceReadinessNotice
          readiness={{
            checkAvailable: true,
            isSimulator: false,
            platform: 'android',
            osVersion: '6.0.1',
            apiLevel: 23,
            totalMemoryBytes: 3 * gibibyte,
            availableMemoryBytes: 2 * gibibyte,
            freeStorageBytes: gibibyte,
            lowMemory: false,
            thermalState: 'unknown',
            minimumMemoryBytes: SYNTHESIS_MINIMUM_RAM_GB * gibibyte,
            meetsSynthesisMinimum: false,
            resourcesAvailable: true,
            reason: 'minimum-memory',
          }}
          canInstallModel={true}
          onInstallModel={onInstallModel}
          onDismiss={() => undefined}
        />,
      );
    });

    expect(readText(renderer)).toContain('This phone has 3.0 GB of memory. The writing assistant needs at least 4 GB.');
    expect(readText(renderer)).toContain('It may run slowly or stop');
    expect(readText(renderer)).toContain('your notes stay saved in Inbox');
    expect(readText(renderer)).toContain('Download anyway');
    expect(renderer.root.findByProps({ testID: 'device_readiness_dismiss_button' }).props.label).toBe('Continue without assistant');
    expect(renderer.root.findByProps({ testID: 'device_readiness_install_button' })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'device_readiness_install_button' }).props.onPress());
    expect(onInstallModel).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => renderer.unmount());
  });
});
