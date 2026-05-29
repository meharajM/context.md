export const normalizeAssistantCaptureText = (input: string): string =>
  input.replace(/\s+/g, ' ').trim();
