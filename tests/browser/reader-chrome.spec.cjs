const { test, expect } = require('@playwright/test');
const { fixture } = require('./fixture.cjs');

for (const width of [1440, 1920]) {
  test(`reader controls stay in the sidebar and opened stories fill the reading area at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page);
    await expect(page.locator('.masthead, #account, #username, #logout, #feeds-heading')).toHaveCount(0);
    await expect(page.getByText('Your feeds', { exact: true })).toHaveCount(0);
    const controls = page.getByRole('group', { name: 'Reader controls' });
    await expect(controls.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Appearance', exact: true })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Keyboard shortcuts', exact: true })).toBeVisible();
    expect((await page.locator('#reader').boundingBox()).y).toBe(0);
    await page.getByRole('button', { name: 'Synthetic feed', exact: false }).click();
    for (const layout of ['cards', 'magazine']) {
      await page.getByLabel('Story layout', { exact: true }).selectOption(layout);
      await page.locator('#stories .story').first().click();
      const reader = await page.locator('#reader').boundingBox();
      const sidebar = await page.locator('.subscriptions').boundingBox();
      const article = await page.locator('#article').boundingBox();
      expect(Math.abs(article.x - (sidebar.x + sidebar.width))).toBeLessThan(2);
      expect(Math.abs(article.width - (reader.width - sidebar.width))).toBeLessThan(2);
      const contentWidth = await page.locator('#article-content').evaluate(node => node.getBoundingClientRect().width);
      expect(contentWidth).toBeGreaterThan(article.width - 140);
      await controls.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
      await expect(page.locator('#shortcuts')).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Back to stories', exact: true }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
