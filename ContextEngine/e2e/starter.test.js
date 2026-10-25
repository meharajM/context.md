const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { captureStoreScreenshot } = require('./storeScreenshot');

if (process.env.CAPTURE_STORE_SCREENSHOTS === '1' && !process.env.CONTEXTENGINE_MODEL_PATH) {
  throw new Error('Set CONTEXTENGINE_MODEL_PATH to the verified Gemma3 model before capturing the synthesized Play screenshot.');
}

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
    .flatMap(fileName => {
      try {
        return [{
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
        }];
      } catch {
        // A successful synthesis can move the final Inbox note while this
        // snapshot is being read. Skip files removed between ls and cat.
        return [];
      }
    });
}

function readAndroidRetainedAudioNames() {
  try {
    return runCommand('adb', [
      '-s', device.id, 'shell', 'run-as', APP_ID, 'ls', 'files/retained-audio',
    ]).split(/\r?\n/).map(name => name.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function readAndroidRetainedAudio(relativePath) {
  return execFileSync('adb', [
    '-s', device.id, 'exec-out', 'run-as', APP_ID, 'cat', relativePath,
  ]);
}

async function waitForAndroidRetainedRecording() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    for (const name of readAndroidRetainedAudioNames()) {
      if (!name.endsWith('.wav')) continue;
      const output = readAndroidRetainedAudio(`files/retained-audio/${name}`);
      if (output.length > 44) return { name, output };
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Recording did not write PCM data into retained audio storage');
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

function noteIdFromEntry(entry) {
  const encoded = entry.match(/^\s*-\s+\[[^\]]+\]\s+<!-- thought-note:v2 (.*?) -->/m);
  if (encoded) {
    try {
      return JSON.parse(encoded[1]).noteId ?? null;
    } catch {
      return null;
    }
  }
  return entry.match(/^\s{2}Note id:\s*(.+)$/im)?.[1]?.trim() ?? null;
}

function fileContainsNoteId(file, noteId) {
  return file.content.split(/(?=^-\s+\[)/m).some(entry => noteIdFromEntry(entry) === noteId);
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
    const noteId = entry ? noteIdFromEntry(entry) : null;
    if (noteId) {
      return noteId;
    }
  }

  return null;
}

async function waitForPersistedNoteId(noteId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (readPersistedTopicFiles().some(file => fileContainsNoteId(file, noteId))) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for persisted note id: ${noteId}`);
}

async function launchApp({ resetAppState = false } = {}) {
  await device.launchApp({
    newInstance: true,
    resetAppState,
  });
  await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(20000);
}

async function dismissKeyboard() {
  if (device.getPlatform() === 'ios') {
    await waitFor(element(by.id('keyboard_done_button'))).toBeVisible().withTimeout(10000);
    await element(by.id('keyboard_done_button')).tap();
    await waitFor(element(by.id('keyboard_done_button'))).not.toExist().withTimeout(10000);
  } else {
    await device.pressBack();
  }
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
  await waitFor(element(by.id('save_button'))).toBeVisible().withTimeout(10000);
  await element(by.id('save_button')).tap();
}

describe('Thought Notes E2E', () => {
  beforeEach(async () => {
    if (device.getPlatform() === 'android') {
      runCommand('adb', ['-s', device.id, 'shell', 'pm', 'clear', APP_ID]);
      await launchApp({ resetAppState: false });
    } else {
      await launchApp({ resetAppState: true });
    }
  });

  it('shows the reflections home shell', async () => {
    await expect(element(by.text('Thought Notes'))).toBeVisible();
    await expect(element(by.text("What's on your mind?"))).toBeVisible();
    await expect(element(by.id('device_readiness_notice'))).toBeVisible();
    await expect(element(by.text('Phone check'))).toBeVisible();
    await element(by.id('device_readiness_dismiss_button')).tap();
    await expect(element(by.id('device_readiness_notice'))).not.toExist();
    await expect(element(by.id('composer_shell'))).toBeVisible();
    if (device.getPlatform() === 'android') {
      await expect(element(by.id('record_button'))).toBeVisible();
    } else {
      await expect(element(by.id('record_button'))).not.toExist();
    }
  });

  const androidOnly = device.getPlatform() === 'android' ? it : it.skip;
  androidOnly('transcribes the bundled speech sample with the installed Whisper model', async () => {
    await element(by.id('tab_settings')).tap();
    await waitFor(element(by.id('whisper_sample_probe')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(250, 'down');
    const probe = element(by.id('whisper_sample_probe'));
    const readinessDeadline = Date.now() + 120000;
    while (Date.now() < readinessDeadline) {
      if ((await probe.getAttributes()).enabled) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.equal((await probe.getAttributes()).enabled, true, 'Whisper model did not become ready');
    await element(by.id('whisper_sample_probe')).tap();
    await waitFor(element(by.id('whisper_sample_result')))
      .toHaveText(/.*(fellow citizens|my fellow Americans|ask not what your country can do).*/i)
      .withTimeout(120000);
  });

  it('saves a manual thought into the local context file', async () => {
    const testThought = `Detox save check ${Date.now()}`;

    await disableLiteRt();
    await saveManualThought(testThought);
    await waitForPersistedContextEntry(testThought);
    assert.equal(countPersistedEntries(), 1);
  });

  it('keeps unsaved Home and Import drafts while switching routes', async () => {
    const homeDraft = `Home draft after navigation ${Date.now()}`;
    const importDraft = `Import draft after navigation ${Date.now()}`;

    await disableLiteRt();
    await waitFor(element(by.id('thought_input')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(300, 'down');
    await element(by.id('thought_input')).tap();
    await element(by.id('thought_input')).replaceText(homeDraft);
    await dismissKeyboard();
    await element(by.id('tab_queue')).tap();
    await element(by.id('tab_reflections')).tap();
    await element(by.id('save_button')).tap();
    await waitForPersistedContextEntry(homeDraft);

    await element(by.id('tab_import')).tap();
    await waitFor(element(by.id('import_text_input')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(200, 'down');
    await element(by.id('import_text_input')).tap();
    await element(by.id('import_text_input')).replaceText(importDraft);
    await dismissKeyboard();
    await element(by.id('tab_queue')).tap();
    await element(by.id('tab_import')).tap();
    await waitFor(element(by.id('import_analyze_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(150, 'down', 0.5, 0.25);
    await element(by.id('import_analyze_button')).tap();
    await waitFor(element(by.id('import_submit_button'))).toExist().withTimeout(30000);
    await waitFor(element(by.id('import_submit_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(150, 'down', 0.5, 0.25);
    await element(by.id('import_submit_button')).tap();
    await waitForPersistedContextEntry(importDraft);
  });

  it('imports typed text through the shared UI', async () => {
    const topicName = `Detox Import Topic ${Date.now()}`;
    const staleText = `Stale import preview ${Date.now()}`;
    const textImport = `Detox import text ${Date.now()}\nSecond line stays attached.\n- [2020-01-01] literal text\nNote id: body text`;
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
    await dismissKeyboard();
    await waitFor(element(by.id('import_text_input')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(200, 'down');
    await element(by.id('import_text_input')).tap();
    await element(by.id('import_text_input')).replaceText(staleText);
    await dismissKeyboard();
    await waitFor(element(by.id('import_analyze_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(150, 'down', 0.5, 0.25);
    await element(by.id('import_analyze_button')).tap();
    await waitFor(element(by.id('import_submit_button'))).toExist().withTimeout(30000);

    await waitFor(element(by.id('import_text_input')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(200, 'down');
    await element(by.id('import_text_input')).tap();
    await element(by.id('import_text_input')).replaceText(textImport);
    await dismissKeyboard();
    await expect(element(by.id('import_submit_button'))).not.toExist();
    await waitFor(element(by.id('import_analyze_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(150, 'down', 0.5, 0.25);
    await element(by.id('import_analyze_button')).tap();
    await waitFor(element(by.id('import_submit_button'))).toExist().withTimeout(30000);
    await waitFor(element(by.id('import_submit_button')))
      .toBeVisible()
      .whileElement(by.id('context_scroll'))
      .scroll(150, 'down', 0.5, 0.25);
    await element(by.id('import_submit_button')).tap();

    await waitForPersistedContextEntry(textImport.split('\n')[0]);
    const afterTextEntries = countPersistedEntries();
    assert.equal(afterTextEntries, baselineEntries + 1);
    const imported = readPersistedTopicFiles().find(file => file.content.includes(textImport.split('\n')[0]));
    assert.ok(imported, 'The imported note should be stored in its topic');
    assert.match(imported.content, /\| Second line stays attached\./);
    assert.match(imported.content, /\| - \[2020-01-01\] literal text/);
    assert.match(imported.content, /\| Note id: body text/);

    await expect(element(by.id('import_source_voice_button'))).not.toExist();

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

  androidOnly('recovers an in-progress recording after Android kills the app process', async () => {
    await disableLiteRt();
    runCommand('adb', ['-s', device.id, 'shell', 'pm', 'grant', APP_ID, 'android.permission.RECORD_AUDIO']);
    runCommand('adb', ['-s', device.id, 'shell', 'pm', 'grant', APP_ID, 'android.permission.BLUETOOTH_CONNECT']);
    runCommand('adb', ['-s', device.id, 'shell', 'pm', 'grant', APP_ID, 'android.permission.POST_NOTIFICATIONS']);

    const recordButton = element(by.id('record_button'));
    const readyDeadline = Date.now() + 120000;
    while (Date.now() < readyDeadline) {
      const attributes = await recordButton.getAttributes();
      if (attributes.enabled && attributes.label === 'Record a voice note') break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const ready = await recordButton.getAttributes();
    assert.equal(ready.enabled, true, 'Voice recording must be ready before the process-death journey');
    let recording;
    let appStopped = false;
    await device.disableSynchronization();
    try {
      await recordButton.tap();
      await waitFor(recordButton).toHaveLabel('Stop recording').withTimeout(20000);
      recording = await waitForAndroidRetainedRecording();
      assert.ok(readAndroidRetainedAudioNames().includes(`${recording.name}.capture.json`));

      runCommand('adb', ['-s', device.id, 'shell', 'am', 'force-stop', APP_ID]);
      appStopped = true;
      // Launching a new app instance restores Detox synchronization.
      await launchApp();
    } finally {
      if (!appStopped) runCommand('adb', ['-s', device.id, 'shell', 'am', 'force-stop', APP_ID]);
    }
    await waitForPersistedContextEntry('Voice capture retained', 30000);

    const recovered = readPersistedTopicFiles()
      .flatMap(file => file.content.split(/(?=^-\s+\[)/m).map(entry => ({ file, entry })))
      .find(({ entry }) => entry.includes('Voice capture retained'));
    assert.ok(recovered, 'The interrupted recording should create an Inbox note');
    assert.equal(recovered.file.header.toLowerCase(), 'inbox');
    const encoded = recovered.entry.match(/^\s*-\s+\[[^\]]+\]\s+<!-- thought-note:v2 (.*?) -->/m);
    assert.ok(encoded, 'Recovered recording must keep stable note metadata');
    const metadata = JSON.parse(encoded[1]);
    assert.match(metadata.noteId, /^voice-retained-/);
    assert.match(metadata.sourceMetadata.audioFilePath, /contextengine-retained-.*\.wav$/);
    assert.ok(!readAndroidRetainedAudioNames().includes(`${recording.name}.capture.json`), 'Recovery should acknowledge only after Inbox persistence');

    const recoveredAudio = readAndroidRetainedAudio(`files/retained-audio/${recording.name}`);
    assert.equal(recoveredAudio.toString('ascii', 0, 4), 'RIFF');
    assert.equal(recoveredAudio.readUInt32LE(4), recoveredAudio.length - 8);
    assert.equal(recoveredAudio.readUInt32LE(40), recoveredAudio.length - 44);
  }, 180000);

  const liveModelTest = process.env.CONTEXTENGINE_MODEL_PATH ? it : it.skip;
  liveModelTest('synthesizes a typed note with the real model and files it outside Inbox', async () => {
    const modelPath = path.resolve(process.env.CONTEXTENGINE_MODEL_PATH);
    assert.equal(fs.statSync(modelPath).size, 584417280, 'Use the complete recommended Gemma3 model');
    const sha256 = require('crypto').createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex');
    assert.equal(sha256, '1325ae366d31950f137c9c357b9fa89448b176d76998180c08ceaca78bba98be');
    const manifest = JSON.stringify({ 'gemma3-1b-it': {
      installedAt: new Date().toISOString(), file: 'gemma3-1b-it-int4.litertlm',
      size: 584417280, sha256, verified: true, license: 'gemma',
      sourceUrl: 'https://huggingface.co/lotapa/gemma3-1b-it-int4.litertlm/resolve/main/gemma3-1b-it-int4.litertlm?download=1',
    } });
    await device.terminateApp();
    if (device.getPlatform() === 'android') {
      runCommand('adb', ['-s', device.id, 'push', modelPath, '/data/local/tmp/contextengine-gemma.litertlm']);
      runCommand('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'mkdir', '-p', 'files/models']);
      runCommand('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'cp',
        '/data/local/tmp/contextengine-gemma.litertlm', 'files/models/gemma3-1b-it-int4.litertlm']);
      const manifestPath = path.join(path.dirname(modelPath), 'manifest.json');
      fs.writeFileSync(manifestPath, manifest);
      runCommand('adb', ['-s', device.id, 'push', manifestPath, '/data/local/tmp/contextengine-manifest.json']);
      runCommand('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'cp',
        '/data/local/tmp/contextengine-manifest.json', 'files/models/manifest.json']);
    } else {
      const container = runCommand('xcrun', ['simctl', 'get_app_container', device.id, APP_ID, 'data']);
      const modelsDirectory = path.join(container, 'Documents', 'models');
      fs.mkdirSync(modelsDirectory, { recursive: true });
      fs.copyFileSync(modelPath, path.join(modelsDirectory, 'gemma3-1b-it-int4.litertlm'));
      fs.writeFileSync(path.join(modelsDirectory, 'manifest.json'), manifest);
    }
    await launchApp();
    await device.disableSynchronization();
    const thought = 'Remember to send the Acme client invoice tomorrow morning.';
    await saveManualThought(thought);
    await waitForPersistedContextEntry(thought);
    const noteId = findNoteIdForText(thought);
    assert.ok(noteId, 'Capture must persist before synthesis');
    const deadline = Date.now() + 120000;
    let categorized;
    while (Date.now() < deadline) {
      categorized = readPersistedTopicFiles().find(file =>
        file.header.toLowerCase() !== 'inbox' && fileContainsNoteId(file, noteId));
      const inboxSourceExists = readPersistedTopicFiles().some(file =>
        file.header.toLowerCase() === 'inbox' && fileContainsNoteId(file, noteId));
      if (categorized && !inboxSourceExists) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.ok(categorized, 'Real inference must file the note outside Inbox; fallback does not count');
    assert.match(categorized.content, /invoice/i);
    assert.ok(!readPersistedTopicFiles().some(file =>
      file.header.toLowerCase() === 'inbox' && fileContainsNoteId(file, noteId)),
    'Only remove the Inbox source after categorized persistence');
    await launchApp();
    await waitForPersistedNoteId(noteId);
    await waitFor(element(by.text(/.*Organized into .*/))).toBeVisible().withTimeout(30000);
    if (device.getPlatform() === 'android' && process.env.CAPTURE_STORE_SCREENSHOTS === '1') {
      await captureStoreScreenshot(device, '05-synthesized-context');
    }
    await device.enableSynchronization();
  }, 180000);
});
