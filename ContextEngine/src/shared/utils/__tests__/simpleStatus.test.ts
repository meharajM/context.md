import { simpleStatus } from '../simpleStatus';

describe('simpleStatus', () => {
  it('preserves distinct capture outcomes, including topic names containing “model”', () => {
    expect(simpleStatus('Saved to Inbox: download the writing assistant in Settings.')).toBe(
      'Saved to Inbox: download the writing assistant in Settings.',
    );
    expect(simpleStatus('Organized into Model Training')).toBe('Organized into Model Training');
  });
});
