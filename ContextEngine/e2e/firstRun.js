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

async function finishFirstRunTutorialIfPresent() {
  const tutorial = element(by.id('first_run_tutorial'));
  try {
    await waitFor(tutorial).toExist().withTimeout(10000);
  } catch {
    return;
  }

  if (device.getPlatform() === 'android') {
    await waitFor(element(by.id('first_run_skip'))).toBeVisible().withTimeout(10000);
    await tapAndroidElement('first_run_skip');
  } else {
    await element(by.id('first_run_skip')).tap();
  }
  await waitFor(tutorial).not.toExist().withTimeout(10000);
}

module.exports = { finishFirstRunTutorialIfPresent, tapAndroidElement };
