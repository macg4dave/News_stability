const { test, expect } = require('@playwright/test');
const { fixture, story } = require('./fixture.cjs');
const photo = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#987"/></svg>';
const tiny = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>';

test('newspaper chooses a substantial source photo after a tiny candidate', async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].pictures = ['https://fixture.invalid/tiny.svg', 'https://fixture.invalid/photo.svg'];
  const requested = [];
  await page.route('https://fixture.invalid/**', route => {
    requested.push(route.request().url());
    return route.fulfill({ contentType: 'image/svg+xml', body: route.request().url().includes('tiny') ? tiny : photo });
  });
  await page.locator(`[data-layout-choice="${'magazine'}"]`).click();
  await page.getByRole('button', { name: 'Synthetic feed' }).click();
  const image = page.locator('#stories img').first();
  await expect(image).toHaveAttribute('src', 'https://fixture.invalid/photo.svg');
  await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBe(640);
  expect(requested).toEqual(['https://fixture.invalid/tiny.svg', 'https://fixture.invalid/photo.svg']);
  expect(model.actions).toEqual([]);
});

test('tiny photos stay modest and short stories form an ordered brief band', async ({ page }) => {
  const model = await fixture(page);
  model.stories = Array.from({ length: 3 }, (_, i) => ({ ...story(`1:brief${i}`, `Short report ${i}`), excerpt: 'The essential facts in one complete sentence.', ...(i === 0 ? { picture: 'https://fixture.invalid/tiny.svg' } : {}) }));
  await page.route('https://fixture.invalid/tiny.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: tiny }));
  await page.locator(`[data-layout-choice="${'magazine'}"]`).click();
  await page.getByRole('button', { name: 'Synthetic feed' }).click();
  await expect(page.locator('#stories .small-picture')).toHaveCount(1);
  await expect(page.locator('#stories [data-press-role="brief"]')).toHaveCount(3);
  await expect(page.locator('#stories [data-brief-start]')).toHaveCount(1);
  expect(await page.locator('#stories .story').evaluateAll(nodes => nodes.map(node => node.dataset.hash))).toEqual(['1:brief0', '1:brief1', '1:brief2']);
  expect(await page.locator('#stories img').evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(96);
  expect(model.actions).toEqual([]);
});

test('supporting introductions end at sentences and restore in Cards', async ({ page }) => {
  const model = await fixture(page);
  const copy = 'A complete sentence with useful background and carefully reported detail. '.repeat(14).trim();
  model.stories = Array.from({ length: 3 }, (_, i) => ({ ...story(`1:balanced${i}`, `Balanced story ${i}`), excerpt: copy, ...(i === 0 ? { picture: 'https://fixture.invalid/photo.svg' } : {}) }));
  await page.route('https://fixture.invalid/photo.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: photo }));
  await page.locator(`[data-layout-choice="${'magazine'}"]`).click();
  await page.getByRole('button', { name: 'Synthetic feed' }).click();
  await expect(page.locator('#stories > li').first()).toHaveAttribute('data-press-role', 'lead');
  const side = page.locator('#stories .story-excerpt').nth(1);
  await expect.poll(async () => (await side.textContent()).length).toBeLessThanOrEqual(620);
  expect(await side.textContent()).toMatch(/detail\.$/);
  await page.locator(`[data-layout-choice="${'cards'}"]`).click();
  await expect(side).toHaveText(copy);
  expect(model.actions).toEqual([]);
});

test('opened articles preserve caption and credit with readable typography', async ({ page }) => {
  const model = await fixture(page);
  model.fullTexts['1:abc'] = '<p>Opening paragraph.</p><figure><img data-picture-src="https://fixture.invalid/photo.svg" alt="A landscape"><figcaption>A landscape. Credit: Fixture photographer.</figcaption></figure><blockquote>A source quotation.</blockquote>';
  await page.route('https://fixture.invalid/photo.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: photo }));
  await page.getByRole('button', { name: 'Synthetic feed' }).click();
  await page.locator('#stories .story').first().click();
  await expect(page.locator('#article-content figcaption')).toHaveText('A landscape. Credit: Fixture photographer.');
  expect(await page.locator('#article-content').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(800);
  await page.locator("#main").focus();
  await page.keyboard.press("a");
  await page.getByLabel('Article font', { exact: true }).selectOption('sans');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await page.locator('#article-content').evaluate(node => getComputedStyle(node).fontFamily)).toContain('sans-serif');
});
