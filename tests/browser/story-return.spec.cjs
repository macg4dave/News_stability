const { test, expect } = require('@playwright/test');
const { fixture } = require('./fixture.cjs');

for (const layout of ['cards', 'magazine', 'list']) {
  test(`${layout}: bottom return closes the story and restores its headline without marking it read`, async ({ page }) => {
    const model = await fixture(page);
    model.fullTexts['1:abc'] = '<p>A long synthetic article for returning from the end.</p>'.repeat(70);
    await page.getByLabel('Story layout', { exact: true }).selectOption(layout);
    await page.getByRole('button', { name: 'Synthetic feed' }).click();
    const origin = page.locator('#stories .story').first();
    await origin.click();
    await expect(page.locator('#full-text-status')).toHaveText('Full text from NewsBlur.');
    const back = page.getByRole('button', { name: 'Back to previous page', exact: true });
    await back.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
    if (layout === 'list') {
      await expect(back.locator('svg')).toBeVisible();
      await expect(back.locator('span')).toBeHidden();
      await expect(back).toHaveAttribute('title', 'Back to previous page');
    } else {
      await expect(back.locator('svg')).toBeHidden();
      await expect(back.locator('span')).toBeVisible();
    }
    await back.click();
    await expect(page.locator('#article')).toBeHidden();
    await expect(origin).toBeFocused();
    await expect(origin).toBeInViewport();
    if (layout === 'list') await expect(origin).toHaveAttribute('aria-expanded', 'false');
    expect(model.actions).toEqual([]);
  });
}
