import { simpleStatus } from '../simpleStatus';

describe('simpleStatus', () => {
  it('keeps background-save guidance platform-neutral', () => {
    expect(simpleStatus('Saved in Inbox. It will be sorted when your device is ready.'))
      .toBe('Saved in Inbox. It will be sorted when your device is ready.');
    expect(simpleStatus('Saved in Inbox. Open the app again to continue sorting it.'))
      .toBe('Saved in Inbox. Open the app again to continue sorting it.');
  });

  it('preserves distinct capture outcomes, including topic names containing “model”', () => {
    expect(simpleStatus('Saved to Inbox: download the writing helper in Settings.')).toBe(
      'Saved to Inbox: download the writing helper in Settings.',
    );
    expect(simpleStatus('Organized into Model Training')).toBe('Organized into Model Training');
  });
});
