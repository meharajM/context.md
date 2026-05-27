export interface QueueJobView {
  id: string;
  title: string;
  transcript: string;
  timestampLabel: string;
  statusLabel: string;
  progress: number | null;
  kind: 'voice' | 'text' | 'image';
  canEnd: boolean;
  isActiveSlot: boolean;
}
