const { test, expect } = require('@playwright/test');
const { fixture, story } = require('./fixture.cjs');

for (const [width, columns] of [[1024, 2], [1440, 3], [1920, 4], [2560, 6]]) {
  test(`${width}px uses the collection width with comfortable adaptive Cards`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const model = await fixture(page);
    model.stories = Array.from({ length: 12 }, (_, i) => ({ ...story(`1:space${i}`, `Report ${i}`), excerpt: 'A useful introduction with room to breathe.' }));
    await page.getByRole('button', { name: 'Synthetic feed' }).click();
    for (const layout of ['cards', 'magazine', 'list']) {
      await page.getByLabel('Story layout', { exact: true }).selectOption(layout);
      const sidebar = await page.locator('.subscriptions').boundingBox();
      const collection = await page.locator('.story-list').boundingBox();
      expect(Math.abs(collection.x - sidebar.width)).toBeLessThan(1);
      expect(Math.abs(collection.x + collection.width - width)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (layout === 'cards') {
        const grid = await page.locator('#stories').evaluate(node => ({ columns: getComputedStyle(node).gridTemplateColumns.split(' ').length, gap: parseFloat(getComputedStyle(node).columnGap) }));
        expect(grid.columns).toBe(columns);
        expect(grid.gap).toBeGreaterThanOrEqual(20);
        expect((await page.locator('#stories .story').first().boundingBox()).width).toBeGreaterThanOrEqual(320);
      }
    }
    expect(model.actions).toEqual([]);
  });
}

test('wide articles flow text beside the lead photo and keep the return control below it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  const model = await fixture(page);
  model.stories[0].picture = 'https://fixture.invalid/lead.svg';
  model.fullTexts['1:abc'] = '<p>A substantial opening paragraph with readable text beside a photograph. </p>'.repeat(8);
  await page.route('https://fixture.invalid/lead.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"/>' }));
  await page.getByRole('button', { name: 'Synthetic feed' }).click();
  await page.locator('#stories .story').first().click();
  await expect(page.locator('#full-text-status')).toHaveText('Full text from NewsBlur.');
  const body = await page.locator('#article-content').boundingBox();
  const photo = await page.locator('#article-content .article-picture').boundingBox();
  expect(photo.width).toBeLessThan(body.width / 2);
  expect(photo.x).toBeGreaterThan(body.x + body.width / 2);
  const back = await page.locator('#story-return').boundingBox();
  expect(back.y).toBeGreaterThanOrEqual(photo.y + photo.height);
  expect(model.actions).toEqual([]);
});
