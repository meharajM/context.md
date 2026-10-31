const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const { androidAppId, assertSafeTarget } = require('./appTarget');
const { finishFirstRunTutorialIfPresent } = require('./firstRun');
const { execFileSync } = require('child_process');
const { captureStoreScreenshot, setAndroidStoreScreenshotViewport,
  restoreAndroidStoreScreenshotViewport } = require('./storeScreenshot');

const shouldCapture = process.env.CAPTURE_STORE_SCREENSHOTS === '1';
const screenshotSuite = shouldCapture ? describe : describe.skip;
const EXPECTED_MODEL_SIZE = 584417280;
const EXPECTED_MODEL_SHA256 = '1325ae366d31950f137c9c357b9fa89448b176d76998180c08ceaca78bba98be';

if (shouldCapture && device.getPlatform() === 'android' && !process.env.CONTEXTENGINE_MODEL_PATH) {
  throw new Error('Set CONTEXTENGINE_MODEL_PATH to the verified Gemma3 model before preparing Play screenshots.');
}

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function makeReadyAndroidHomeFixture() {
  const day = '2026-10-25T08:00:00.000Z';
  const notes = [
    ['store-garden-note-1', 'Compare native garden beds with nearby lawns for bird and pollinator visits.'],
    ['store-garden-note-2', 'Track weekly visits to learn which native plants attract the most pollinators.'],
  ];
  return `# Native Garden Ideas\n\n${notes.map(([noteId, text]) => {
    const metadata = { noteId, createdAt: day, updatedAt: day,
      sourceMetadata: { kind: 'text', transcript: text, noteId } };
    return `- [${day}] <!-- thought-note:v2 ${JSON.stringify(metadata)} -->\n  | ${text}\n  <!-- /thought-note -->`;
  }).join('\n')}\n`;
}

async function captureReadyAndroidHome() {
  const appId = androidAppId();
  const fixturePath = path.join(os.tmpdir(), `thought-notes-store-fixture-${process.pid}.md`);
  const manifestPath = path.join(os.tmpdir(), `thought-notes-model-manifest-${process.pid}.json`);
  const modelPath = path.resolve(process.env.CONTEXTENGINE_MODEL_PATH);
  const modelSize = fs.statSync(modelPath).size;
  const modelSha256 = crypto.createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex');
  assert.equal(modelSize, EXPECTED_MODEL_SIZE, 'Use the complete recommended Gemma3 model');
  assert.equal(modelSha256, EXPECTED_MODEL_SHA256, 'Use the verified Gemma3 model');
  fs.writeFileSync(fixturePath, makeReadyAndroidHomeFixture());
  fs.writeFileSync(manifestPath, JSON.stringify({ 'gemma3-1b-it': {
    installedAt: new Date().toISOString(), file: 'gemma3-1b-it-int4.litertlm',
    size: modelSize, sha256: modelSha256, verified: true, license: 'gemma',
    sourceUrl: 'https://huggingface.co/lotapa/gemma3-1b-it-int4.litertlm/resolve/main/gemma3-1b-it-int4.litertlm?download=1',
  } }));
  await device.terminateApp();
  run('adb', ['-s', device.id, 'push', modelPath, '/data/local/tmp/thought-notes-store-model.litertlm']);
  run('adb', ['-s', device.id, 'push', manifestPath, '/data/local/tmp/thought-notes-model-manifest.json']);
  run('adb', ['-s', device.id, 'push', fixturePath, '/data/local/tmp/thought-notes-store-fixture.md']);
  run('adb', ['-s', device.id, 'shell', 'run-as', appId, 'mkdir', '-p', 'files/models']);
  run('adb', ['-s', device.id, 'shell', 'run-as', appId, 'cp',
    '/data/local/tmp/thought-notes-store-model.litertlm', 'files/models/gemma3-1b-it-int4.litertlm']);
  run('adb', ['-s', device.id, 'shell', 'run-as', appId, 'cp',
    '/data/local/tmp/thought-notes-model-manifest.json', 'files/models/manifest.json']);
  run('adb', ['-s', device.id, 'shell', 'run-as', appId, 'rm', '-rf',
    'files/topics', 'files/context.md', 'files/quick-text-outbox', 'files/incoming-share-outbox']);
  run('adb', ['-s', device.id, 'shell', 'run-as', appId, 'mkdir', '-p', 'files/topics']);
  run('adb', ['-s', device.id, 'shell', 'run-as', appId, 'cp',
    '/data/local/tmp/thought-notes-store-fixture.md', 'files/topics/native-garden-ideas.md']);
  assert.deepEqual(
    run('adb', ['-s', device.id, 'shell', 'run-as', appId, 'ls', 'files/topics']).split(/\r?\n/).sort(),
    ['native-garden-ideas.md'],
    'The screenshot fixture must contain only its intended topic before launch',
  );
  fs.unlinkSync(fixturePath);
  fs.unlinkSync(manifestPath);
  await device.launchApp({ newInstance: true });
  await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(20000);
  await finishFirstRunTutorialIfPresent();
  await waitFor(element(by.text('Native Garden Ideas'))).toBeVisible().withTimeout(15000);
  assert.deepEqual(
    run('adb', ['-s', device.id, 'shell', 'run-as', appId, 'ls', 'files/topics']).split(/\r?\n/).sort(),
    ['native-garden-ideas.md'],
    'App startup must not restore unrelated notes into the store screenshot fixture',
  );
  await expect(element(by.text('Inbox'))).not.toExist();
  await element(by.id('tab_queue')).tap();
  await element(by.id('tab_reflections')).tap();
  await waitFor(element(by.id('composer_shell'))).toBeVisible().withTimeout(15000);
  await captureStoreScreenshot(device, '01-organized-topic-home');
}

function configureStatusBar() {
  if (device.getPlatform() === 'ios') {
    run('xcrun', [
      'simctl',
      'status_bar',
      device.id,
      'override',
      '--time',
      '9:41',
      '--batteryState',
      'charged',
      '--batteryLevel',
      '100',
      '--wifiBars',
      '3',
      '--cellularBars',
      '4',
    ]);
    return;
  }

  run('adb', ['-s', device.id, 'shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1']);
  run('adb', [
    '-s', device.id, 'shell', 'am', 'broadcast',
    '-a', 'com.android.systemui.demo',
    '-e', 'command', 'clock',
    '-e', 'hhmm', '0941',
  ]);
  run('adb', [
    '-s', device.id, 'shell', 'am', 'broadcast',
    '-a', 'com.android.systemui.demo',
    '-e', 'command', 'battery',
    '-e', 'level', '100',
    '-e', 'plugged', 'true',
  ]);
}

async function openReflections() {
  await element(by.id('tab_reflections')).tap();
  await waitFor(element(by.id('composer_shell'))).toBeVisible().withTimeout(15000);
}

async function dismissDeviceReadinessNotice() {
  await waitFor(element(by.id('device_readiness_notice'))).toBeVisible().withTimeout(20000);
  await element(by.id('device_readiness_dismiss_button')).tap();
  await expect(element(by.id('device_readiness_notice'))).not.toExist();
}

async function disableLiteRt() {
  await element(by.id('tab_settings')).tap();
  await waitFor(element(by.id('switch_litert')))
    .toBeVisible()
    .whileElement(by.id('context_scroll'))
    .scroll(350, 'down');
  await expect(element(by.id('switch_litert'))).toHaveToggleValue(true);
  await element(by.id('switch_litert')).tap();
  await expect(element(by.id('switch_litert'))).toHaveToggleValue(false);
  await openReflections();
}

screenshotSuite('Store screenshots', () => {
  beforeAll(async () => {
    assertSafeTarget(device);
    if (device.getPlatform() === 'android') {
      setAndroidStoreScreenshotViewport(device);
      assert.equal(run('adb', ['-s', device.id, 'shell', 'pm', 'clear', androidAppId()]), 'Success');
    }
    await device.launchApp({
      newInstance: true,
      resetAppState: true,
    });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(20000);
    await finishFirstRunTutorialIfPresent();
    await waitFor(element(by.id('thought_input'))).toBeVisible().withTimeout(30000);
    await dismissDeviceReadinessNotice();
    configureStatusBar();
  });

  it('captures honest, deterministic primary product surfaces', async () => {
    if (device.getPlatform() === 'android') {
      await captureReadyAndroidHome();
      return;
    }

    await captureStoreScreenshot(device, '01-typed-thought-capture');

    await element(by.id('tab_import')).tap();
    await waitFor(element(by.id('import_text_input'))).toBeVisible().withTimeout(15000);
    await element(by.id('import_text_input')).tap();
    await element(by.id('import_text_input')).replaceText('Turn planning notes into a clear list of next steps.');
    if (device.getPlatform() === 'android') {
      await device.pressBack();
    }
    await element(by.id('import_analyze_button')).tap();
    await waitFor(element(by.id('import_submit_button'))).toExist().withTimeout(30000);
    await waitFor(element(by.id('import_submit_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(150, 'down', 0.5, 0.25);
    await captureStoreScreenshot(device, '02-paste-text-import');

    await element(by.id('tab_settings')).tap();
    await waitFor(element(by.id('model_select_button'))).toBeVisible().withTimeout(15000);
    if (device.getPlatform() === 'android') {
      await waitFor(element(by.id('switch_record')))
        .toBeVisible()
        .whileElement(by.id('context_scroll'))
        .scroll(350, 'down');
    }
    await captureStoreScreenshot(device, '03-on-device-ai-settings');

    // Start the fallback scene from clean app state so import-screen editing
    // cannot leave focus or navigation state behind for the capture journey.
    assertSafeTarget(device);
    await device.launchApp({
      newInstance: true,
      resetAppState: true,
    });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(20000);
    await finishFirstRunTutorialIfPresent();
    await waitFor(element(by.id('thought_input'))).toBeVisible().withTimeout(30000);
    await dismissDeviceReadinessNotice();
    await disableLiteRt();
    await waitFor(element(by.id('thought_input'))).toBeVisible().withTimeout(15000);
    await element(by.id('thought_input')).tap();
    await element(by.id('thought_input')).replaceText('Plan tomorrow around one meaningful priority');
    if (device.getPlatform() === 'android') {
      await device.pressBack();
    } else {
      await element(by.id('thought_input')).tapReturnKey();
    }
    await element(by.id('save_button')).tap();
    await waitFor(element(by.text('Inbox'))).toBeVisible().withTimeout(30000);
    await element(by.id('tab_queue')).tap();
    await element(by.id('tab_reflections')).tap();
    await waitFor(element(by.text('Inbox'))).toBeVisible().withTimeout(15000);
    await captureStoreScreenshot(device, '04-inbox-fallback');
  });

  afterAll(() => {
    restoreAndroidStoreScreenshotViewport(device);
  });
});
