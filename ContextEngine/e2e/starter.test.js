const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const simulatorId = '8925E43D-367D-4333-998D-741240F3425F';

function getAppDataPath() {
  return execSync(`xcrun simctl get_app_container ${simulatorId} com.meharaj.contextengine data`, {
    encoding: 'utf8',
  }).trim();
}

function readPersistedContext() {
  const appDataPath = getAppDataPath();
  return fs.readFileSync(path.join(appDataPath, 'Documents', 'context.md'), 'utf8');
}

async function waitForPersistedContextEntry(expectedText, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const persisted = readPersistedContext();
      if (persisted.includes(expectedText)) {
        return;
      }
    } catch (error) {
      // Keep polling until the app commits the note document.
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for persisted text: ${expectedText}`);
}

describe('Context Engine E2E', () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: { microphone: 'YES' },
      newInstance: true,
    });
  });

  it('shows the reflections home shell', async () => {
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(15000);
    await expect(element(by.text('Context Engine'))).toBeVisible();
    await expect(element(by.id('model_prompt_card'))).toBeVisible();
    await expect(element(by.id('model_prompt_install_button'))).toBeVisible();
  });

  it('saves a manual thought into the local context file', async () => {
    const testThought = `Detox save check ${Date.now()}`;

    await waitFor(element(by.id('thought_input')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(300, 'down');

    await element(by.id('thought_input')).tap();
    await element(by.id('thought_input')).replaceText(testThought);
    await element(by.id('save_button')).tap();

    await waitForPersistedContextEntry(testThought);
  });
});
