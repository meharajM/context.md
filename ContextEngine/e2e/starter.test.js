const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const APP_ID = 'com.meharaj.contextengine';
const TOPICS_RELATIVE_PATH = 'files/topics';

function runCommand(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
  }).trim();
}

function readIosTopicFiles() {
  const appDataPath = runCommand('xcrun', [
    'simctl',
    'get_app_container',
    device.id,
    APP_ID,
    'data',
  ]);
  const topicsDirectory = path.join(appDataPath, 'Documents', 'topics');

  if (!fs.existsSync(topicsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(topicsDirectory)
    .filter(fileName => fileName.endsWith('.md'))
    .map(fileName => ({
      fileName,
      content: fs.readFileSync(path.join(topicsDirectory, fileName), 'utf8'),
    }));
}

function readAndroidTopicFiles() {
  let listing = '';

  try {
    listing = runCommand('adb', [
      '-s',
      device.id,
      'shell',
      'run-as',
      APP_ID,
      'ls',
      TOPICS_RELATIVE_PATH,
    ]);
  } catch {
    return [];
  }

  return listing
    .split(/\r?\n/)
    .map(fileName => fileName.trim())
    .filter(fileName => /^[a-z0-9][a-z0-9.-]*\.md$/i.test(fileName))
    .map(fileName => {
      return {
        fileName,
        content: runCommand('adb', [
          '-s',
          device.id,
          'shell',
          'run-as',
          APP_ID,
          'cat',
          `${TOPICS_RELATIVE_PATH}/${fileName}`,
        ]),
      };
    });
}

function readPersistedTopicFiles() {
  const files = device.getPlatform() === 'ios'
    ? readIosTopicFiles()
    : readAndroidTopicFiles();

  return files.map(file => ({
    ...file,
    header: file.content.match(/^#\s+(.+)$/m)?.[1] || file.fileName.replace(/\.md$/, ''),
  }));
}

function readPersistedContext() {
  return readPersistedTopicFiles()
    .map(file => file.content)
    .join('\n\n');
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

function countPersistedEntries() {
  return readPersistedContext().match(/^\s*-\s\[/gm)?.length ?? 0;
}

async function waitForPersistedEntryCount(minimumCount, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (countPersistedEntries() >= minimumCount) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for persisted entry count >= ${minimumCount}`);
}

function findNoteIdForText(expectedText) {
  for (const file of readPersistedTopicFiles()) {
    const entry = file.content
      .split(/(?=^-\s+\[)/m)
      .find(candidate => candidate.includes(expectedText));
    const noteId = entry?.match(/^\s*Note id:\s*(.+)$/im)?.[1]?.trim();
    if (noteId) {
      return noteId;
    }
  }

  return null;
}

async function waitForPersistedNoteId(noteId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (readPersistedContext().includes(`Note id: ${noteId}`)) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for persisted note id: ${noteId}`);
}

async function launchApp({ resetAppState = false } = {}) {
  await device.launchApp({
    permissions: { microphone: 'YES' },
    newInstance: true,
    resetAppState,
  });
  await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(20000);
}

async function openReflections() {
  await waitFor(element(by.id('tab_reflections'))).toBeVisible().withTimeout(15000);
  await element(by.id('tab_reflections')).tap();
  await waitFor(element(by.id('composer_shell'))).toBeVisible().withTimeout(15000);
}

async function disableLiteRt() {
  await waitFor(element(by.id('tab_settings'))).toBeVisible().withTimeout(15000);
  await element(by.id('tab_settings')).tap();
  await waitFor(element(by.id('switch_litert')))
    .toBeVisible()
    .whileElement(by.id('context_scroll'))
    .scroll(300, 'down');
  await expect(element(by.id('switch_litert'))).toHaveToggleValue(true);
  await element(by.id('switch_litert')).tap();
  await expect(element(by.id('switch_litert'))).toHaveToggleValue(false);
  await openReflections();
}

async function saveManualThought(text) {
  await waitFor(element(by.id('thought_input')))
    .toBeVisible()
    .whileElement(by.id('context_scroll'))
    .scroll(300, 'down');
  await element(by.id('thought_input')).tap();
  await element(by.id('thought_input')).replaceText(text);
  await element(by.id('thought_input')).tapReturnKey();
  await element(by.id('save_button')).tap();
}

describe('Context Engine E2E', () => {
  beforeEach(async () => {
    await launchApp({ resetAppState: true });
  });

  it('shows the reflections home shell', async () => {
    await expect(element(by.text('Context Engine'))).toBeVisible();
    await expect(element(by.text("What's on your mind?"))).toBeVisible();
    await expect(element(by.id('composer_shell'))).toBeVisible();
  });

  it('saves a manual thought into the local context file', async () => {
    const testThought = `Detox save check ${Date.now()}`;

    await disableLiteRt();
    await saveManualThought(testThought);
    await waitForPersistedContextEntry(testThought);
    assert.equal(countPersistedEntries(), 1);
  });

  it('imports text and the bundled voice sample through the shared UI', async () => {
    const topicName = `Detox Import Topic ${Date.now()}`;
    const textImport = `Detox import text ${Date.now()}`;
    const baselineEntries = 0;

    // Keep this journey deterministic and exercise the durable raw fallback
    // contract instead of waiting for an optional simulator model inference.
    await disableLiteRt();
    await waitFor(element(by.id('tab_import'))).toBeVisible().withTimeout(15000);
    await element(by.id('tab_import')).tap();

    await waitFor(element(by.id('import_topic_input')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(200, 'down');

    await element(by.id('import_topic_input')).tap();
    await element(by.id('import_topic_input')).replaceText(topicName);
    await element(by.id('import_text_input')).tap();
    await element(by.id('import_text_input')).replaceText(textImport);
    await waitFor(element(by.id('import_analyze_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(250, 'down');
    await element(by.id('import_analyze_button')).tap();
    await waitFor(element(by.id('import_submit_button'))).toExist().withTimeout(30000);
    await waitFor(element(by.id('import_submit_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(250, 'down');
    await element(by.id('import_submit_button')).tap();

    await waitForPersistedContextEntry(textImport);
    const afterTextEntries = countPersistedEntries();
    assert.equal(afterTextEntries, baselineEntries + 1);

    await element(by.id('tab_reflections')).tap();
    await waitFor(element(by.id('tab_import'))).toBeVisible().withTimeout(15000);
    await element(by.id('tab_import')).tap();

    await element(by.id('import_topic_input')).tap();
    await element(by.id('import_topic_input')).replaceText(topicName);
    await waitFor(element(by.id('import_source_voice_button'))).toBeVisible().withTimeout(15000);
    await element(by.id('import_source_voice_button')).tap();
    await element(by.id('import_voice_sample_button')).tap();

    await waitFor(element(by.id('import_analyze_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(250, 'down');
    await element(by.id('import_analyze_button')).tap();
    await waitFor(element(by.id('import_submit_button'))).toExist().withTimeout(30000);
    await waitFor(element(by.id('import_submit_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(250, 'down');
    await element(by.id('import_submit_button')).tap();

    await waitForPersistedEntryCount(afterTextEntries + 1);
  });

  it('retains a raw Inbox fallback across a process relaunch', async () => {
    const fallbackThought = `Detox durable fallback ${Date.now()}`;

    await disableLiteRt();
    await saveManualThought(fallbackThought);
    await waitForPersistedContextEntry(fallbackThought);

    const noteId = findNoteIdForText(fallbackThought);
    assert.ok(noteId, 'Expected the raw Inbox entry to have a durable note id');
    assert.equal(
      readPersistedTopicFiles().some(file => file.header.trim().toLowerCase() === 'inbox'),
      true,
    );

    await launchApp();
    await waitForPersistedNoteId(noteId);
    await waitForPersistedContextEntry(fallbackThought);
  });
});
