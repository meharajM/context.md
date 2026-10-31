const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { androidAppId, assertSafeTarget } = require('./appTarget');
const { finishFirstRunTutorialIfPresent } = require('./firstRun');
const APP_ID = androidAppId();
const MODEL_PATH = process.env.CONTEXTENGINE_MODEL_PATH || path.resolve(__dirname, '../artifacts/text-release-qa/gemma3-1b-it-int4.litertlm');
const MANIFEST_PATH = path.join(path.dirname(MODEL_PATH), 'manifest.json');

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function installVerifiedModel() {
  const model = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))['gemma3-1b-it'];
  assert.equal(fs.statSync(MODEL_PATH).size, 584417280);
  assert.equal(model.verified, true);
  assert.equal(run('shasum', ['-a', '256', MODEL_PATH]).split(/\s+/)[0], model.sha256);
  run('adb', ['-s', device.id, 'push', MODEL_PATH, '/data/local/tmp/contextengine-reminder-model.litertlm']);
  run('adb', ['-s', device.id, 'push', MANIFEST_PATH, '/data/local/tmp/contextengine-reminder-manifest.json']);
  run('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'mkdir', '-p', 'files/models', 'no_backup']);
  run('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'cp', '/data/local/tmp/contextengine-reminder-model.litertlm', 'files/models/gemma3-1b-it-int4.litertlm']);
  run('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'cp', '/data/local/tmp/contextengine-reminder-manifest.json', 'files/models/manifest.json']);
}

function topicFiles() {
  let names;
  try {
    names = run('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'ls', 'files/topics']).split(/\r?\n/);
  } catch {
    return [];
  }
  return names.filter(name => /^[a-z0-9][a-z0-9.-]*\.md$/i.test(name)).flatMap(name => {
    try {
      return [{ name, text: run('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'cat', `files/topics/${name}`]) }];
    } catch {
      return [];
    }
  });
}

function savedNote(text) {
  for (const file of topicFiles()) {
    const entry = file.text.split(/(?=^-\s+\[)/m).find(value => value.includes(text));
    const metadata = entry?.match(/<!-- thought-note:v2 (.*?) -->/m)?.[1];
    if (metadata) return JSON.parse(metadata);
  }
  return null;
}

function reminderState() {
  try {
    return JSON.parse(run('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'cat', 'files/automatic-reminders.json']));
  } catch {
    return { enabled: false, enabledAt: 0, records: [] };
  }
}

async function waitForNote(text, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const note = savedNote(text);
    if (note) return note;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for saved note: ${text}`);
}

async function enterNote(text) {
  await waitFor(element(by.id('thought_input'))).toBeVisible().withTimeout(15000);
  await element(by.id('thought_input')).tap();
  await element(by.id('thought_input')).replaceText(text);
  const inputState = run('adb', ['-s', device.id, 'shell', 'dumpsys', 'input_method']);
  if (inputState.includes('mInputShown=true')) run('adb', ['-s', device.id, 'shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  await waitFor(element(by.id('save_button'))).toBeVisible().withTimeout(10000);
  run('adb', ['-s', device.id, 'shell', 'uiautomator', 'dump', '/sdcard/automatic-reminder-window.xml']);
  const hierarchy = run('adb', ['-s', device.id, 'shell', 'cat', '/sdcard/automatic-reminder-window.xml']);
  const bounds = hierarchy.match(/resource-id="save_button"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  assert.ok(bounds, 'The visible Save note button must have screen bounds');
  const x = Math.round((Number(bounds[1]) + Number(bounds[3])) / 2);
  const y = Math.round((Number(bounds[2]) + Number(bounds[4])) / 2);
  run('adb', ['-s', device.id, 'shell', 'input', 'tap', String(x), String(y)]);
  return waitForNote(text);
}

async function tapSystemButton(resourceId) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    run('adb', ['-s', device.id, 'shell', 'uiautomator', 'dump', '/sdcard/automatic-reminder-window.xml']);
    const hierarchy = run('adb', ['-s', device.id, 'shell', 'cat', '/sdcard/automatic-reminder-window.xml']);
    const escapedId = resourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bounds = hierarchy.match(new RegExp(`resource-id="${escapedId}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
    if (bounds) {
      const x = Math.round((Number(bounds[1]) + Number(bounds[3])) / 2);
      const y = Math.round((Number(bounds[2]) + Number(bounds[4])) / 2);
      run('adb', ['-s', device.id, 'shell', 'input', 'tap', String(x), String(y)]);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`System permission button not found: ${resourceId}`);
}

const androidOnly = device.getPlatform() === 'android' ? it : it.skip;

describe('Android automatic reminders user journey', () => {
  androidOnly('infers a new task locally, schedules it, and cancels reminders without deleting notes', async () => {
    assertSafeTarget(device);
    assert.equal(run('adb', ['-s', device.id, 'shell', 'pm', 'clear', APP_ID]), 'Success');
    installVerifiedModel();

    await device.launchApp({ newInstance: true, resetAppState: false });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(30000);
    await finishFirstRunTutorialIfPresent();
    await element(by.id('tab_settings')).tap();

    const modelSwitch = element(by.id('switch_litert'));
    await waitFor(modelSwitch).toBeVisible().whileElement(by.id('context_scroll')).scroll(300, 'down');
    await expect(modelSwitch).toHaveToggleValue(true);
    const remindersSwitch = element(by.id('switch_automatic_reminders'));
    await waitFor(remindersSwitch).toBeVisible().whileElement(by.id('context_scroll')).scroll(350, 'down');
    await expect(remindersSwitch).toHaveToggleValue(false);

    const oldText = 'Buy eggs today';
    await element(by.id('tab_reflections')).tap();
    const oldNote = await enterNote(oldText);
    assert.equal(reminderState().records.length, 0, 'Reminders must stay off until the user enables them');

    await element(by.id('tab_settings')).tap();
    await waitFor(remindersSwitch).toBeVisible().whileElement(by.id('context_scroll')).scroll(700, 'down');
    const notificationPermission = run('adb', ['-s', device.id, 'shell', 'dumpsys', 'package', APP_ID]);
    const needsNotificationPermission = /android\.permission\.POST_NOTIFICATIONS: granted=false/.test(notificationPermission);
    await element(by.id('switch_automatic_reminders')).tap();
    if (needsNotificationPermission) {
      await tapSystemButton('com.android.permissioncontroller:id/permission_allow_button');
    }
    await expect(remindersSwitch).toHaveToggleValue(true);
    const enabledState = reminderState();
    assert.equal(enabledState.enabled, true);
    assert.equal(enabledState.records.length, 0, 'Notes captured before opt-in must not be scheduled');

    const taskText = 'Buy milk today';
    await element(by.id('tab_reflections')).tap();
    const note = await enterNote(taskText);
    assert.ok(Date.parse(note.createdAt) >= enabledState.enabledAt, 'Reminder must belong to a note captured after opt-in');

    let record;
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      record = reminderState().records.find(item => item.noteId === note.noteId);
      if (record?.inferredWithAi) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.equal(record?.status, 'scheduled', 'The task should produce a scheduled reminder');
    assert.equal(record.inferredWithAi, true, 'The installed on-device model should classify the task');
    assert.match(record.title, /milk/i);
    assert.equal(record.category, 'shopping');
    assert.equal(record.priority, 'normal');
    assert.ok(record.fireAt > Date.now(), 'Reminder must be scheduled in the future');

    await element(by.id('tab_settings')).tap();
    await waitFor(remindersSwitch).toBeVisible().whileElement(by.id('context_scroll')).scroll(700, 'down');
    await element(by.id('switch_automatic_reminders')).tap();
    await expect(remindersSwitch).toHaveToggleValue(false);
    assert.equal(reminderState().records.length, 0, 'Disabling reminders must cancel schedules');
    assert.ok(topicFiles().some(file => file.text.includes(oldText)), 'Existing notes must remain saved');
    assert.ok(topicFiles().some(file => file.text.includes(taskText)), 'Disabling reminders must not delete notes');
    assert.notEqual(oldNote.noteId, note.noteId);
  }, 360000);
});
