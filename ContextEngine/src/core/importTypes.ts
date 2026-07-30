import type { SynthesizedThought } from '../modules/SynthesisEngine/runtimes/types';

export type ImportSourceKind = 'text' | 'voice';

export interface ImportDraft {
  sourceKind: ImportSourceKind;
  text?: string;
  voiceFile?: string | number | null;
  selectedTopic?: string | null;
}

export interface ImportPreview {
  sourceKind: ImportSourceKind;
  transcript: string;
  refinedText: string;
  suggestedTopic: string;
  tags: string[];
  source: SynthesizedThought['source'];
  selectedTopic: string | null;
  mergeCandidate: boolean;
  requiresApproval: boolean;
  voiceFile?: string | number | null;
}

export const normalizeImportTopic = (topic?: string | null): string | null => {
  const normalized = topic?.trim();
  return normalized ? normalized : null;
};
