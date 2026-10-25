const { execFileSync } = require('child_process');
const { captureStoreScreenshot } = require('./storeScreenshot');

const shouldCapture = process.env.CAPTURE_STORE_SCREENSHOTS === '1';
const screenshotSuite = shouldCapture ? describe : describe.skip;

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
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
    await device.launchApp({
      newInstance: true,
      resetAppState: true,
    });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('thought_input'))).toBeVisible().withTimeout(30000);
    await dismissDeviceReadinessNotice();
    configureStatusBar();
  });

  it('captures honest, deterministic primary product surfaces', async () => {
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
    await device.launchApp({
      newInstance: true,
      resetAppState: true,
    });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(20000);
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
});
