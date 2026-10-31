const fs = require('fs');
const path = require('path');
const { tapAndroidElement, waitForVoiceReady } = require('./firstRun');

const { androidAppId, assertSafeTarget } = require('./appTarget');
const APP_ID = androidAppId();
const stage = process.env.UX_REVIEW_STAGE || 'before';
const appearance = process.env.UX_REVIEW_APPEARANCE || 'light';
const outputDirectory = path.resolve(__dirname, `../artifacts/android-ux-review/${stage}`);

function run(command, args) {
  return require('child_process').execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function setNightMode(enabled) {
  run('adb', ['-s', device.id, 'shell', 'cmd', 'uimode', 'night', enabled ? 'yes' : 'no']);
}

async function capture(name) {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const screenshot = await device.takeScreenshot(`ux-${stage}-${name}`);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.copyFileSync(screenshot, path.join(outputDirectory, `${name}.png`));
}

async function show(id, distance = 350) {
  await waitFor(element(by.id(id)))
    .toBeVisible()
    .whileElement(by.id('context_scroll'))
    .scroll(distance, 'down');
}

async function dismissKeyboard() {
  if (device.getPlatform() === 'android') {
    let inputMethodState = run('adb', ['-s', device.id, 'shell', 'dumpsys', 'input_method']);
    if (inputMethodState.includes('mInputShown=true')) {
      run('adb', ['-s', device.id, 'shell', 'input', 'keyevent', 'KEYCODE_BACK']);
    }

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      inputMethodState = run('adb', ['-s', device.id, 'shell', 'dumpsys', 'input_method']);
      if (!inputMethodState.includes('mInputShown=true')) {
        // Wait for Android's keyboard resize animation before tapping the composer.
        await new Promise(resolve => setTimeout(resolve, 250));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Android keyboard remained visible after dismissing it');
  }
}

describe('Android UX review journey', () => {
  it('captures first launch, capture, waiting, import, settings, details, and editor', async () => {
    assertSafeTarget(device);
    setNightMode(appearance === 'dark');
    await device.launchApp({ newInstance: true, resetAppState: true });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(30000);
    await waitFor(element(by.id('first_run_tutorial'))).toBeVisible().withTimeout(30000);
    await capture('00-first-run-tour');
    await element(by.id('first_run_next')).tap();
    await expect(element(by.text('Let related thoughts find each other'))).toBeVisible();
    await element(by.id('first_run_next')).tap();
    await expect(element(by.text('Bring useful research back'))).toBeVisible();
    const startTutorial = element(by.id('first_run_start'));
    await waitFor(startTutorial).toBeVisible().withTimeout(10000);
    await waitForVoiceReady();
    await tapAndroidElement('first_run_start');
    await waitFor(element(by.id('first_run_tutorial'))).not.toExist().withTimeout(10000);
    await waitFor(element(by.id('device_readiness_notice'))).toBeVisible().withTimeout(30000);
    await capture('01-phone-check');

    await element(by.id('device_readiness_dismiss_button')).tap();
    await waitFor(element(by.id('composer_shell'))).toBeVisible().withTimeout(15000);
    await expect(element(by.text('Ready for a note'))).not.toExist();
    await element(by.id('context_scroll')).scroll(1200, 'up');
    await capture('02-home-empty');

    await element(by.id('tab_queue')).tap();
    await element(by.id('context_scroll')).scroll(1200, 'up');
    await waitFor(element(by.text('Nothing needs your attention'))).toBeVisible().withTimeout(15000);
    await capture('03-waiting-empty');

    await element(by.id('tab_import')).tap();
    await element(by.id('context_scroll')).scroll(1200, 'up');
    await expect(element(by.id('import_source_text_button'))).not.toExist();
    await expect(element(by.id('import_topic_browse_button'))).not.toExist();
    await show('import_text_input', 200);
    await capture('04-import-empty');
    await show('import_topic_input', 180);
    await element(by.id('import_topic_input')).tap();
    await element(by.id('import_topic_input')).replaceText('Project Planning');
    await dismissKeyboard();
    await show('import_text_input', 180);
    await element(by.id('import_text_input')).tap();
    await element(by.id('import_text_input')).replaceText('Review a short plan and keep the original note in Inbox.');
    await dismissKeyboard();
    await show('import_analyze_button', 150);
    await element(by.id('import_analyze_button')).tap();
    await waitFor(element(by.id('import_submit_button'))).toExist().withTimeout(30000);
    await show('import_submit_button', 150);
    await capture('05-import-preview');
    await show('import_submit_button', 180);
    await element(by.id('import_submit_button')).tap();
    await waitFor(element(by.id('import_submit_button'))).not.toExist().withTimeout(30000);

    const fixtureDate = '2026-10-25T08:00:00.000Z';
    const fixtureId = 'ux-review-project-planning';
    const fixturePath = path.join(outputDirectory, 'project-planning.md');
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(fixturePath, `# Project Planning\n\n- [${fixtureDate}] <!-- thought-note:v2 {"noteId":"${fixtureId}","createdAt":"${fixtureDate}","updatedAt":"${fixtureDate}","sourceMetadata":{"kind":"text","transcript":"Plan tomorrow's first priority","noteId":"${fixtureId}"}} -->\n  | Plan tomorrow's first priority\n  <!-- /thought-note -->\n`);
    run('adb', ['-s', device.id, 'push', fixturePath, '/data/local/tmp/ux-review-project-planning.md']);
    run('adb', ['-s', device.id, 'shell', 'run-as', APP_ID, 'cp', '/data/local/tmp/ux-review-project-planning.md', 'files/topics/project-planning.md']);
    await device.terminateApp();
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(30000);
    await element(by.id('tab_import')).tap();
    await element(by.id('context_scroll')).scroll(1200, 'up');
    await show('import_topic_browse_button', 180);
    await element(by.id('import_topic_browse_button')).tap();
    await waitFor(element(by.text('Select topic'))).toBeVisible().withTimeout(10000);
    await capture('06-import-topic-picker');
    run('adb', ['-s', device.id, 'shell', 'input', 'keyevent', 'KEYCODE_BACK']);
    await waitFor(element(by.id('tab_settings'))).toBeVisible().withTimeout(10000);

    await element(by.id('tab_settings')).tap();
    await element(by.id('context_scroll')).scroll(1200, 'up');
    await waitFor(element(by.id('model_select_button'))).toBeVisible().withTimeout(15000);
    await capture('07-settings-model');
    await element(by.id('context_scroll')).scroll(550, 'down');
    await waitFor(element(by.id('switch_record'))).toBeVisible().withTimeout(10000);
    await capture('08-settings-capture');
    await show('switch_litert', 250);
    await expect(element(by.id('switch_litert'))).toHaveToggleValue(true);
    await element(by.id('switch_litert')).tap();
    await expect(element(by.id('switch_litert'))).toHaveToggleValue(false);
    await show('export_backup_button', 500);
    await capture('09-settings-backup');

    await element(by.id('tab_reflections')).tap();
    await element(by.id('context_scroll')).scroll(1200, 'up');
    const note = `UX review note ${Date.now()} keeps one next step in view.`;
    await show('thought_input', 350);
    await element(by.id('thought_input')).tap();
    await element(by.id('thought_input')).replaceText(note);
    await dismissKeyboard();
    await show('save_button', 150);
    await element(by.id('save_button')).tap();
    await waitFor(element(by.id('save_button'))).not.toExist().withTimeout(10000);
    await waitFor(element(by.text('Inbox'))).toBeVisible().withTimeout(30000);
    await capture('10-home-with-inbox-note');

    if (appearance === 'dark') {
      await capture('15-home-dark');
    } else {
      setNightMode(true);
      await new Promise(resolve => setTimeout(resolve, 1200));
      await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(10000);
      await capture('15-home-dark-toggle');
      setNightMode(false);
      await new Promise(resolve => setTimeout(resolve, 1200));
      await capture('16-home-light-return');
    }

    await element(by.text('Project Planning')).tap();
    await waitFor(element(by.id('source_capture_timeline'))).toBeVisible().withTimeout(15000);
    await capture('11-topic-details');
    await element(by.id('tab_reflections')).tap();

    await element(by.text('Inbox')).tap();
    await waitFor(element(by.id('source_capture_timeline'))).toBeVisible().withTimeout(15000);
    await capture('12-inbox-details');

    await element(by.label(`Edit note: ${note}`)).tap();
    await waitFor(element(by.id('note_editor_input'))).toBeVisible().withTimeout(15000);
    await expect(element(by.text('Browse'))).not.toExist();
    await capture('13-note-editor');
    await element(by.text('Details')).tap();
    await waitFor(element(by.text('Note details'))).toBeVisible().withTimeout(10000);
    await capture('14-note-details-modal');
    run('adb', ['-s', device.id, 'shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  }, 180000);

  afterAll(() => {
    try {
      setNightMode(false);
    } catch (_) {
      // The emulator may already be shutting down after a failed journey.
    }
  });
});
