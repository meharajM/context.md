import type { SynthesisClarification } from '../../modules/SynthesisEngine/runtimes/types';

export interface QueueJobView {
  id: string;
  noteId: string;
  title: string;
  transcript: string;
  timestampLabel: string;
  statusLabel: string;
  progress: number | null;
  kind: 'voice' | 'text' | 'image';
  selectedTopic?: string | null;
  clarification?: SynthesisClarification;
  sourceMetadata?: {
    audioFilePath?: string | null;
  };
  canEnd: boolean;
  canEdit: boolean;
  isActiveSlot: boolean;
}
