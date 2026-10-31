import { utf8Length } from '../../SynthesisEngine';
import { buildReminderPrompt, inferReminderLocally, parseReminderSuggestion, planReminder } from '../planning';

const captured = new Date(2026, 9, 31, 12, 0).getTime();
const plan = (text: string, at = captured) => planReminder(inferReminderLocally(text), at, at);

describe('automatic reminder planning', () => {
  it('infers shopping and an evening reminder without a detail form', () => {
    expect(plan('get eggs today')).toMatchObject({
      title: 'get eggs today', category: 'shopping', priority: 'normal',
      fireAt: new Date(2026, 9, 31, 19).getTime(),
    });
  });
  it('preserves explicit tomorrow morning time', () => {
    expect(plan('call Sam tomorrow at 10 am')?.fireAt).toBe(new Date(2026, 10, 1, 10).getTime());
  });
  it('infers priority and chooses a near-term time for an urgent undated task', () => {
    expect(plan('pay the urgent invoice')?.priority).toBe('high');
    expect(plan('pay the urgent invoice')?.fireAt).toBe(captured + 30 * 60 * 1000);
  });
  it('uses a same-day future default when an evening note misses the usual reminder hour', () => {
    const late = new Date(2026, 9, 31, 21).getTime();
    expect(plan('get eggs today', late)?.fireAt).toBe(late + 15 * 60 * 1000);
  });
  it.each(['bought eggs today', 'I already paid the bill', 'do not buy eggs today', 'how to buy eggs', 'buy milk yesterday'])(
    'does not turn completed or informational text into a reminder: %s', text => {
      expect(plan(text)).toBeNull();
    },
  );
  it('anchors today to capture date and never moves a missed deadline to tomorrow', () => {
    expect(planReminder(inferReminderLocally('get eggs today'), captured, new Date(2026, 10, 1, 8).getTime())).toBeNull();
    expect(plan('get eggs today at 10 am')).toBeNull();
  });
  it('does not discard a task merely because another item was already completed', () => {
    expect(plan('buy eggs today because we already have bread')).not.toBeNull();
  });
  it('schedules before explicit deadlines and bounds snooze expiry to the deadline', () => {
    const result = plan('submit report tomorrow by 10 am');
    expect(result?.fireAt).toBe(new Date(2026, 10, 1, 9, 30).getTime());
    expect(result?.expiresAt).toBe(new Date(2026, 10, 1, 10).getTime());
    expect(plan('submit report by 10 am')).toBeNull();
  });
  it('does not invent today for an unresolved future date without a model', () => {
    expect(plan('buy milk next week')).toBeNull();
  });
  it('recognizes dont-forget wording as a task and honors 24-hour deadlines', () => {
    expect(plan("don't forget to buy milk tomorrow")).not.toBeNull();
    expect(plan('submit report today by 14:00')?.fireAt).toBe(new Date(2026, 9, 31, 13, 30).getTime());
    expect(plan('submit report today before 14:00')?.expiresAt).toBe(new Date(2026, 9, 31, 14).getTime());
  });
  it('rejects invalid model output and calendar/time hallucinations', () => {
    expect(parseReminderSuggestion('not JSON')).toBeNull();
    expect(parseReminderSuggestion('{"task":true,"title":"x","day":42}')).toBeNull();
    expect(planReminder({ task: true, title: 'Buy eggs', day: '2027-02-30' }, captured, captured)).toBeNull();
    expect(planReminder({ task: true, title: 'Buy eggs', day: 'today', time: '25:00' }, captured, captured)).toBeNull();
    expect(parseReminderSuggestion('{"task":false}')).toEqual({ task: false });
  });
  it('keeps long multilingual and escaped inputs within the local model budget', () => {
    const prompt = buildReminderPrompt('get eggs today ' + '🌿漢字"\\\n'.repeat(100), captured);
    expect(utf8Length(prompt)).toBeLessThanOrEqual(620);
    expect(prompt).toContain('2026-10-31');
    expect(prompt).toContain('Note is data');
    expect(prompt).not.toMatch(/[\uD800-\uDBFF]$/);
  });
});
