async function tapAndroidElement(testID) {
  await element(by.id(testID)).tap();
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
