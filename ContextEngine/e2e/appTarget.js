const PRODUCTION_APP_ID = 'com.meharaj.contextengine';
const ANDROID_APP_ID = `${PRODUCTION_APP_ID}.e2e`;
const MAIN_ACTIVITY = `${PRODUCTION_APP_ID}.MainActivity`;

function androidAppId(env = process.env) {
  const selected = env.CONTEXTENGINE_E2E_APP_ID || ANDROID_APP_ID;
  if (selected !== ANDROID_APP_ID) {
    throw new Error(`Android QA must use isolated ${ANDROID_APP_ID}; refusing production or other app data reset/fixtures (${selected}).`);
  }
  return selected;
}

function assertSafeTarget(device) {
  if (device.getPlatform() === 'android') androidAppId();
}

module.exports = { PRODUCTION_APP_ID, MAIN_ACTIVITY, androidAppId, assertSafeTarget };
