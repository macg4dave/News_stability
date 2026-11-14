const { test, expect } = require('@playwright/test');
const { fixture, story } = require('./fixture.cjs');

for (const layout of ['cards', 'magazine', 'list']) {
  test(`${layout}: floating page tools return collection and article to the top without marking read`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const model = await fixture(page);
    model.stories = Array.from({ length: 30 }, (_, i) => story(i ? `1:top${i}` : '1:abc', `Top report ${i}`));
    model.fullTexts['1:abc'] = '<p>A long synthetic article for checking the floating toolbar.</p>'.repeat(80);
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    await page.getByRole('button', { name: 'Synthetic feed' }).click();
    const toolbar = page.getByRole('group', { name: 'Page tools' });
    const top = toolbar.getByRole('button', { name: 'Back to top', exact: true });
    expect(await toolbar.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    const selector = await page.getByRole('group', { name: 'Story layout', exact: true }).boundingBox();
    const initial = await top.boundingBox();
    expect(initial.x).toBeGreaterThanOrEqual(selector.x + selector.width);
    await page.evaluate(() => window.scrollTo(0, 1200));
    const floating = await top.boundingBox();
    expect(floating.y).toBe(initial.y);
    expect(floating.x).toBe(initial.x);
    await top.click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.locator('#stories .story').first().click();
    await expect(page.locator('#full-text-status')).toHaveText('Full text from NewsBlur.');
    await page.evaluate(() => window.scrollTo(0, 2000));
    await top.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator('#article')).toBeVisible();
    expect(model.actions).toEqual([]);
  });
}

test('page tools scroll smoothly to the top with normal motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const model = await fixture(page);
  model.fullTexts['1:abc'] = '<p>A long synthetic article.</p>'.repeat(80);
  await page.getByRole('button', { name: 'Synthetic feed' }).click();
  await page.locator('#stories .story').first().click();
  await expect(page.locator('#full-text-status')).toHaveText('Full text from NewsBlur.');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.getByRole('button', { name: 'Back to top', exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(model.actions).toEqual([]);
});
