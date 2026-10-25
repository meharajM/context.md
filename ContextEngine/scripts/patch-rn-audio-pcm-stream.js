#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const modulePath = path.join(
  path.resolve(__dirname, '..'),
  'node_modules',
  '@fugood',
  'react-native-audio-pcm-stream',
  'android',
  'src',
  'main',
  'java',
  'com',
  'imxiqi',
  'rnliveaudiostream',
  'RNLiveAudioStreamModule.java',
);
const stopMarker = 'Context Engine waits for the recording thread before finishing stop';
const bytesMarker = 'Context Engine writes only bytes returned by AudioRecord.read';
const initialSpeechMarker = 'Context Engine preserves the initial speech samples';
const unblockReadMarker = 'Context Engine stops AudioRecord to unblock a pending read';
const preferredInputMarker = 'Context Engine prefers an available headset microphone';

if (!fs.existsSync(modulePath)) {
  throw new Error('react-native-audio-pcm-stream Android module is missing; verify the installed dependency.');
}

let source = fs.readFileSync(modulePath, 'utf8');
const acknowledgementMarker = 'Context Engine acknowledges PCM startup and reports terminal errors';
function persistPatch() {
  if (!source.includes(acknowledgementMarker)) {
    const initStart = source.indexOf('        sampleRateInHz = 44100;');
    const initEnd = source.indexOf('\n    @ReactMethod\n    public void start()', initStart);
    if (initStart < 0 || initEnd < 0) throw new Error('PCM initialization source changed');
    let initBody = source.slice(initStart, initEnd);
    initBody = initBody.replace('        if (options.hasKey("bufferSize")) {', '        if (bufferSize <= 0) throw new IllegalStateException("Unsupported PCM format: " + bufferSize);\n\n        if (options.hasKey("bufferSize")) {');
    initBody = initBody.replace('            recorder = null;', '            recorder.release();\n            recorder = null;');
    initBody = initBody.replace(/\n    }\n$/, '');
    source = source.slice(0, initStart) +
      '        // ' + acknowledgementMarker + '.\n        try {\n' + initBody +
      '\n        } catch (Exception error) {\n            if (recorder != null) { recorder.release(); recorder = null; }\n            promise.reject("E_AUDIO_INIT", error.toString());\n        }\n    }\n' + source.slice(initEnd);
    replaceExactly('    public void start() {\n        if (recorder == null || isRecording) return;\n        isRecording = true;\n        recorder.startRecording();',
      '    public void start(Promise promise) {\n        if (isRecording) { promise.resolve(null); return; }\n        if (recorder == null) { promise.reject("E_AUDIO_START", "AudioRecord is not initialized"); return; }\n        try {\n            recorder.startRecording();\n            if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("AudioRecord did not start");\n            isRecording = true;\n        } catch (Exception error) {\n            recorder.release(); recorder = null;\n            promise.reject("E_AUDIO_START", error.toString());\n            return;\n        }');
    replaceExactly('                            Log.e("RNLiveAudioStream", "AudioRecord.read failed: " + bytesRead);',
      '                            if (isRecording) eventEmitter.emit("error", "AudioRecord.read failed: " + bytesRead);\n                            Log.e("RNLiveAudioStream", "AudioRecord.read failed: " + bytesRead);');
    replaceExactly('                    Log.e("RNLiveAudioStream", "Audio recording failed", e);',
      '                    if (isRecording) eventEmitter.emit("error", "Audio recording failed: " + e.toString());\n                    Log.e("RNLiveAudioStream", "Audio recording failed", e);');
    replaceExactly('        recordingThread.start();', '        recordingThread.start();\n        promise.resolve(null);');
    replaceExactly('        if (thread == null) {\n            promise.resolve(null);',
      '        if (thread == null) {\n            if (activeRecorder != null) { activeRecorder.release(); if (recorder == activeRecorder) recorder = null; }\n            promise.resolve(null);');
  }
  if (!source.includes('public void start(Promise promise)') || !source.includes('eventEmitter.emit("error"')) {
    throw new Error('PCM startup/error patch is incomplete');
  }
  fs.writeFileSync(modulePath, source, 'utf8');
  const streamPath = path.resolve(__dirname, '../node_modules/@fugood/react-native-audio-pcm-stream/index.js');
  let stream = fs.readFileSync(streamPath, 'utf8');
  if (!stream.includes("error: 'error'")) stream = stream.replace("data: 'data'", "data: 'data',\n  error: 'error'");
  if (!stream.includes("error: 'error'")) throw new Error('PCM JS event mapping changed');
  fs.writeFileSync(streamPath, stream, 'utf8');
  const adapterPath = path.resolve(__dirname, '../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter.js');
  let adapter = fs.readFileSync(adapterPath, 'utf8');
  const adapterMarker = 'Context Engine awaits native PCM acknowledgement';
  if (!adapter.includes(adapterMarker)) {
    adapter = adapter.replace('      LiveAudioStream.init({', '      // ' + adapterMarker + '.\n      await LiveAudioStream.init({');
    adapter = adapter.replace("      LiveAudioStream.on('data', this.handleAudioData.bind(this));", "      this.dataSubscription = LiveAudioStream.on('data', this.handleAudioData.bind(this));\n      this.errorSubscription = LiveAudioStream.on('error', error => this.errorCallback?.(String(error)));");
    adapter = adapter.replace('      LiveAudioStream.start();', '      await LiveAudioStream.start();');
    adapter = adapter.replace('      throw new Error(`Failed to stop recording: ${errorMessage}`);', '      this.recording = false;\n      throw new Error(`Failed to stop recording: ${errorMessage}`);');
    adapter = adapter.replace('  async release() {', '  async release() {\n    this.dataSubscription?.remove();\n    this.errorSubscription?.remove();');
    if (!adapter.includes('await LiveAudioStream.init(') || !adapter.includes('await LiveAudioStream.start()') || !adapter.includes("LiveAudioStream.on('error'")) {
      throw new Error('Whisper PCM adapter changed; audit acknowledgement patch');
    }
    fs.writeFileSync(adapterPath, adapter, 'utf8');
  }
}

function applyPreferredInputPatch() {
  if (source.includes(preferredInputMarker)) return;

  replaceExactly(
    'import android.media.AudioRecord;',
    'import android.media.AudioRecord;\nimport android.media.AudioDeviceInfo;\nimport android.media.AudioManager;\nimport android.content.Context;\nimport android.os.Build;',
  );
  replaceExactly(
    '        recorder = new AudioRecord(audioSource, sampleRateInHz, channelConfig, audioFormat, recordingBufferSize);',
    `        recorder = new AudioRecord(audioSource, sampleRateInHz, channelConfig, audioFormat, recordingBufferSize);\n        // ${preferredInputMarker}.\n        AudioManager audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);\n        if (audioManager != null) {\n            AudioDeviceInfo preferredInput = null;\n            for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS)) {\n                int type = device.getType();\n                boolean wired = type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||\n                    (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && type == AudioDeviceInfo.TYPE_USB_HEADSET);\n                boolean bluetooth = type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||\n                    (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == AudioDeviceInfo.TYPE_BLE_HEADSET);\n                if (wired) {\n                    preferredInput = device;\n                    break;\n                }\n                if (bluetooth && preferredInput == null) preferredInput = device;\n            }\n            if (preferredInput != null && !recorder.setPreferredDevice(preferredInput)) {\n                Log.w("RNLiveAudioStream", "Could not select the available headset microphone");\n            }\n        }`,
  );
}

if (source.includes(stopMarker) && source.includes(bytesMarker) && source.includes(initialSpeechMarker)) {
  if (!source.includes(unblockReadMarker)) {
    replaceExactly(
      '        isRecording = false;\n        Thread thread = recordingThread;',
      `        isRecording = false;\n        // ${unblockReadMarker}.\n        AudioRecord activeRecorder = recorder;\n        if (activeRecorder != null) {\n            try {\n                if (activeRecorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {\n                    activeRecorder.stop();\n                }\n            } catch (Exception e) {\n                Log.w("RNLiveAudioStream", "Could not stop recorder to unblock read", e);\n            }\n        }\n        Thread thread = recordingThread;`,
    );
    persistPatch();
    console.log('Audio PCM stream now stops AudioRecord before waiting for its read thread.');
  }
  if (!source.includes(preferredInputMarker)) {
    applyPreferredInputPatch();
    persistPatch();
    console.log('Audio PCM stream now prefers an available headset microphone.');
  }
  persistPatch();
  process.exit(0);
}
function replaceExactly(original, replacement) {
  if (source.split(original).length !== 2) {
    throw new Error('react-native-audio-pcm-stream Android source changed; audit the audio patch.');
  }
  source = source.replace(original, replacement);
}

if (source.includes(stopMarker) && source.includes(bytesMarker)) {
  replaceExactly(
    `                        // skip first 2 buffers to eliminate "click sound"
                        if (bytesRead > 0 && ++count > 2) {
                            // ${bytesMarker}.`,
    `                        // ${initialSpeechMarker}.
                        if (bytesRead > 0) {
                            // ${bytesMarker}.`,
  );
  replaceExactly('                    int bytesRead;\n                    int count = 0;', '                    int bytesRead;');
  replaceExactly(
    '        isRecording = false;\n        Thread thread = recordingThread;',
    `        isRecording = false;\n        // ${unblockReadMarker}.\n        AudioRecord activeRecorder = recorder;\n        if (activeRecorder != null) {\n            try {\n                if (activeRecorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {\n                    activeRecorder.stop();\n                }\n            } catch (Exception e) {\n                Log.w("RNLiveAudioStream", "Could not stop recorder to unblock read", e);\n            }\n        }\n        Thread thread = recordingThread;`,
  );
  applyPreferredInputPatch();
  persistPatch();
  console.log('Audio PCM stream now preserves speech from the first recorder read.');
  process.exit(0);
}
if (source.includes(stopMarker) || source.includes(bytesMarker) || source.includes(initialSpeechMarker)) {
  throw new Error('react-native-audio-pcm-stream audio patch is incomplete; audit the installed module.');
}

replaceExactly('import java.lang.Math;', 'import java.lang.Math;\nimport java.util.Arrays;');
replaceExactly('    private AudioRecord recorder = null;', '    private volatile AudioRecord recorder = null;');
replaceExactly('    private boolean isRecording;', '    private volatile boolean isRecording;\n    private volatile Thread recordingThread;');

const threadStart = '        Thread recordingThread = new Thread(new Runnable() {';
const threadEnd = '        recordingThread.start();';
const startIndex = source.indexOf(threadStart);
const endIndex = source.indexOf(threadEnd, startIndex);
if (startIndex < 0 || endIndex < 0 || source.indexOf(threadStart, startIndex + 1) >= 0) {
  throw new Error('react-native-audio-pcm-stream recording loop changed; audit the audio patch.');
}

const recordingThread = `        final AudioRecord activeRecorder = recorder;
        recordingThread = new Thread(new Runnable() {
            public void run() {
                try {
                    int bytesRead;
                    String base64Data;
                    byte[] buffer = new byte[bufferSize];

                    while (isRecording) {
                        bytesRead = activeRecorder.read(buffer, 0, buffer.length);
                        if (bytesRead < 0) {
                            Log.e("RNLiveAudioStream", "AudioRecord.read failed: " + bytesRead);
                            break;
                        }

                        // ${initialSpeechMarker}.
                        if (bytesRead > 0) {
                            // ${bytesMarker}.
                            byte[] audioData = bytesRead == buffer.length ? buffer : Arrays.copyOf(buffer, bytesRead);
                            base64Data = Base64.encodeToString(audioData, Base64.NO_WRAP);
                            eventEmitter.emit("data", base64Data);
                        }
                    }
                } catch (Exception e) {
                    Log.e("RNLiveAudioStream", "Audio recording failed", e);
                } finally {
                    try {
                        if (activeRecorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                            activeRecorder.stop();
                        }
                    } catch (Exception e) {
                        Log.w("RNLiveAudioStream", "Could not stop recorder cleanly", e);
                    }
                    try {
                        activeRecorder.release();
                    } catch (Exception e) {
                        Log.w("RNLiveAudioStream", "Could not release recorder cleanly", e);
                    }
                    isRecording = false;
                    if (recorder == activeRecorder) recorder = null;
                    if (recordingThread == Thread.currentThread()) recordingThread = null;
                }
            }
        });
        recordingThread.start();`;

source = source.slice(0, startIndex) + recordingThread + source.slice(endIndex + threadEnd.length);

replaceExactly(
  `    @ReactMethod
    public void stop() {
        isRecording = false;
    }`,
  `    @ReactMethod
    public void stop(Promise promise) {
        // ${stopMarker}.
        isRecording = false;
        // ${unblockReadMarker}.
        AudioRecord activeRecorder = recorder;
        if (activeRecorder != null) {
            try {
                if (activeRecorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    activeRecorder.stop();
                }
            } catch (Exception e) {
                Log.w("RNLiveAudioStream", "Could not stop recorder to unblock read", e);
            }
        }
        Thread thread = recordingThread;
        if (thread == null) {
            promise.resolve(null);
            return;
        }

        try {
            thread.join(5000);
            if (thread.isAlive()) {
                promise.reject("E_AUDIO_STOP_TIMEOUT", "Audio recording thread did not stop");
            } else {
                promise.resolve(null);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            promise.reject("E_AUDIO_STOP_INTERRUPTED", e.toString());
        }
    }`,
);

persistPatch();
console.log('Audio PCM stream now drains recorder thread and emits complete PCM reads before WAV finalization.');
