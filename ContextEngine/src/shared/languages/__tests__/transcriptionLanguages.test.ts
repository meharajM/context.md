import { getDeviceRegionTranscriptionLanguage } from '../transcriptionLanguages';

describe('device region transcription language', () => {
  it.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['en-IE', 'en'],
    ['en-ES', 'es'],
    ['en-FR', 'fr'],
    ['en-DE', 'de'],
    ['en-AT', 'de'],
    ['en-IT', 'it'],
    ['es-US', 'es'],
    ['fr-CA', 'fr'],
    ['de_DE', 'de'],
    ['es-419', 'es'],
    ['nl-NL', 'en'],
  ] as const)('maps %s to %s', (locale, expected) => {
    expect(getDeviceRegionTranscriptionLanguage(locale)).toBe(expected);
  });
});
