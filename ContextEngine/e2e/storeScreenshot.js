const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function setAndroidStoreScreenshotViewport(device) {
  if (device.getPlatform() !== 'android') return;
  execFileSync('adb', ['-s', device.id, 'shell', 'wm', 'size', '1080x2076'], { encoding: 'utf8' });
}

function restoreAndroidStoreScreenshotViewport(device) {
  if (device.getPlatform() !== 'android') return;
  try {
    execFileSync('adb', ['-s', device.id, 'shell', 'wm', 'size', 'reset'], { encoding: 'utf8' });
  } catch {
    // Detox may already be shutting down its disposable emulator.
  }
}

async function captureStoreScreenshot(device, name) {
  await new Promise(resolve => setTimeout(resolve, 1250));

  const platform = device.getPlatform();
  const deviceClass = process.env.STORE_SCREENSHOT_DEVICE_CLASS || (platform === 'ios' ? 'iphone' : 'phone');
  const sourcePath = await device.takeScreenshot(`store-${platform}-${name}`);
  const outputDirectory = path.resolve(
    __dirname,
    '..',
    platform === 'ios' ? 'ios/store-assets/screenshots' : 'android/store-assets/screenshots',
  );
  const outputPath = path.join(outputDirectory, `${deviceClass}-${name}.jpg`);
  fs.mkdirSync(outputDirectory, { recursive: true });

  if (platform === 'android') {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', sourcePath,
      '-vf', 'scale=1080:2076:force_original_aspect_ratio=decrease,pad=1080:2076:(ow-iw)/2:(oh-ih)/2:color=white',
      '-q:v', '2',
      outputPath,
    ]);
  } else {
    execFileSync('sips', [
      '--setProperty', 'format', 'jpeg',
      '--setProperty', 'formatOptions', 'best',
      sourcePath,
      '--out', outputPath,
    ]);
  }

  return outputPath;
}

module.exports = {
  captureStoreScreenshot,
  setAndroidStoreScreenshotViewport,
  restoreAndroidStoreScreenshotViewport,
};
