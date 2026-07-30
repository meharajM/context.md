#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function getArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const direct = process.argv.find(arg => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return defaultValue;
}

async function httpJson(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${url}`);
    error.response = json;
    throw error;
  }
  return json;
}

function notesCount(xml) {
  const match = xml.match(/,\s*(\d+) notes,/);
  return match ? Number(match[1]) : null;
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const wda = getArg('wda', process.env.WDA_URL || 'http://192.168.29.124:8100');
  const bundleId = getArg('bundle', 'com.meharaj.contextengine');
  const artifactsRoot = path.resolve(process.cwd(), 'artifacts', 'real-device-qa', nowStamp());
  fs.mkdirSync(artifactsRoot, { recursive: true });

  const status = await httpJson('GET', `${wda}/status`);
  if (!status?.value?.ready) {
    throw new Error(`WDA not ready at ${wda}`);
  }

  const sessionRes = await httpJson('POST', `${wda}/session`, {
    capabilities: { alwaysMatch: { platformName: 'iOS', bundleId } },
  });
  const sessionId = sessionRes.sessionId || sessionRes?.value?.sessionId;
  if (!sessionId) throw new Error('Failed to create WDA session');

  const prefix = `${wda}/session/${sessionId}`;
  const activateApp = async () => {
    await httpJson('POST', `${prefix}/wda/apps/activate`, { bundleId });
  };
  const writeXml = async name => {
    const src = await httpJson('GET', `${prefix}/source`);
    const value = src.value || '';
    fs.writeFileSync(path.join(artifactsRoot, `${name}.xml`), value);
    return value;
  };

  const elementExists = async name => {
    try {
      await findElement(name);
      return true;
    } catch {
      return false;
    }
  };

  const waitForElement = async (name, timeoutMs = 30000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await activateApp().catch(() => {});
      if (await elementExists(name)) {
        return true;
      }
      await sleep(750);
    }
    return false;
  };

  const findElement = async name => {
    const out = await httpJson('POST', `${prefix}/element`, { using: 'name', value: name });
    const value = out.value || {};
    return value.ELEMENT || value['element-6066-11e4-a52e-4f735466cecf'];
  };

  const click = async name => {
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const el = await findElement(name);
        await httpJson('POST', `${prefix}/element/${el}/click`, {});
        return;
      } catch (error) {
        lastError = error;
        const message = String(error?.response?.value?.message || error?.message || '');
        const recoverable =
          message.includes('stale element reference') ||
          message.includes('Timed out snapshotting') ||
          message.includes('not present in the current view');
        if (!recoverable || attempt === 4) {
          throw error;
        }
        await sleep(750);
      }
    }
    throw lastError || new Error(`Failed to click ${name}`);
  };

  const clickAny = async names => {
    let lastError = null;
    for (const name of names) {
      try {
        await click(name);
        return name;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error(`Failed to click any selector: ${names.join(', ')}`);
  };

  const typeText = async text => {
    await httpJson('POST', `${prefix}/wda/keys`, { value: [text] });
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const results = {};

  await activateApp();
  await sleep(1500);
  const baseline = await writeXml('baseline_reflections');
  results.baselineNotes = notesCount(baseline);

  const composerReady = await waitForElement('thought_input', 30000);
  results.composerReady = composerReady;
  if (!composerReady) {
    await writeXml('startup_timeout');
    throw new Error('Composer did not become ready within timeout');
  }

  const savedText = `real qa save ${Math.floor(Date.now() / 1000)}`;
  await click('thought_input');
  await typeText(savedText);
  await clickAny(['save_button', 'Save Button']);
  await sleep(2000);

  const afterSave = await writeXml('after_save_reflections');
  results.afterSaveNotes = notesCount(afterSave);
  results.manualTextSavedByCountDelta =
    results.baselineNotes !== null &&
    results.afterSaveNotes !== null &&
    results.afterSaveNotes >= results.baselineNotes + 1;
  results.manualTextVisibleInReflections = afterSave.includes(savedText);
  results.savedText = savedText;

  await clickAny(['tab_queue', '⏳, Queue']);
  await sleep(1000);
  const queueTab = await writeXml('queue_tab');
  results.queueTabOpened = queueTab.includes('name="tab_queue"') && queueTab.includes('Selected, Button');
  results.queueHasPendingTerms = ['Pending', 'Processing', 'Retry', 'failed'].some(term => queueTab.includes(term));

  await clickAny(['tab_reflections', '✨, Reflections']);
  await sleep(1000);
  await writeXml('reflections_return');

  const voicePre = await writeXml('voice_pre');
  results.voicePreHasStart = voicePre.includes('Start Recording');

  await click('record_button');
  await sleep(2000);
  const voiceAfterStart = await writeXml('voice_after_start');
  results.voiceAfterStartHasStop = voiceAfterStart.includes('Stop Recording');
  results.voiceAfterStartHasRecordingText = voiceAfterStart.toLowerCase().includes('recording');

  await click('record_button');
  await sleep(4000);
  const voiceAfterStop = await writeXml('voice_after_stop');
  results.voiceAfterStopHasStart = voiceAfterStop.includes('Start Recording');
  results.voiceAfterStopHasTranscribing =
    voiceAfterStop.includes('Transcribing') || voiceAfterStop.toLowerCase().includes('transcribing');
  results.voiceAfterStopHasError = voiceAfterStop.includes('Voice capture error');

  await httpJson('DELETE', `${prefix}`, {});

  fs.writeFileSync(path.join(artifactsRoot, 'qa_results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ artifactsRoot, results }, null, 2));
}

main().catch(async error => {
  console.error('real-device-qa failed');
  console.error(error?.message || error);
  if (error?.response) {
    const message = String(error.response?.value?.message || '');
    if (message.includes('could not be, unlocked') || message.includes('reason: Locked')) {
      console.error('Device appears locked. Unlock the iPhone and rerun `npm run qa:real-device`.');
    }
    console.error(JSON.stringify(error.response, null, 2));
  }
  process.exit(1);
});
