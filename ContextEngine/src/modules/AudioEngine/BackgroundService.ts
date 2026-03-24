import BackgroundService from 'react-native-background-actions';
import { useAppStore } from '../core/store';

const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), time));

const backgroundOptions = {
    taskName: 'ContextEngineListener',
    taskTitle: 'Context Engine Listening',
    taskDesc: 'Listening for "Remember" trigger...',
    taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
    },
    color: '#6200EE',
    parameters: {
        delay: 1000,
    },
};

/**
 * Background Service for continuous earphone/wake-word detection.
 */
export const startBackgroundEar = async () => {
    try {
        await BackgroundService.start(async (taskData) => {
            // This loop runs in the background
            while (BackgroundService.isRunning()) {
                // Here we would check for earphone connection 
                // and keep the Sherpa-ONNX engine alive
                console.log('Background ear is active...');
                await sleep(taskData!.delay);
            }
        }, backgroundOptions);
    } catch (e) {
        console.error('Failed to start background ear:', e);
    }
};

export const stopBackgroundEar = async () => {
    await BackgroundService.stop();
};
