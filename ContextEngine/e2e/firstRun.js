const { execFileSync } = require('child_process');

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

async function tapAndroidElement(testID) {
  const xmlPath = '/sdcard/contextengine-first-run-window.xml';
  run('adb', ['-s', device.id, 'shell', 'uiautomator', 'dump', xmlPath]);
  const hierarchy = run('adb', ['-s', device.id, 'shell', 'cat', xmlPath]);
  const escapedID = testID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = hierarchy.match(new RegExp(`resource-id="${escapedID}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!match) throw new Error(`Visible Android control not found: ${testID}`);

  const x = Math.round((Number(match[1]) + Number(match[3])) / 2);
  const y = Math.round((Number(match[2]) + Number(match[4])) / 2);
  run('adb', ['-s', device.id, 'shell', 'input', 'tap', String(x), String(y)]);
}

async function waitForVoiceReady() {
  const recordButton = element(by.id('record_button'));
  await waitFor(recordButton).toBeVisible().withTimeout(10000);
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      if ((await recordButton.getAttributes()).enabled) return;
    } catch {
      // Native model download can briefly re-render the capture controls.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Voice model did not become ready during the E2E first-run flow');
}

async function finishFirstRunTutorialIfPresent() {
  const tutorial = element(by.id('first_run_tutorial'));
  try {
    await waitFor(tutorial).toExist().withTimeout(10000);
  } catch {
    return;
  }

  if (device.getPlatform() === 'android') {
    await waitFor(element(by.id('first_run_skip'))).toBeVisible().withTimeout(10000);
    await waitForVoiceReady();
    await tapAndroidElement('first_run_skip');
  } else {
    await element(by.id('first_run_skip')).tap();
  }
  await waitFor(tutorial).not.toExist().withTimeout(10000);
}

module.exports = { finishFirstRunTutorialIfPresent, tapAndroidElement, waitForVoiceReady };
