const { test, expect } = require("@playwright/test");
const sessionTokens = new WeakMap();

async function control(request, mode) {
  const response = await request.post(process.env.E2E_CONTROL_URL, { data: { mode } });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function login(page, request, mode = "healthy", remember = false) {
  await control(request, "reset");
  await control(request, mode);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.policyViolations = [];
    document.addEventListener("securitypolicyviolation", event => window.policyViolations.push(event.violatedDirective));
  });
  // Never fulfill API or image requests: exercise browser -> Nginx -> Go -> TLS.
  await page.route(/^https?:\/\//, route => new URL(route.request().url()).origin === process.env.E2E_BASE_URL ? route.continue() : route.abort());
  await page.goto("/");
  await page.getByLabel("NewsBlur username").fill("fixture");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await expect(page.getByRole("checkbox", { name: "Remember me", exact: true })).not.toBeChecked();
  if (remember) await page.getByRole("checkbox", { name: "Remember me", exact: true }).check();
  const loginResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  sessionTokens.set(page, (await (await loginResponse).json()).csrf_token);
  await expect(page.locator("#stories-heading")).toHaveText("All feeds");
  await expect(page.getByRole("button", { name: "All feeds", exact: true })).toHaveAttribute("aria-current", "true");
  await page.locator("#feed-tree").getByRole("button", { name: "Fixture feed", exact: false }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Fixture feed");
  await expect(page.getByRole("button", { name: "Fixture story 0", exact: false }).first()).toBeVisible();
  return errors;
}
async function decoded(image) {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(async img => {
    try { await img.decode(); return img.complete && img.naturalWidth > 0 && img.getBoundingClientRect().width > 0; }
    catch { return false; }
  })).toBe(true);
}

for (const width of [1440, 1024]) {
  test(`shipped images decode in every layout and inline article at width ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = await login(page, request, "healthy", width === 1440);
    if (width === 1440) {
      const resize = page.getByRole("separator", { name: "Resize feed sidebar" });
      const before = (await page.locator(".subscriptions").boundingBox()).width;
      await resize.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await page.locator(".subscriptions").boundingBox()).width).toBe(Math.round(before + 16));
      await resize.dblclick();
      await expect.poll(async () => (await page.locator(".subscriptions").boundingBox()).width).toBe(before);
    }
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(cookie => cookie.name === "reader_session");
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.sameSite).toBe("Strict");
    if (width === 1440) {
      expect(sessionCookie.expires).toBeGreaterThan(Date.now() / 1000 + 29 * 86400);
      const restored = await page.context().browser().newContext({ storageState: { cookies: cookies.filter(cookie => cookie.expires > Date.now() / 1000), origins: [] } });
      try {
        const response = await restored.request.get(process.env.E2E_BASE_URL + "/api/feeds");
        expect(response.ok()).toBe(true);
        expect((await response.json()).feeds[0].title).toBe("Fixture feed");
      } finally { await restored.close(); }
    } else expect(sessionCookie.expires).toBe(-1);
    if (width === 1440) {
      await page.setViewportSize({ width: 2560, height: 1000 });
      const collection = await page.locator(".story-list").boundingBox();
      expect(Math.abs(collection.x + collection.width - 2560)).toBeLessThan(1);
      await decoded(page.locator("#stories img").first());
      await page.setViewportSize({ width, height: 900 });
    }
    for (const layout of ["cards", "magazine", "list"]) {
      await page.locator("#story-layout").selectOption(layout);
      await decoded(page.locator("#stories img").first());
    }
    for (let index = 0; index < 4; index++) await decoded(page.locator(`.story[data-hash="1:story${index}"] img`));
    await page.getByRole("button", { name: "Fixture story 0", exact: false }).first().click();
    await expect(page.locator("#article-content")).toContainText("Complete article from NewsBlur.");
    await decoded(page.locator("#article-content img").first());
    await expect(page.locator("#article-content figcaption")).toHaveText("Synthetic landscape. Credit: Fixture photographer.");
    expect(await page.locator("#article-content img").first().evaluate(node => node.naturalWidth)).toBe(640);
    await expect(page.locator("#article")).toBeVisible();
    const bottomReturn = page.getByRole("button", { name: "Back to previous page", exact: true });
    await bottomReturn.scrollIntoViewIfNeeded();
    await expect(bottomReturn.locator("svg")).toBeVisible();
    await bottomReturn.click();
    await expect(page.locator("#article")).toBeHidden();
    await expect(page.locator('.story[data-hash="1:story0"]')).toBeFocused();
    await expect(page.locator('.story[data-hash="1:story0"]')).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => window.policyViolations)).toEqual([]);
    expect(errors).toEqual([]);
    const state = await (await request.get(process.env.E2E_CONTROL_URL)).json();
    expect(state.images).toBeGreaterThan(0);
    if (width === 1440) await checkPortraitComposition(page, request);
    expect(errors).toEqual([]);
  });
}

for (const mode of ["images-fail", "image-invalid"]) {
  test(`${mode}: broken images produce a fallback; full text failure keeps the excerpt`, async ({ page, request }) => {
    await login(page, request, mode);
    await expect(page.locator("#stories .picture-fallback").first()).toBeVisible();
    await control(request, "text-fail");
    await page.getByRole("button", { name: "Fixture story 0", exact: false }).first().click();
    await expect(page.locator("#article-content")).toContainText("Feed excerpt.");
  });
}

async function checkPortraitComposition(page, request) {
  await page.emulateMedia({ colorScheme: "dark" });
  await control(request, "portrait-lead");
  await page.getByRole("button", { name: "All feeds", exact: true }).click();
  await expect(page.locator("#stories-heading")).toHaveText("All feeds");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.getByLabel("Story layout", { exact: true }).selectOption("magazine");
  const image = page.locator("#stories img").first();
  await decoded(image);
  expect(await image.evaluate(node => node.naturalHeight > node.naturalWidth)).toBe(true);
  await expect(page.locator("#stories > li").first()).toHaveAttribute("data-press-role", "portrait");
  const main = await page.locator("#stories .story").nth(0).boundingBox();
  const beside = await page.locator("#stories .story").nth(1).boundingBox();
  expect(beside.width).toBeGreaterThan(main.width * 1.8);
  expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe("contain");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await expect(page.getByLabel("Background", { exact: true })).toHaveCount(0);
  await page.getByLabel("Pictures", { exact: true }).selectOption("hide");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator("#stories .story-picture").first()).toBeHidden();
  await expect(page.locator("#stories > li").first()).toHaveAttribute("data-press-role", "brief");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => window.policyViolations)).toEqual([]);
}

test("pictures stay unfetched when hidden and decode after enabling them", async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem("news-stability-pictures-v1", "hide"));
  await login(page, request);
  await expect(page.locator("#stories img").first()).not.toHaveAttribute("src");
  expect((await (await request.get(process.env.E2E_CONTROL_URL)).json()).images).toBe(0);
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.locator("#appearance-pictures").selectOption("show");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await decoded(page.locator("#stories img").first());
});

test("endless loading reaches every story exactly once", async ({ page, request }) => {
  await login(page, request);
  await page.locator("#story-layout").selectOption("list");
  for (let index = 0; index < 12; index++) {
    const button = page.locator(`.story[data-hash="1:story${index}"]`);
    await expect(button).toHaveCount(1);
    await button.scrollIntoViewIfNeeded();
  }
  await expect(page.locator("#stories > li")).toHaveCount(12);
});

test("All feeds and folders read through the river and thumbs update NewsBlur Focus", async ({ page, request }) => {
  await login(page, request);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Saved stories", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "All feeds", exact: true }).click();
  await expect(page.locator("#stories-heading")).toHaveText("All feeds");
  await decoded(page.locator("#stories img").first());
  await page.getByRole("button", { name: "Read Reading", exact: true }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Reading");
  await page.getByRole("button", { name: "Fixture story 0", exact: false }).first().click();
  await page.getByRole("button", { name: "Dislike selected choice", exact: true }).click();
  await expect(page.locator("#feedback-status")).toContainText("confirmed your feedback");
  let state = await (await request.get(process.env.E2E_CONTROL_URL)).json();
  expect(state.training["title:Fixture story 0"]).toBe(-1);
  await page.getByRole("button", { name: /^Focus / }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Focus");
  await expect(page.locator('.story[data-hash="1:story3"]')).toBeVisible();
  await expect(page.locator('.story[data-hash="1:story0"]')).toHaveCount(0);
  await expect(page.locator('.story[data-hash="1:story1"]')).toHaveCount(0);
  await page.getByRole("button", { name: "All feeds", exact: true }).click();
  await page.getByRole("button", { name: "Fixture story 0", exact: false }).first().click();
  await page.getByRole("button", { name: "Like selected choice", exact: true }).click();
  await expect(page.locator("#feedback-status")).toContainText("confirmed your feedback");
  state = await (await request.get(process.env.E2E_CONTROL_URL)).json();
  expect(state.training["title:Fixture story 0"]).toBe(1);
  await page.getByRole("button", { name: "Clear training", exact: true }).click();
  await expect(page.locator("#feedback-status")).toContainText("Training cleared");
  await control(request, "feedback-fail");
  await page.getByRole("button", { name: "Like selected choice", exact: true }).click();
  await expect(page.locator("#feedback-status")).toContainText("could not apply");
  await expect(page.locator("#like-story")).toHaveAttribute("aria-pressed", "false");
});

test("a rejected read write leaves the story unread", async ({ page, request }) => {
  await login(page, request);
  await control(request, "read-fail");
  await page.locator("#story-layout").selectOption("list");
  await page.getByRole("button", { name: "Fixture story 0", exact: false }).first().click();
  await expect(page.locator("#article-content")).toContainText("Complete article");
  const rejected = page.waitForResponse(response => response.url().endsWith("/state") && response.request().method() === "POST");
  await page.mouse.wheel(0, 10000);
  expect((await rejected).ok()).toBe(false);
  await expect(page.locator('.story[data-hash="1:story0"]')).not.toHaveClass(/\bread\b/);
  await expect(page.locator('.story[data-hash="1:story0"] .read-indicator')).toHaveAttribute("title", "Unread");
  expect((await (await request.get(process.env.E2E_CONTROL_URL)).json()).reads).toEqual({});
});

test("upstream session expiry clears private content", async ({ page, request }) => {
  await login(page, request);
  // Focused article pauses automatic collection loading before expiring upstream.
  await page.getByRole("button", { name: "Fixture story 0", exact: false }).first().click();
  await expect(page.locator("#article-content")).toContainText("Complete article");
  await control(request, "expired");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.locator("#stories")).toBeEmpty();
  await expect(page.locator("#article-content")).toBeEmpty();
});

test("scrolling confirms read state through the real server and logout protects pictures", async ({ page, request }) => {
  await login(page, request);
  await page.locator("#story-layout").selectOption("list");
  const picture = await page.locator("#stories img").first().getAttribute("src");
  await page.getByRole("button", { name: "Fixture story 0", exact: false }).first().click();
  await expect(page.locator("#article-content")).toContainText("Complete article");
  await page.mouse.wheel(0, 10000);
  await expect.poll(async () => (await (await request.get(process.env.E2E_CONTROL_URL)).json()).reads["1:story0"]).toBe(true);
  await expect(page.locator('.story[data-hash="1:story0"] .read-indicator')).toHaveAttribute("title", "Read");
  const signedOut = await page.request.post("/api/logout", { headers: { "X-CSRF-Token": sessionTokens.get(page), Origin: process.env.E2E_BASE_URL }, data: {} });
  expect(signedOut.ok()).toBe(true);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  const response = await page.request.get(picture);
  expect(response.status()).toBe(401);
});

