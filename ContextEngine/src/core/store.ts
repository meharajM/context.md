import { create } from 'zustand';
import { ContextSection, ContextManager } from '../modules/ContextManager';
import { AudioEngineImpl } from '../modules/AudioEngine/AudioEngineImpl';
import { SynthesisService } from '../modules/SynthesisEngine/SynthesisService';
import { ProcessingQueueManager } from '../modules/SynthesisEngine/ProcessingQueueManager';

interface AppState {
  sections: ContextSection[];
  isRecording: boolean;
  status: string;
  queueSize: number;
  isInitialized: boolean;
  loadContext: () => Promise<void>;
  addThought: (text: string) => Promise<void>;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
  initializeEngine: () => Promise<void>;
  setStatus: (status: string) => void;
  updateQueueSize: () => void;
}

const audioEngine = new AudioEngineImpl();

export const useAppStore = create<AppState>((set, get) => ({
  sections: [],
  isRecording: false,
  status: 'Booting...',
  queueSize: 0,
  isInitialized: false,

  setStatus: (status) => set({ status }),
  
  updateQueueSize: () => set({ queueSize: ProcessingQueueManager.getQueueSize() }),

  initializeEngine: async () => {
    try {
      await audioEngine.initializeModels();
      await SynthesisService.initialize();
      set({ isInitialized: true, status: 'Idle' });
    } catch (e) {
      set({ status: 'Engine Error' });
    }
  },

  loadContext: async () => {
    const data = await ContextManager.readContext();
    set({ sections: data });
  },

  addThought: async (text) => {
    if (!text.trim()) return;
    
    // Non-blocking: Add to queue and return immediately
    ProcessingQueueManager.addToQueue(text);
    const currentQueue = ProcessingQueueManager.getQueueSize();
    set({ queueSize: currentQueue, status: 'Stored for later' });
    
    // Periodic check to update UI while processing in background
    const interval = setInterval(() => {
      const remaining = ProcessingQueueManager.getQueueSize();
      set({ queueSize: remaining });
      get().loadContext();
      
      if (remaining === 0) {
        set({ status: 'Idle' });
        clearInterval(interval);
      }
    }, 3000);
  },

  startCapture: async () => {
    if (!get().isInitialized) return;
    try {
      set({ isRecording: true, status: 'Listening...' });
      await audioEngine.startRecording();
    } catch (error) {
      set({ isRecording: false, status: 'Mic Error' });
    }
  },

  stopCapture: async () => {
    if (!get().isRecording) return;
    try {
      set({ status: 'Processing...' });
      const result = await audioEngine.stopRecording();
      set({ isRecording: false });
      
      if (result.text) {
        await get().addThought(result.text);
      } else {
        set({ status: 'No speech' });
        setTimeout(() => set({ status: 'Idle' }), 2000);
      }
    } catch (error) {
      set({ isRecording: false, status: 'Process Error' });
    }
  },
}));
