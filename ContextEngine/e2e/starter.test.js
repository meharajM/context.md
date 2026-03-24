describe('Context Engine E2E', () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: { microphone: 'YES' },
      newInstance: true
    });
  });

  it('should display the app title', async () => {
    await waitFor(element(by.id('app_title'))).toBeVisible().withTimeout(15000);
    await expect(element(by.text('Context Engine'))).toBeVisible();
  });

  it('should toggle the background ear listening', async () => {
    await element(by.id('ear_toggle')).tap();
    await expect(element(by.text('● Ear Active (Background)'))).toBeVisible();
    await element(by.id('ear_toggle')).tap();
    await expect(element(by.text('○ Ear Disabled (Tap to enable)'))).toBeVisible();
  });

  it('should allow manual thought entry and saving', async () => {
    const testThought = 'This is a test thought from Detox';
    await element(by.id('thought_input')).replaceText(testThought);
    await element(by.id('save_button')).tap();
    
    // Verify it appears in the list
    await waitFor(element(by.text(testThought))).toBeVisible().withTimeout(5000);
  });

  it('should toggle voice recording status', async () => {
    await element(by.id('record_button')).tap();
    await expect(element(by.text('Listening...'))).toBeVisible();
    await element(by.id('record_button')).tap();
    await waitFor(element(by.text('Thinking...'))).toBeVisible().withTimeout(5000);
  });
});
