const fs = require('fs');
const path = require('path');

const APP_ID = 'com.meharaj.contextengine';
const stage = process.env.UX_REVIEW_STAGE || 'before';
const outputDirectory = path.resolve(__dirname, `../artifacts/android-ux-review/${stage}`);

function run(command, args) {
  return require('child_process').execFileSync(command, args, { encoding: 'utf8' }).trim();
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
    await device.pressBack();
  }
}

describe('Android UX review journey', () => {
  it('captures first launch, capture, waiting, import, settings, details, and editor', async () => {
    await device.launchApp({ newInstance: true, resetAppState: true });
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(30000);
    await waitFor(element(by.id('device_readiness_notice'))).toBeVisible().withTimeout(30000);
    await capture('01-phone-check');

    await element(by.id('device_readiness_dismiss_button')).tap();
    await waitFor(element(by.id('composer_shell'))).toBeVisible().withTimeout(15000);
    await expect(element(by.text('Ready for a note'))).not.toExist();
    await element(by.id('context_scroll')).scroll(1200, 'up');
    await capture('02-home-empty');

    await element(by.id('tab_queue')).tap();
    await element(by.id('context_scroll')).scroll(1200, 'up');
    await waitFor(element(by.text('Nothing waiting'))).toBeVisible().withTimeout(15000);
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
    await device.pressBack();

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
    await waitFor(element(by.text('Inbox'))).toBeVisible().withTimeout(30000);
    await capture('10-home-with-inbox-note');

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
    await device.pressBack();
  }, 180000);
});
