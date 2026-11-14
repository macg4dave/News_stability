const { test, expect } = require('@playwright/test');
const { fixture, story } = require('./fixture.cjs');

for (const layout of ['cards', 'magazine', 'list']) {
  test(`${layout}: sidebar stays in place and scrolls without moving or marking the main page`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    const model = await fixture(page);
    model.stories = Array.from({ length: 40 }, (_, i) => story(i ? `1:side${i}` : '1:abc', `Sidebar report ${i}`));
    model.fullTexts['1:abc'] = '<p>A long synthetic article.</p>'.repeat(60);
    const feeds = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, title: i ? `Reader feed ${i}` : 'Synthetic feed', positive: 0, neutral: 0 }));
    await page.route('**/api/feeds', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ feeds, folders: [] }) }));
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.locator('#feed-tree .feed')).toHaveCount(80);
    await page.getByLabel('Story layout', { exact: true }).selectOption(layout);
    await page.getByRole('button', { name: 'Synthetic feed' }).click();
    const sidebar = page.locator('.subscriptions');
    await page.evaluate(() => window.scrollTo(0, 1000));
    expect((await sidebar.boundingBox()).y).toBe(0);
    const mainY = await page.evaluate(() => scrollY);
    await page.mouse.move(110, 400);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => sidebar.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(mainY);
    await sidebar.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.mouse.wheel(0, 2000);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => scrollY)).toBe(mainY);
    await sidebar.evaluate(node => { node.scrollTop = 0; });
    await page.getByRole('button', { name: 'Back to top', exact: true }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.locator('#stories .story').first().click();
    await expect(page.locator('#full-text-status')).toHaveText('Full text from NewsBlur.');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect((await sidebar.boundingBox()).y).toBe(0);
    await page.mouse.move(110, 400);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => sidebar.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    await sidebar.focus();
    await page.keyboard.press('PageDown');
    expect(model.actions).toEqual([]);
  });
}
