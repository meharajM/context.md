const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
      '-vf', 'crop=1080:2076:0:144',
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

module.exports = { captureStoreScreenshot };
