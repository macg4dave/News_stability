const { test, expect } = require('@playwright/test');
const { fixture } = require('./fixture.cjs');

for (const remember of [false, true]) {
  test(`Remember me sends the selected login choice: ${remember}`, async ({ page }) => {
    const model = await fixture(page, undefined, remember);
    expect(model.loginRequests).toHaveLength(1);
    expect(model.loginRequests[0].remember_me).toBe(remember);
    await expect(page.locator('#login-password')).toHaveValue('');
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  });
}

test('a remembered session does not expire immediately or extend beyond 30 days', async ({ page }) => {
  await page.clock.install();
  await fixture(page, undefined, true);
  await page.clock.fastForward(1000);
  await expect(page.locator('#reader')).toBeVisible();
  await page.clock.fastForward(29 * 86400000);
  await expect(page.locator('#reader')).toBeVisible();
  await page.clock.fastForward(2 * 86400000);
  await expect(page.locator('#reader')).toBeHidden();
  await expect(page.getByRole('checkbox', { name: 'Remember me', exact: true })).not.toBeChecked();
});
