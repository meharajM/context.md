export interface DiagnosticItem {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'error';
}

export interface SettingsViewModel {
  audioStatus: DiagnosticItem;
  modelStatus: DiagnosticItem;
  storageStatus: DiagnosticItem;
}
