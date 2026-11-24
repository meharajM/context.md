export const TRANSCRIPTION_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
] as const;

export type TranscriptionLanguage = typeof TRANSCRIPTION_LANGUAGES[number]['code'];

export const DEFAULT_TRANSCRIPTION_LANGUAGE: TranscriptionLanguage = 'en';

export const isTranscriptionLanguage = (value: unknown): value is TranscriptionLanguage =>
  typeof value === 'string' && TRANSCRIPTION_LANGUAGES.some(language => language.code === value);

export const getTranscriptionLanguage = (code: TranscriptionLanguage) =>
  TRANSCRIPTION_LANGUAGES.find(language => language.code === code) ?? TRANSCRIPTION_LANGUAGES[0];

export const getTranscriptionPrompt = (code: TranscriptionLanguage): string => {
  const language = getTranscriptionLanguage(code);
  const languageInstruction = code === 'en'
    ? 'Transcribe verbatim English speech across regional accents, including Indian English.'
    : `Transcribe verbatim ${language.name} speech.`;
  return `${languageInstruction} Preserve the speaker's words, names, phrasing, and grammar. Do not translate or rewrite. Output only the transcription, with no newlines.`;
};
