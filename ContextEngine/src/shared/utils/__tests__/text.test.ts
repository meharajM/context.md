import { normalizeAssistantCaptureText } from '../text';

describe('normalizeAssistantCaptureText', () => {
  it('collapses whitespace and trims the assistant payload', () => {
    expect(normalizeAssistantCaptureText('  add\nthis   to  my   context  ')).toBe('add this to my context');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeAssistantCaptureText('   \n\t  ')).toBe('');
  });
});
