const { test, expect } = require("@playwright/test");

async function control(request, mode) {
  const response = await request.post(process.env.E2E_CONTROL_URL, { data: { mode } });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function login(page, request, mode = "healthy") {
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Fixture feed", exact: false }).click();
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
    const errors = await login(page, request);
    for (const layout of ["cards", "magazine", "list"]) {
      await page.locator("#story-layout").selectOption(layout);
      await decoded(page.locator("#stories img").first());
    }
    for (let index = 0; index < 4; index++) await decoded(page.locator(`.story[data-hash="1:story${index}"] img`));
    await page.getByRole("button", { name: "Fixture story 0", exact: false }).first().click();
    await expect(page.locator("#article-content")).toContainText("Complete article from NewsBlur.");
    await decoded(page.locator("#article-content img").first());
    await expect(page.locator("#article")).toBeVisible();
    expect(await page.evaluate(() => window.policyViolations)).toEqual([]);
    expect(errors).toEqual([]);
    const state = await (await request.get(process.env.E2E_CONTROL_URL)).json();
    expect(state.images).toBeGreaterThan(0);
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
  await expect(page.locator('.story[data-hash="1:story0"] .read-dot')).toHaveAttribute("title", "Unread");
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
  await expect(page.locator('.story[data-hash="1:story0"] .read-dot')).toHaveAttribute("title", "Read");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  const response = await page.request.get(picture);
  expect(response.status()).toBe(401);
});

