const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

async function captureStoreScreenshot(name) {
  // Native route/layout transitions can outlive Detox's JS-idle signal.
  // Capture only the settled product surface.
  await new Promise(resolve => setTimeout(resolve, 750));

  const platform = device.getPlatform();
  const deviceClass = process.env.STORE_SCREENSHOT_DEVICE_CLASS || (platform === 'ios' ? 'iphone' : 'phone');
  const sourcePath = await device.takeScreenshot(`store-${platform}-${name}`);
  const outputDirectory = path.resolve(
    __dirname,
    '..',
    platform === 'ios' ? 'ios/store-assets/screenshots' : 'android/store-assets/screenshots',
  );
  const outputPath = path.join(outputDirectory, `${deviceClass}-${name}.jpg`);
  fs.mkdirSync(outputDirectory, { recursive: true });

  if (platform === 'android') {
    // Google Play requires the longest screenshot edge to be no more than twice the shortest.
    // Remove system chrome while preserving the app header and tab bar.
    run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', sourcePath,
      '-vf', 'crop=1080:2160:0:50',
      '-q:v', '2',
      outputPath,
    ]);
  } else {
    // Simulator PNGs include an alpha channel. App Store Connect rejects alpha,
    // so encode a maximum-quality JPEG as the final upload artifact.
    run('sips', [
      '--setProperty', 'format', 'jpeg',
      '--setProperty', 'formatOptions', 'best',
      sourcePath,
      '--out', outputPath,
    ]);
  }
}

async function openReflections() {
  await element(by.id('tab_reflections')).tap();
  await waitFor(element(by.id('composer_shell'))).toBeVisible().withTimeout(15000);
}

async function disableLiteRt() {
  await element(by.id('tab_settings')).tap();
  await waitFor(element(by.id('switch_litert')))
    .toBeVisible()
    .whileElement(by.id('context_scroll'))
    .scroll(350, 'down');
  await element(by.id('switch_litert')).tap();
  await openReflections();
}

screenshotSuite('Store screenshots', () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: { microphone: 'YES' },
      newInstance: true,
      resetAppState: true,
    });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.text('Ready to capture'))).toBeVisible().withTimeout(30000);
    configureStatusBar();
  });

  it('captures honest, deterministic primary product surfaces', async () => {
    await captureStoreScreenshot('01-private-capture-home');

    await element(by.id('tab_import')).tap();
    await waitFor(element(by.id('import_text_input'))).toBeVisible().withTimeout(15000);
    await captureStoreScreenshot('02-local-text-and-voice-import');

    await element(by.id('tab_settings')).tap();
    await waitFor(element(by.id('model_select_button'))).toBeVisible().withTimeout(15000);
    await captureStoreScreenshot('03-on-device-settings');

    await disableLiteRt();
    await waitFor(element(by.id('thought_input'))).toBeVisible().withTimeout(15000);
    await element(by.id('thought_input')).tap();
    await element(by.id('thought_input')).replaceText('Plan tomorrow around one meaningful priority');
    await element(by.id('thought_input')).tapReturnKey();
    await element(by.id('save_button')).tap();
    await waitFor(element(by.text('Inbox'))).toBeVisible().withTimeout(30000);
    await captureStoreScreenshot('04-durable-organized-inbox');
  });
});
