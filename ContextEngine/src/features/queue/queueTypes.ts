export interface QueueJobView {
  id: string;
  title: string;
  statusLabel: string;
  progress: number | null;
  kind: 'voice' | 'text' | 'image';
}
