import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SwitchRow } from '../../../shared/components/SwitchRow';
import { getReminderState, isAutomaticReminderSupported, setAutomaticRemindersEnabled } from '../../../modules/AutomaticReminders';
import { AutomaticRemindersSection } from '../AutomaticRemindersSection';

jest.mock('../../../modules/AutomaticReminders', () => ({
  getReminderState: jest.fn(),
  isAutomaticReminderSupported: jest.fn(),
  setAutomaticRemindersEnabled: jest.fn(),
}));

const state = (enabled: boolean) => ({ enabled, enabledAt: enabled ? 123 : 0, records: [] });
let renderer: ReactTestRenderer.ReactTestRenderer;
const toggle = () => renderer.root.findByType(SwitchRow);
const mount = async () => {
  await act(async () => { renderer = ReactTestRenderer.create(<AutomaticRemindersSection />); });
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(isAutomaticReminderSupported).mockReturnValue(true);
  jest.mocked(getReminderState).mockResolvedValue(state(false));
  jest.mocked(setAutomaticRemindersEnabled).mockImplementation(async enabled => state(enabled));
});
afterEach(() => { if (renderer) { act(() => renderer.unmount()); } });

it('hides unsupported platforms and missing native modules without loading state', async () => {
  jest.mocked(isAutomaticReminderSupported).mockReturnValue(false);
  await mount();
  expect(renderer.toJSON()).toBeNull();
  expect(getReminderState).not.toHaveBeenCalled();
});

it('starts disabled while loading then restores persisted enabled state', async () => {
  let resolve!: (value: ReturnType<typeof state>) => void;
  jest.mocked(getReminderState).mockReturnValue(new Promise(done => { resolve = done; }));
  await mount();
  expect(toggle().props).toMatchObject({ value: false, disabled: true });
  await act(async () => { resolve(state(true)); });
  expect(toggle().props).toMatchObject({ value: true, disabled: false });
});

it('enables and disables through service without detail forms', async () => {
  await mount();
  expect(toggle().props.value).toBe(false);
  await act(async () => { await toggle().props.onValueChange(true); });
  expect(toggle().props.value).toBe(true);
  await act(async () => { await toggle().props.onValueChange(false); });
  expect(toggle().props.value).toBe(false);
  expect(setAutomaticRemindersEnabled).toHaveBeenNthCalledWith(1, true);
  expect(setAutomaticRemindersEnabled).toHaveBeenNthCalledWith(2, false);
  expect(renderer.root.findAllByType(SwitchRow)).toHaveLength(1);
});

it('blocks duplicate requests and keeps persisted value after permission failure', async () => {
  let reject!: (error: Error) => void;
  jest.mocked(setAutomaticRemindersEnabled).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  await mount();
  act(() => { toggle().props.onValueChange(true); toggle().props.onValueChange(true); });
  expect(toggle().props.disabled).toBe(true);
  expect(setAutomaticRemindersEnabled).toHaveBeenCalledTimes(1);
  await act(async () => { reject(new Error('Allow notifications to enable reminders.')); });
  expect(toggle().props).toMatchObject({ value: false, disabled: false });
  expect(renderer.root.findAllByProps({ children: 'Allow notifications to enable reminders.' }).length).toBeGreaterThan(0);
});

it('handles load failure and permits a later explicit enable', async () => {
  jest.mocked(getReminderState).mockRejectedValue(new Error('Could not read reminders.'));
  await mount();
  expect(toggle().props.disabled).toBe(false);
  expect(renderer.root.findAllByProps({ children: 'Could not read reminders.' }).length).toBeGreaterThan(0);
  await act(async () => { await toggle().props.onValueChange(true); });
  expect(toggle().props.value).toBe(true);
});
