import { meetingAudioRetentionMs } from '../meetingTypes';

describe('meetingAudioRetentionMs', () => {
  it.each([
    ['5m', 5 * 60 * 1000],
    ['1h', 60 * 60 * 1000],
    ['1d', 24 * 60 * 60 * 1000],
    ['keep', null],
  ] as const)('maps %s to its retention duration', (retention, expected) => {
    expect(meetingAudioRetentionMs(retention)).toBe(expected);
  });
});
