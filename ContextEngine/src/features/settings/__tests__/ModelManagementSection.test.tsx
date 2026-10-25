import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

import { ModelManagementSection } from '../ModelManagementSection';

const models = [
  {
    id: 'gemma3-1b-it',
    name: 'Compact assistant',
    description: 'A smaller download for quick note sorting.',
    sizeInBytes: 584417280,
    minDeviceMemoryInGb: 4,
    backend: 'cpu',
    installed: false,
    downloading: false,
    progress: 0,
    error: null,
    recommended: true,
  },
  {
    id: 'gemma4-e2b-it',
    name: 'Balanced assistant',
    description: 'A more capable option for phones with extra memory.',
    sizeInBytes: 1620000000,
    minDeviceMemoryInGb: 6,
    backend: 'cpu',
    installed: false,
    downloading: false,
    progress: 0,
    error: null,
  },
  {
    id: 'gemma4-e4b-it',
    name: 'Advanced assistant',
    description: 'The most capable option, for phones with plenty of memory.',
    sizeInBytes: 3100000000,
    minDeviceMemoryInGb: 8,
    backend: 'cpu',
    installed: false,
    downloading: false,
    progress: 0,
    error: null,
  },
];

const readText = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root.findAllByType(Text).map(node => node.props.children).flat().join(' ');

describe('ModelManagementSection device guidance', () => {
  it('shows actionable storage errors but keeps technical download errors generic', () => {
    const storageError = 'Free up storage before installing Compact assistant: about 1.1 GB is recommended; 700 MB is available.';
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ModelManagementSection
          activeModel={models[0]}
          models={models}
          deviceReadiness={null}
          selectedModelDownloading={false}
          selectedModelError={storageError}
          selectedModelId={models[0].id}
          selectedModelInstalled={false}
          selectedModelProgress={0}
          selectModel={async () => undefined}
          downloadModel={async () => undefined}
          removeModel={async () => undefined}
        />,
      );
    });

    expect(readText(renderer)).toContain(storageError);
    ReactTestRenderer.act(() => renderer.update(
      <ModelManagementSection
        activeModel={models[0]}
        models={models}
        deviceReadiness={null}
        selectedModelDownloading={false}
        selectedModelError={'/data/user/0/app/cache/model.tmp: SocketException'}
        selectedModelId={models[0].id}
        selectedModelInstalled={false}
        selectedModelProgress={0}
        selectModel={async () => undefined}
        downloadModel={async () => undefined}
        removeModel={async () => undefined}
      />,
    ));
    expect(readText(renderer)).toContain('Something went wrong. Please try again.');
    expect(readText(renderer)).not.toContain('SocketException');

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('shows saved download progress and offers resume after interruption', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ModelManagementSection
          activeModel={{ ...models[0], progress: 32, statusMessage: 'Download paused' }}
          models={models}
          deviceReadiness={null}
          selectedModelDownloading={false}
          selectedModelError={null}
          selectedModelId={models[0].id}
          selectedModelInstalled={false}
          selectedModelProgress={32}
          selectModel={async () => undefined}
          downloadModel={async () => undefined}
          removeModel={async () => undefined}
        />,
      );
    });

    expect(readText(renderer)).toMatch(/Download paused.*32\s*% saved\. Tap Resume to continue\./);
    expect(renderer.root.findByProps({ testID: 'model_install_button' }).props.label).toBe('Resume');

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('shows when an outdated model was removed and needs a new download', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ModelManagementSection
          activeModel={{ ...models[0], statusMessage: 'Outdated model removed; download again.' }}
          models={models}
          deviceReadiness={null}
          selectedModelDownloading={false}
          selectedModelError={null}
          selectedModelId={models[0].id}
          selectedModelInstalled={false}
          selectedModelProgress={0}
          selectModel={async () => undefined}
          downloadModel={async () => undefined}
          removeModel={async () => undefined}
        />,
      );
    });

    expect(readText(renderer)).toContain('Outdated model removed; download again.');
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('disables model changes while a download is in progress', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ModelManagementSection
          activeModel={{ ...models[0], downloading: true }}
          models={models}
          deviceReadiness={null}
          selectedModelDownloading={true}
          selectedModelError={null}
          selectedModelId={models[0].id}
          selectedModelInstalled={false}
          selectedModelProgress={0}
          selectModel={async () => undefined}
          downloadModel={async () => undefined}
          removeModel={async () => undefined}
        />,
      );
    });

    ReactTestRenderer.act(() => {
      renderer.root.findAll(node => node.props?.onPress).find(node =>
        node.findAllByType(Text).some(text => text.props.children === 'More options'),
      )!.props.onPress();
    });
    expect(renderer.root.findByProps({ testID: `model_select_${models[1].id}` }).props.disabled).toBe(true);
    expect(readText(renderer)).toContain('Finish this download to choose another assistant.');
    expect(readText(renderer)).toContain('Preparing download…');
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('keeps the selected model visible and expands the catalog when no option meets device RAM', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ModelManagementSection
          activeModel={{ ...models[0], installed: true }}
          models={models}
          deviceReadiness={{
            checkAvailable: true,
            isSimulator: false,
            platform: 'android',
            osVersion: '12',
            totalMemoryBytes: 3.5 * 1024 ** 3,
            availableMemoryBytes: 1.1 * 1024 ** 3,
            freeStorageBytes: 12 * 1024 ** 3,
            lowMemory: false,
            thermalState: 'nominal',
            minimumMemoryBytes: 4 * 1024 ** 3,
            meetsSynthesisMinimum: false,
            resourcesAvailable: true,
            reason: 'minimum-memory',
          }}
          selectedModelDownloading={false}
          selectedModelError={null}
          selectedModelId={models[0].id}
          selectedModelInstalled={true}
          selectedModelProgress={0}
          selectModel={async () => undefined}
          downloadModel={async () => undefined}
          removeModel={async () => undefined}
        />,
      );
    });

    expect(readText(renderer)).toContain("No assistant is recommended for this phone's 3.5 GB memory");
    expect(readText(renderer)).not.toContain('Balanced assistant');
    expect(renderer.root.findByProps({ testID: 'model_select_button' }).props.label).toBe('Selected');
    ReactTestRenderer.act(() => {
      renderer.root.findAll(node => node.props?.onPress).find(node =>
        node.findAllByType(Text).some(text => text.props.children === 'More options'),
      )!.props.onPress();
    });
    expect(readText(renderer)).toContain('Balanced assistant');
    expect(readText(renderer)).toContain('Needs 6 GB memory · may run slowly or stop');
    expect(readText(renderer)).toContain('Needs 8 GB memory · may run slowly or stop');
    expect(renderer.root.findByProps({ testID: 'model_name_gemma4-e2b-it' }).props.numberOfLines).toBe(2);
    expect(renderer.root.findByProps({ testID: 'model_name_gemma4-e4b-it' }).props.numberOfLines).toBe(2);
    expect(renderer.root.findByProps({ testID: 'model_recommendation' })).toBeTruthy();
    expect(readText(renderer)).toContain('May run slowly or stop on this phone');
    expect(renderer.root.findByProps({ testID: 'model_delete_button' }).props.label).toBe('Delete');
    expect(readText(renderer)).toContain('Download anyway');

    ReactTestRenderer.act(() => renderer.unmount());
  });
});
