const { test, expect } = require('@playwright/test');
const { fixture } = require('./fixture.cjs');
const widthKey = 'news-stability-sidebar-width-v1';

test('All feeds opens after sign-in and reopening the reader', async ({ page }) => {
  const model = await fixture(page);
  expect(model.initialReads).toHaveLength(1);
  expect(model.initialReads[0].get('read_filter')).toBe('all');
  await expect(page.getByRole('button', { name: 'All feeds', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Synthetic feed' }).click();
  await expect(page.locator('#stories-heading')).toHaveText('Synthetic feed');
  await page.reload();
  await expect(page.locator('#stories-heading')).toHaveText('All feeds');
  await expect(page.locator('#stories .story')).toHaveCount(2);
  expect(model.actions).toEqual([]);
});

test('sidebar drag persists its width, reflows the page and restores safely on a smaller screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const model = await fixture(page);
  const sidebar = page.locator('.subscriptions');
  const handle = page.getByRole('separator', { name: 'Resize feed sidebar' });
  const before = (await sidebar.boundingBox()).width;
  const grip = await handle.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, 200);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 100, 200, { steps: 5 });
  await page.mouse.up();
  const after = (await sidebar.boundingBox()).width;
  expect(Math.abs(after - before - 100)).toBeLessThanOrEqual(1);
  expect(Math.abs((await page.locator('.story-list').boundingBox()).x - after)).toBeLessThan(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), widthKey)).toBe(Math.round(after));
  await page.reload();
  await expect(page.locator('#stories-heading')).toHaveText('All feeds');
  expect(Math.abs((await sidebar.boundingBox()).width - after)).toBeLessThanOrEqual(1);
  await handle.focus();
  await page.keyboard.press('End');
  await expect(handle).toHaveAttribute('aria-valuenow', '480');
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(handle).toHaveAttribute('aria-valuemax', '409');
  expect((await sidebar.boundingBox()).width).toBeLessThanOrEqual(410);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(handle).toHaveAttribute('aria-valuenow', '480');
  await page.keyboard.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '208');
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '224');
  await handle.dblclick();
  expect(Math.abs((await sidebar.boundingBox()).width - before)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(key => localStorage.getItem(key), widthKey)).toBeNull();
  expect(model.actions).toEqual([]);
});

test('sidebar keyboard resizing works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await fixture(page);
  const handle = page.getByRole('separator', { name: 'Resize feed sidebar' });
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', String(before + 16));
});
