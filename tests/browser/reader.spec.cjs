const { test, expect } = require("@playwright/test");

const { fixture, story } = require("./fixture.cjs");

async function expireSession(page, model) {
  model.expired = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator("#reader")).toBeHidden();
}

async function openStory(page) {
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await page.getByRole("button", { name: "Synthetic story", exact: false }).first().click();
  await expect(page.locator("#article-title")).toHaveText("Synthetic story");
  await expect(page.locator("#article-content")).toBeVisible();
}

test("scrolling through an article marks it read and session expiry clears content", async ({ page }) => {
  const model = await fixture(page);
  model.fullTexts["1:abc"] = "<p>A long synthetic article for scrolling.</p>".repeat(60);
  await openStory(page);
  await expect(page.locator("#full-text-status")).toHaveText("Full text from NewsBlur.");
  await expect(page.getByRole("button", { name: /^(Mark read|Mark unread|Save story|Unsave story)$/ })).toHaveCount(0);
  expect(model.actions).toEqual([]);
  await page.mouse.wheel(0, 20000);
  await expect(page.locator('#stories .story').first()).toHaveClass(/read/);
  expect(model.actions).toEqual(["read"]);
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  await expireSession(page, model);
  await expect(page.locator("#reader")).toBeHidden();
  await expect(page.locator("#article-content")).toBeEmpty();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("failed automatic read keeps unread state and pauses until refresh", async ({ page }) => {
  const model = await fixture(page);
  model.fullTexts["1:abc"] = "<p>A long synthetic article for scrolling.</p>".repeat(60);
  model.failAction = true;
  await openStory(page);
  await expect(page.locator("#full-text-status")).toHaveText("Full text from NewsBlur.");
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, 20000);
  await expect(page.locator("#notice")).toContainText("Could not mark stories read");
  await expect(page.locator("#stories .story").first()).not.toHaveClass(/read/);
  await expect(page.locator("#article-title")).toHaveText("Synthetic story");
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, -500);
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, 500);
  expect(model.actions).toEqual(["read"]);
  model.failAction = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => model.reads.length).toBe(2);
  await expect(page.locator("#stories")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#full-text-status")).toHaveText("Full text from NewsBlur.");
  await expect(page.locator("#story-status")).toHaveText("2 stories");
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, 20000);
  await expect(page.locator("#stories .story").first()).toHaveClass(/read/);
  expect(model.actions).toEqual(["read", "read"]);
});

test("unread filters use NewsBlur and persist across pagination without search", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  model.hasMore = true;
  await page.getByLabel("Show", { exact: true }).selectOption("unread");
  await expect(page.locator("#article-content")).toBeEmpty();
  await expect.poll(() => model.reads.at(-1).get("page")).toBe("2");
  expect(model.reads.at(-1).has("query")).toBe(false);
  expect(model.reads.at(-1).get("read_filter")).toBe("unread");
});

test("failed automatic loading preserves stories and retries the same batch", async ({ page }) => {
  const model = await fixture(page);
  model.hasMore = true;
  model.failMore = true;
  await openStory(page);
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry loading stories" })).toBeVisible();
  await expect(page.locator("#stream-status")).toHaveClass(/error/);
  await expect(page.locator("#article-title")).toHaveText("Synthetic story");
  await expect(page.locator("#stories .story")).toHaveCount(2);
  model.failMore = false;
  model.pages[2] = { stories: [story("1:more", "Another story")], page: 2, can_continue: false };
  await page.getByRole("button", { name: "Retry loading stories" }).click();
  await expect(page.locator("#stories .story")).toHaveCount(3);
  expect(model.reads.slice(-2).map(params => params.get("page"))).toEqual(["2", "2"]);
});

test("keyboard navigation pauses in inputs and appearance survives reload", async ({ page }) => {
  await fixture(page);
  await openStory(page);
  await page.keyboard.press("j");
  await expect(page.locator("#article-title")).toHaveText("Second synthetic story");
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  await page.getByLabel("Show", { exact: true }).focus();
  await page.keyboard.press("k");
  await expect(page.locator("#article-title")).toHaveText("Second synthetic story");
  await page.locator("#main").focus();
  await page.keyboard.press("a");
  await page.getByLabel("Article text size", { exact: true }).selectOption("large");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(["news-stability-appearance-v1"]);
});

test("Warm paper overrides legacy themes and system dark mode while retaining type preferences", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("news-stability-appearance-v1", JSON.stringify({ theme: "dark", font: "sans", size: "large" })));
  await fixture(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  expect(await page.locator("html").evaluate(node => ({ background: getComputedStyle(node).backgroundColor, scheme: getComputedStyle(node).colorScheme }))).toEqual({ background: "rgb(245, 237, 228)", scheme: "light" });
  await page.locator("#main").focus();
  await page.keyboard.press("a");
  await expect(page.getByLabel("Background", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Article font", { exact: true })).toHaveValue("sans");
  await expect(page.getByLabel("Article text size", { exact: true })).toHaveValue("large");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("news-stability-appearance-v1")))).toEqual({ font: "sans", size: "large" });
});

test("upstream expiry clears account content and shows sign-in", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  model.expired = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator("#reader")).toBeHidden();
  await expect(page.locator("#article-content")).toBeEmpty();
  await expect(page.locator("#login-status")).toContainText("expired");
});

test("unsupported briefing is explicit", async ({ page }) => {
  await fixture(page);
  await page.getByRole("button", { name: "Daily Briefing", exact: true }).click();
  await expect(page.locator("#story-status")).toContainText("not available");
});

test("desktop reading and dialogs fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await fixture(page);
  await openStory(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#main").focus();
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("refresh reloads authoritative story state and preserves collapsed folders", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  await page.locator("#feed-tree summary").click();
  model.stories[0].read = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator("#article-meta")).toContainText("Read");
  await expect(page.locator("#article-meta")).not.toContainText("Saved");
  await expect(page.locator("#feed-tree details")).not.toHaveAttribute("open", "");
});

test("NewsBlur related story opens by hash and external hyperlinks stay isolated", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].related = [{ hash: "1:linked", title: "Read related coverage" }];
  await openStory(page);
  await expect(page.locator("#original")).toHaveAttribute("rel", /noreferrer/);
  await page.getByRole("button", { name: "Read related coverage", exact: true }).click();
  await expect(page.locator("#article-title")).toHaveText("Linked synthetic story");
});

test("layouts preserve stories, selection, filters and request state", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  await page.getByLabel("Show", { exact: true }).selectOption("unread");
  await expect(page.locator("#article-content")).toBeEmpty();
  await page.locator("#stories .story").first().click();
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  const reads = model.reads.length;
  const original = await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => node.dataset.hash));
  await page.locator("#stories .story").first().evaluate(node => { window.originalStoryNode = node; });
  for (const layout of ["magazine", "list", "cards"]) {
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    await expect(page.locator("#reader")).toHaveAttribute("data-layout", layout);
    await expect(page.locator("#article-title")).toHaveText("Synthetic story");
    await expect(page.locator('#stories .story[aria-current="true"]')).toHaveCount(1);
    await expect(page.getByLabel("Show", { exact: true })).toHaveValue("unread");
    expect(await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => node.dataset.hash))).toEqual(original);
    expect(await page.locator("#stories .story").first().evaluate(node => node === window.originalStoryNode)).toBe(true);
  }
  expect(model.reads).toHaveLength(reads);
  expect(model.actions).toEqual([]);
  await page.locator("#stories .story").first().click();
  await expect(page.getByRole("button", { name: "Save story", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
  await page.reload();
  await expect(page.locator("#reader")).toHaveAttribute("data-layout", "magazine");
  await page.getByRole("button", { name: "All feeds", exact: true }).click();
  await expect(page.locator("#stories")).toContainText("Synthetic story");
  await expect(page.locator("#reader")).toHaveAttribute("data-layout", "magazine");
});

test("invalid or unavailable layout storage keeps controls usable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("news-stability-layout-v1", "unknown"));
  await fixture(page);
  await expect(page.locator("#reader")).toHaveAttribute("data-layout", "cards");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error("Storage disabled"); };
  });
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await expect(page.locator("#reader")).toHaveAttribute("data-layout", "list");
});

test("all layouts fit a smaller desktop window with long titles", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const model = await fixture(page);
  model.stories[0].title = "LongHeadline".repeat(30);
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  for (const layout of ["cards", "magazine", "list"]) {
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("excerpts are inert text and disappear in compact List", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].excerpt = '<img src="https://tracker.invalid/pixel" onerror="alert(1)"> A preview.';
  model.stories[1].excerpt = "";
  await openStory(page);
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  await expect(page.locator("#stories .story-excerpt")).toHaveCount(1);
  await expect(page.locator("#stories .story-excerpt")).toContainText("<img");
  await expect(page.locator("#stories img")).toHaveCount(0);
  for (const layout of ["magazine", "list", "cards"]) {
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    if (layout === "list") await expect(page.locator("#stories .story-excerpt")).toBeHidden();
    else await expect(page.locator("#stories .story-excerpt")).toBeVisible();
  }
});

test("article return restores origin after linked coverage and preserves layout", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const model = await fixture(page);
  model.stories.push(...Array.from({ length: 10 }, (_, i) => story(`1:extra${i}`, `Additional story ${i}`)));
  model.stories[0].related = [{ hash: "1:linked", title: "Read related coverage" }];
  await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
  await openStory(page);
  await page.getByRole("button", { name: "Read related coverage", exact: true }).click();
  await expect(page.locator("#article-title")).toHaveText("Linked synthetic story");
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  await expect(page.locator("#stories .story").first()).toBeFocused();
  expect(await page.locator("#stories .story").first().evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.top >= 0 && rect.top < innerHeight;
  })).toBe(true);
  expect(model.actions).toEqual([]);
  await expect(page.getByRole("button", { name: "Back to stories", exact: true })).toBeHidden();
});

const pixelPNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==", "base64");

test("pictures use normal image requests without CORS or referrers", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].picture = "https://images.invalid/photo.png";
  model.stories[0].html = '<p>Readable article text.</p><img data-picture-src="https://images.invalid/inline.png" alt="A coastal scene">';
  const requests = [];
  await page.route("https://images.invalid/**", async route => {
    requests.push(await route.request().allHeaders());
    await route.fulfill({ contentType: "image/png", body: pixelPNG });
  });
  await openStory(page);
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.locator("#article-content img").evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator("#article-content img")).toHaveAttribute("alt", "A coastal scene");
  for (const request of requests) {
    expect(request.referer).toBeUndefined();
    expect(request.origin).toBeUndefined();
  }
  await expect(page.locator("#stories img")).not.toHaveAttribute("crossorigin");
  await expect(page.locator("#stories img")).toHaveAttribute("referrerpolicy", "no-referrer");
  expect(model.actions).toEqual([]);
});

test("hidden pictures avoid requests in List and Cards; preference survives reload", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("news-stability-layout-v1", "list");
    localStorage.setItem("news-stability-pictures-v1", "hide");
  });
  const model = await fixture(page);
  model.stories[0].picture = "https://images.invalid/photo.png";
  model.stories[0].html = '<p>Readable article text.</p><img data-picture-src="https://images.invalid/inline.png" alt="Coastal scene">';
  let requests = 0;
  await page.route("https://images.invalid/**", route => { requests++; return route.fulfill({ contentType: "image/png", headers: { "Access-Control-Allow-Origin": "*" }, body: pixelPNG }); });
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stories .story")).toHaveCount(2);
  await expect(page.locator("#stories img")).not.toHaveAttribute("src");
  expect(requests).toBe(0);
  await page.locator("#main").focus();
  await page.keyboard.press("a");
  await page.getByLabel("Pictures", { exact: true }).selectOption("hide");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator(`[data-layout-choice="${"cards"}"]`).click();
  await expect(page.locator("#stories .story-picture")).toBeHidden();
  await expect(page.locator("#stories img")).not.toHaveAttribute("src");
  expect(requests).toBe(0);
  await page.locator("#stories .story").first().click();
  await expect(page.locator("#article-content .article-picture")).toBeHidden();
  await expect(page.locator("#article-content img")).not.toHaveAttribute("src");
  expect(requests).toBe(0);
  await page.reload();
  await page.locator("#main").focus();
  await page.keyboard.press("a");
  await expect(page.getByLabel("Pictures", { exact: true })).toHaveValue("hide");
});

test("List shows compact thumbnails beside headlines on desktop window sizes", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].picture = "https://images.invalid/photo.png";
  await page.route("https://images.invalid/**", route => route.fulfill({ contentType: "image/png", body: pixelPNG }));
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  const image = page.locator("#stories .story-picture img");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const picture = await page.locator("#stories .story-picture").boundingBox();
    const title = await page.locator("#stories .story strong").first().boundingBox();
    expect(picture.width).toBeLessThanOrEqual(60);
    expect(picture.height).toBeLessThanOrEqual(60);
    expect(title.x).toBeGreaterThanOrEqual(picture.x + picture.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.locator("#stories .story").nth(1).locator(".story-picture")).toHaveCount(0);
  expect(model.actions).toEqual([]);
});

test("browser-blocked pictures show a fallback without retrying", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].picture = "https://images.invalid/no-cors.png";
  let attempts = 0;
  await page.route("https://images.invalid/**", route => {
    attempts++;
    // Simulate the browser rejecting an image response (for example CORS).
    // Fulfilled Playwright responses do not reproduce every network policy.
    return route.abort("blockedbyresponse");
  });
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stories .picture-fallback")).toBeVisible();
  await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
  expect(attempts).toBe(1);
  await expect(page.locator("#stories img")).not.toHaveAttribute("crossorigin");
});

test("failed and unsafe pictures retain readable stories without credentialed retries", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].picture = "https://images.invalid/broken.png";
  model.stories[1].picture = "javascript:alert(1)";
  let attempts = 0;
  await page.route("https://images.invalid/**", route => { attempts++; return route.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "Unavailable" }); });
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stories .picture-fallback")).toBeVisible();
  await expect(page.locator("#stories .story").first()).toContainText("Synthetic story");
  await expect(page.locator("#stories .story").nth(1).locator("img")).toHaveCount(0);
  await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
  expect(attempts).toBe(1);
  model.stories[0].picture = "http://127.0.0.1:4173/api/session";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator("#stories img")).toHaveCount(0);
});

test("opening a story loads full text and preserves explicit story state", async ({ page }) => {
  const model = await fixture(page);
  model.fullTexts["1:abc"] = "<p>Complete article beyond the short feed preview.</p>";
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await page.locator("#stories .story").first().click();
  await expect(page.locator("#article-content")).toContainText("Complete article beyond");
  await expect(page.locator("#full-text-status")).toHaveText("Full text from NewsBlur.");
  await expect(page.locator("#article-meta")).not.toContainText("Saved");
  await page.getByRole("button", { name: "Back to stories", exact: true }).click();
  await page.locator("#stories .story").first().click();
  await expect(page.locator("#article-content")).toContainText("Complete article beyond");
  expect(model.textRequests).toEqual(["1:abc"]);
  expect(model.actions).toEqual([]);
});

test("unavailable full text keeps feed text and the original link", async ({ page }) => {
  const model = await fixture(page);
  model.failText = true;
  await openStory(page);
  await expect(page.locator("#full-text-status")).toContainText("Showing the feed version");
  await expect(page.locator("#article-content")).toContainText("Readable article text.");
  await expect(page.locator("#original")).toBeVisible();
  expect(model.textRequests).toEqual(["1:abc"]);
  expect(model.actions).toEqual([]);
});

test("late full text cannot replace a subsequently opened story", async ({ page }) => {
  await fixture(page);
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  await page.route("**/api/stories/1%3Aabc/text", async route => {
    await blocked;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ hash: "1:abc", html: "<p>Late first article.</p>", links: [] }) }).catch(() => {});
  });
  await openStory(page);
  await expect(page.locator("#full-text-status")).toContainText("Loading full text");
  await page.keyboard.press("j");
  await expect(page.locator("#article-title")).toHaveText("Second synthetic story");
  release();
  await expect(page.locator("#full-text-status")).toHaveText("Full text from NewsBlur.");
  await expect(page.locator("#article-content")).not.toContainText("Late first article");
});

for (const layout of ["cards", "magazine"]) {
  test(`${layout} opens a focused article and restores the collection on desktop window sizes`, async ({ page }) => {
    const model = await fixture(page);
    model.stories.push(...Array.from({ length: 28 }, (_, i) => story(`1:focus${i}`, `Reading story ${i}`)));
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
    const target = page.locator("#stories .story").nth(8);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await target.scrollIntoViewIfNeeded();
      const position = await page.evaluate(() => scrollY);
      await target.click();
      await expect(page.locator(".story-list")).toBeHidden();
      await expect(page.locator("#article")).toBeVisible();
      await expect(page.locator("#article-title")).toHaveText("Reading story 6");
      const title = await page.locator("#article-title").boundingBox();
      expect(title.y).toBeGreaterThanOrEqual(0);
      expect(title.y + title.height).toBeLessThan(900);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      if (width === 1024) {
        await page.keyboard.press("g");
        await page.keyboard.press("s");
      } else await page.getByRole("button", { name: "Back to stories", exact: true }).click();
      await expect(page.locator(".story-list")).toBeVisible();
      await expect(page.locator("#article")).toBeHidden();
      await expect(target).toBeFocused();
      expect(Math.abs(await page.evaluate(() => scrollY) - position)).toBeLessThan(3);
      await expect(page.locator("#reader")).toHaveAttribute("data-layout", layout);
    }
    expect(model.actions).toEqual([]);
    expect(model.reads).toHaveLength(1);
  });
}

for (const width of [1440, 1024]) {
  test(`List expands one article in place at ${width}px and retains its controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const model = await fixture(page);
    model.stories.push(...Array.from({ length: 20 }, (_, i) => story(`1:inline${i}`, `Inline story ${i}`)));
    await page.locator(`[data-layout-choice="${"list"}"]`).click();
    await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
    const row = page.locator("#stories > li").nth(8);
    const next = page.locator("#stories > li").nth(9);
    await row.locator(".story").click();
    await expect(row.locator("#article")).toBeVisible();
    await expect(row.locator(".story")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".story-list")).toBeVisible();
    await expect(page.locator("#stories > li")).toHaveCount(22);
    const article = await page.locator("#article").boundingBox();
    const following = await next.boundingBox();
    expect(following.y).toBeGreaterThanOrEqual(article.y + article.height - 1);
    await expect(page.getByRole("button", { name: "Save story", exact: true })).toHaveCount(0);
    await expect(row.locator("#article")).toBeVisible();
    await expect(page.locator("#article")).toHaveCount(1);
    await page.locator(`[data-layout-choice="${"cards"}"]`).click();
    await expect(page.locator(".story-list")).toBeHidden();
    await expect(page.locator("#reader > #article")).toBeVisible();
    // The layout control is hidden during focused reading; change it through
    // the existing control to verify the transition back without losing state.
    await page.locator(`[data-layout-choice="${"list"}"]`).click();
    await expect(row.locator("#article")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save story", exact: true })).toHaveCount(0);
    await next.locator(".story").click();
    await expect(next.locator("#article")).toBeVisible();
    await expect(row.locator(".story")).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Close story", exact: true }).click();
    await expect(page.locator("#article")).toBeHidden();
    await expect(next.locator(".story")).toBeFocused();
    await row.locator(".story").click();
    await row.locator(".story").click();
    await expect(row.locator(".story")).toHaveAttribute("aria-expanded", "false");
    await next.locator(".story").click();
    await expireSession(page, model);
    await expect(page.locator("#article-content")).toBeEmpty();
    await expect(page.locator("#reader")).toBeHidden();
    expect(model.actions).toEqual([]);
  });
}

test("scrolling appends unique stories through the final batch", async ({ page }) => {
  const model = await fixture(page);
  model.stories = Array.from({ length: 30 }, (_, i) => story(`1:batch${i}`, `Story ${i}`));
  model.hasMore = true;
  model.pages[2] = { stories: [model.stories[29], ...Array.from({ length: 10 }, (_, i) => story(`1:later${i}`, `Later story ${i}`))], page: 2, can_continue: true };
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stories > li")).toHaveCount(30);
  expect(model.reads).toHaveLength(1);
  await page.locator("#stream-footer").scrollIntoViewIfNeeded();
  await expect(page.locator("#stories > li")).toHaveCount(40);
  await page.locator("#stream-footer").scrollIntoViewIfNeeded();
  await expect(page.locator("#stream-status")).toHaveText("No more stories.");
  await expect(page.getByRole("button", { name: "Load more stories", exact: true })).toBeHidden();
  expect(model.reads.map(params => params.get("page"))).toEqual(["1", "2", "3"]);
});

test("loading more preserves inline article DOM, focus and scroll with one request at a time", async ({ page }) => {
  const model = await fixture(page);
  model.stories.push(...Array.from({ length: 28 }, (_, i) => story(`1:extra${i}`, `Extra story ${i}`)));
  model.hasMore = true;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  let calls = 0;
  await page.route("**/api/feeds/1/stories?**", async (route, request) => {
    if (new URL(request.url()).searchParams.get("page") !== "2") return route.fallback();
    calls++;
    await blocked;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ stories: [story("1:append", "Appended story")], page: 2, can_continue: false }) });
  });
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await openStory(page);
  await page.locator("#back-to-stories").focus();
  await page.evaluate(() => { window.originalArticle = document.querySelector("#article"); window.originalRow = document.querySelector("#stories > li"); });
  await page.locator("#stream-footer").scrollIntoViewIfNeeded();
  await expect.poll(() => calls).toBe(1);
  const position = await page.evaluate(() => scrollY);
  await page.evaluate(() => { dispatchEvent(new Event("scroll")); dispatchEvent(new Event("resize")); });
  release();
  await expect(page.locator("#stories > li")).toHaveCount(31);
  expect(calls).toBe(1);
  expect(await page.evaluate(() => document.querySelector("#article") === window.originalArticle && document.querySelector("#stories > li") === window.originalRow)).toBe(true);
  await expect(page.locator("#back-to-stories")).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - position)).toBeLessThan(3);
});

test("hidden-only pages are followed with a bounded automatic burst", async ({ page }) => {
  const model = await fixture(page);
  for (const number of [1, 2, 3]) model.pages[number] = { stories: [], page: number, can_continue: true };
  model.pages[4] = { stories: [story("1:visible", "Visible after hidden stories")], page: 4, can_continue: false };
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stream-status")).toContainText("Load more to continue");
  expect(model.reads.map(params => params.get("page"))).toEqual(["1", "2", "3"]);
  await page.getByRole("button", { name: "Load more stories", exact: true }).click();
  await expect(page.locator("#stories")).toContainText("Visible after hidden stories");
  await expect(page.locator("#stream-status")).toHaveText("No more stories.");
});

test("a canceled continuation cannot append stories to a different view", async ({ page }) => {
  const model = await fixture(page);
  model.hasMore = true;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  let started = false;
  await page.route("**/api/feeds/1/stories?**", async (route, request) => {
    if (new URL(request.url()).searchParams.get("page") !== "2") return route.fallback();
    started = true;
    await blocked;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ stories: [story("1:stale", "Stale continuation")], page: 2, can_continue: false }) }).catch(() => {});
  });
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: "All feeds", exact: true }).click();
  release();
  await expect(page.locator("#stories")).toContainText("Synthetic story");
  await expect(page.locator("#stories > li")).toHaveCount(2);
  await expect(page.locator("#stories")).not.toContainText("Stale continuation");
});

for (const scope of ["briefing"]) {
  test(`${scope} stories load continuously using their own endpoint`, async ({ page }) => {
    const model = await fixture(page);
    const pages = [];
    await page.route(`**/api/${scope}?**`, route => {
      const number = Number(new URL(route.request().url()).searchParams.get("page"));
      pages.push(number);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ stories: [story(`1:${scope}${number}`, `${scope} story ${number}`)], page: number, state: "ready", can_continue: number === 1 }) });
    });
    await page.getByRole("button", { name: "Daily Briefing", exact: true }).click();
    await expect(page.locator("#stories-heading")).toHaveText("Daily Briefing");
    await expect(page.locator("#stories > li")).toHaveCount(2);
    await expect(page.locator("#stream-status")).toHaveText("No more stories.");
    expect(pages).toEqual([1, 2]);
    expect(model.reads).toEqual([]);
  });
}

test("automatic loading pauses offline and resumes when the connection returns", async ({ page, context }) => {
  const model = await fixture(page);
  model.stories = Array.from({ length: 30 }, (_, i) => story(`1:offline${i}`, `Offline fixture ${i}`));
  model.hasMore = true;
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stories > li")).toHaveCount(30);
  await context.setOffline(true);
  await page.locator("#stream-footer").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(model.reads).toHaveLength(1);
  await context.setOffline(false);
  await expect(page.locator("#stream-status")).toHaveText("No more stories.");
  expect(model.reads.map(params => params.get("page"))).toEqual(["1", "2"]);
});

test.describe("publication dates", () => {
  test.use({ timezoneId: "America/Los_Angeles", locale: "en-US" });

  test("local date groups span batches without sorting or guessing unknown dates", async ({ page }) => {
    const model = await fixture(page);
    const dated = (hash, date) => ({ ...story(hash, hash), published_at: date });
    model.stories = [dated("1:first", "2024-01-02T00:30:00Z"), dated("1:second", "2024-01-01T15:00:00Z")];
    model.hasMore = true;
    model.pages[2] = { page: 2, can_continue: false, stories: [dated("1:third", "2024-01-02T07:00:00Z"), dated("1:fourth", "2024-01-02T09:00:00Z"), { ...story("1:unknown"), date: "2024-01-02 12:00:00" }, dated("1:older", "2024-01-01T15:00:00Z")] };
    await page.locator(`[data-layout-choice="${"list"}"]`).click();
    await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
    await expect(page.locator("#stories .story")).toHaveCount(6);
    await expect(page.locator("#stories .date-heading")).toHaveText(["January 1, 2024", "January 2, 2024", "Date unavailable", "January 1, 2024"]);
    expect(await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => node.dataset.hash))).toEqual(["1:first", "1:second", "1:third", "1:fourth", "1:unknown", "1:older"]);
    await expect(page.locator("#stories time").first()).toHaveAttribute("datetime", "2024-01-02T00:30:00.000Z");
    await expect(page.locator("#stories time").first()).toContainText("Jan 1, 2024");
    await expect(page.locator("#stories time").first()).toHaveAttribute("title", /PST|Pacific Standard Time/);
    await expect(page.locator('[data-hash="1:unknown"] time')).toHaveCount(0);
    await page.locator('[data-hash="1:first"]').click();
    await expect(page.locator("#article-meta time")).toHaveAttribute("datetime", "2024-01-02T00:30:00.000Z");
  });
});

test("refresh status records success, survives errors, and clears on session expiry", async ({ page }) => {
  const model = await fixture(page);
  await expect(page.locator("#collection-updated")).toContainText("Last refreshed");
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#collection-updated")).toContainText("Last refreshed");
  const successful = await page.locator("#collection-updated time").getAttribute("datetime");
  model.failRead = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator("#story-status")).toHaveClass(/error/);
  await expect(page.locator("#collection-updated time")).toHaveAttribute("datetime", successful);
  await expireSession(page, model);
  await expect(page.locator("#collection-updated")).toBeEmpty();
});

test("Warm paper has readable text and usable control targets", async ({ page }) => {
  await fixture(page);
  await page.locator("#main").focus();
  await page.keyboard.press("a");
  await expect(page.getByLabel("Background", { exact: true })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#story-status")).toHaveText("2 stories");
  const ratios = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const luminance = color => {
      const channels = color.match(/\d+/g).map(Number).slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
      return channels.reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    };
    const color = token => {
      const probe = document.createElement("span");
      probe.style.color = style.getPropertyValue(token);
      document.body.append(probe);
      const result = luminance(getComputedStyle(probe).color);
      probe.remove();
      return result;
    };
    return ["--ink", "--muted", "--accent"].flatMap(foreground => ["--paper", "--panel", "--wash"].map(background => {
      const a = color(foreground), b = color(background);
      return { foreground, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    }));
  });
  for (const { foreground, background, ratio } of ratios) expect(ratio, `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
  const controls = await page.locator("button:visible, select:visible, summary:visible").evaluateAll(nodes => nodes.map(node => ({ name: node.textContent.trim(), height: node.getBoundingClientRect().height })));
  for (const control of controls) expect(control.height, control.name).toBeGreaterThanOrEqual(44);
});

test("large text and reduced motion retain reading and dialog controls on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const model = await fixture(page);
  model.stories[0].title = "قراءة الأخبار بهدوء — とても長い見出しと読みやすい本文";
  await page.addStyleTag({ content: ":root { font-size:32px; }" });
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await page.locator("#stories .story").first().click();
  await expect(page.locator("#article-title")).toHaveAttribute("dir", "auto");
  const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag: node.tagName, id: node.id, class: node.className, width: node.getBoundingClientRect().width })).slice(0, 20));
  expect(overflow).toEqual([]);
  expect(await page.locator("#back-to-stories").evaluate(node => getComputedStyle(node).transitionDuration)).toBe("0s");
  await page.locator("#main").focus();
  await page.keyboard.press("a");
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  expect(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close story", exact: true }).click();
  await expect(page.locator("#stories .story").first()).toBeFocused();
});

for (const layout of ["cards", "magazine", "list"]) {
  test(`${layout}: scrolling past seen stories confirms read without removing rows`, async ({ page }) => {
    const model = await fixture(page);
    model.stories = Array.from({ length: 30 }, (_, i) => story(`1:scroll${i}`, `Scroll story ${i}`));
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
    await expect(page.locator("#stories .story")).toHaveCount(30);
    await page.locator("#stories .story").first().scrollIntoViewIfNeeded();
    await page.locator("#stories .story").first().evaluate(node => { window.firstRow = node; });
    expect(model.actions).toEqual([]);
    await page.mouse.move(900, 400);
    await page.mouse.wheel(0, 1200);
    await expect(page.locator("#stories .story").first()).toHaveClass(/read/);
    await expect(page.locator("#stories .story")).toHaveCount(30);
    expect(await page.locator("#stories .story").first().evaluate(node => node === window.firstRow)).toBe(true);
    expect(model.actionRequests).toContainEqual({ hash: "1:scroll0", action: "read" });
    expect(model.actions.every(action => action === "read")).toBe(true);
    expect(new Set(model.actionRequests.map(item => item.hash)).size).toBe(model.actions.length);
    expect(model.actionRequests.some(item => item.hash === "1:scroll29")).toBe(false);
  });
}

test("automatic read pauses offline and in hidden tabs, and skips briefing summaries", async ({ page, context }) => {
  const model = await fixture(page);
  model.stories = Array.from({ length: 30 }, (_, i) => ({ ...story(`1:pause${i}`, `Pause story ${i}`), ...(i === 0 ? { kind: "briefing_summary" } : {}) }));
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await page.locator("#stories .story").first().scrollIntoViewIfNeeded();
  await context.setOffline(true);
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(model.actions).toEqual([]);
  await context.setOffline(false);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  expect(model.actions).toEqual([]);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); window.scrollTo(0, 0); });
  await page.locator("#stories .story").first().scrollIntoViewIfNeeded();
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => model.actions.length).toBeGreaterThan(0);
  expect(model.actionRequests.some(item => item.hash === "1:pause0")).toBe(false);
});

test("scroll read serializes writes and rejects a late confirmation after session expiry", async ({ page }) => {
  const model = await fixture(page);
  model.stories = Array.from({ length: 30 }, (_, i) => story(`1:queue${i}`, `Queue story ${i}`));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  await page.route("**/api/stories/*/state", async route => {
    calls++;
    await gate;
    await route.fulfill({ contentType: "application/json", body: '{"action":"read"}' }).catch(() => {});
  });
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await page.locator("#stories .story").first().scrollIntoViewIfNeeded();
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, 1200);
  await expect.poll(() => calls).toBe(1);
  await expect(page.locator("#stories .story").first()).not.toHaveClass(/read/);
  await expireSession(page, model);
  release();
  await expect(page.locator("#stories")).toBeEmpty();
  await expect(page.locator("#reader")).toBeHidden();
  expect(calls).toBe(1);
});

test("keyboard scrolling marks passed stories read without saving them", async ({ page }) => {
  const model = await fixture(page);
  model.stories = Array.from({ length: 30 }, (_, i) => story(`1:keyboard${i}`, `Keyboard story ${i}`));
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await page.locator("#stories .story").first().focus();
  await page.keyboard.press("End");
  await expect(page.locator("#stories .story").first()).toHaveClass(/read/);
  expect(model.actions.every(action => action === "read")).toBe(true);
});

test("session expiry during automatic read clears account content", async ({ page }) => {
  const model = await fixture(page);
  model.fullTexts["1:abc"] = "<p>A long synthetic article for scrolling.</p>".repeat(60);
  await openStory(page);
  await expect(page.locator("#full-text-status")).toHaveText("Full text from NewsBlur.");
  model.expired = true;
  await page.mouse.wheel(0, 20000);
  await expect(page.locator("#reader")).toBeHidden();
  await expect(page.locator("#stories")).toBeEmpty();
  await expect(page.locator("#article-content")).toBeEmpty();
  await expect(page.locator("#login-status")).toContainText("expired");
});

test("unread continuation restarts its scan after read writes without replacing loaded rows", async ({ page }) => {
  const model = await fixture(page);
  // Keep the end outside the loading threshold until the explicit footer scroll,
  // including when the toolbar and rows use a more compact presentation.
  model.stories = Array.from({ length: 60 }, (_, i) => story(`1:unread${i}`, `Unread story ${i}`));
  model.hasMore = true;
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await page.getByLabel("Show", { exact: true }).selectOption("unread");
  await expect.poll(() => model.reads.length).toBe(2);
  await expect(page.locator("#stories")).toHaveAttribute("aria-busy", "false");
  await page.locator("#stories .story").first().scrollIntoViewIfNeeded();
  await page.locator("#stories .story").first().evaluate(node => { window.unreadRow = node; });
  await page.mouse.move(600, 400); // Scroll the reading area, not the pinned sidebar.
  await page.mouse.wheel(0, 1000);
  await expect(page.locator("#stories .story").first()).toHaveClass(/read/);
  model.pages[1] = { page: 1, can_continue: false, stories: [story("1:shifted", "Previously shifted unread story")] };
  await page.locator("#stream-footer").scrollIntoViewIfNeeded();
  await expect(page.locator('#stories .story[data-hash="1:shifted"]')).toBeVisible();
  expect(model.reads.at(-1).get("page")).toBe("1");
  expect(model.reads.at(-1).get("read_filter")).toBe("unread");
  expect(await page.locator("#stories .story").first().evaluate(node => node === window.unreadRow)).toBe(true);
  await expect(page.locator("#stories .story")).toHaveCount(61);
});

test("a downward scroll gesture marks a fully visible short article read", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1600 });
  const model = await fixture(page);
  await openStory(page);
  await expect(page.locator("#full-text-status")).toHaveText("Full text from NewsBlur.");
  expect(model.actions).toEqual([]);
  await page.mouse.wheel(0, 500);
  await expect(page.locator("#stories .story").first()).toHaveClass(/read/);
  expect(model.actions).toEqual(["read"]);
});

for (const layout of ["cards", "magazine", "list"]) {
  test(`${layout}: vertical blue unread marker clears only after confirmed read`, async ({ page }) => {
    const model = await fixture(page);
    model.stories[1].read = true;
    model.fullTexts["1:abc"] = "<p>A long synthetic article.</p>".repeat(60);
    await page.locator(`[data-layout-choice="${layout}"]`).click();
    await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
    const indicator = page.locator("#stories .story").first().locator(".read-indicator");
    await expect(indicator).toHaveAttribute("title", "Unread");
    const markerBox = await indicator.boundingBox();
    expect(markerBox.height).toBeGreaterThan(markerBox.width * 3);
    expect(await indicator.evaluate(node => getComputedStyle(node).borderRadius)).toBe("999px");
    expect(await indicator.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    expect(await page.locator("#stories .story").nth(1).locator(".read-indicator").evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    await page.locator("#stories .story").first().click();
    await expect(page.locator("#full-text-status")).toHaveText("Full text from NewsBlur.");
    await page.mouse.wheel(0, 20000);
    await expect(indicator).toHaveAttribute("title", "Read");
    expect(await indicator.evaluate(node => getComputedStyle(node).boxShadow)).toBe("none");
    expect(await indicator.evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  });
}

const signedImagePath = "/imageproxy/sc,s" + "A".repeat(43) + "=/http://publisher.invalid/photo.png";
const relayPicture = path => "/api/newsblur-picture?" + new URLSearchParams({ path });

test("List uses NewsBlur thumbnails and switches to the full image for Cards", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].pictures = [relayPicture(signedImagePath)];
  model.stories[0].thumbnail = relayPicture(signedImagePath.replace("/sc,", "/192,sc,"));
  const paths = [];
  await page.route("**/api/newsblur-picture?**", route => {
    paths.push(new URL(route.request().url()).searchParams.get("path"));
    return route.fulfill({ contentType: "image/png", body: pixelPNG });
  });
  await page.locator(`[data-layout-choice="${"list"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  const image = page.locator("#stories .story-picture img");
  await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
  expect(paths).toEqual([signedImagePath.replace("/sc,", "/192,sc,")]);
  await page.locator(`[data-layout-choice="${"cards"}"]`).click();
  await expect.poll(() => paths.length).toBe(2);
  expect(paths[1]).toBe(signedImagePath);
  await expect(image).toHaveAttribute("src", /api\/newsblur-picture/);
});

test("failed NewsBlur image falls back to a validated original without looping", async ({ page }) => {
  const model = await fixture(page);
  const original = "https://publisher.invalid/photo.png";
  model.stories[0].pictures = [relayPicture(signedImagePath), original, "https://publisher.invalid/unused.png"];
  const requests = [];
  await page.route("**/api/newsblur-picture?**", route => { requests.push("newsblur"); return route.fulfill({ status: 404, body: "Unavailable" }); });
  await page.route("https://publisher.invalid/**", route => { requests.push(route.request().url()); return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"/>' }); });
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  const image = page.locator("#stories .story-picture img");
  await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  expect(requests).toEqual(["newsblur", original]);
  await expect(page.locator("#stories .picture-fallback")).toBeHidden();
});

test("inline NewsBlur images retain alt text and use a safe original fallback", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].html = `<p>Readable article text.</p><img data-picture-src="${relayPicture(signedImagePath)}" data-picture-fallback="https://publisher.invalid/original.png" alt="Coastal scene">`;
  await page.route("**/api/newsblur-picture?**", route => route.fulfill({ status: 404, body: "Unavailable" }));
  await page.route("https://publisher.invalid/**", route => route.fulfill({ contentType: "image/png", body: pixelPNG }));
  await openStory(page);
  const image = page.locator("#article-content img");
  await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(image).toHaveAttribute("alt", "Coastal scene");
  await expect(image).toHaveAttribute("src", "https://publisher.invalid/original.png");
});

test("hidden pictures suppress NewsBlur relay requests too", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("news-stability-pictures-v1", "hide"));
  const model = await fixture(page);
  model.stories[0].pictures = [relayPicture(signedImagePath)];
  let requests = 0;
  await page.route("**/api/newsblur-picture?**", route => { requests++; return route.fulfill({ contentType: "image/png", body: pixelPNG }); });
  await openStory(page);
  await expect(page.locator("#article-content img")).not.toHaveAttribute("src");
  expect(requests).toBe(0);
});

test("All feeds, nested folder reading and Focus use collection scopes without search or saves", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].score = 1;
  await page.route("**/api/feeds", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ feeds: [{ id: 1, title: "Synthetic feed", positive: 1, neutral: 2 }], folders: [{ title: "Reading", children: [{ feed_id: 1 }, { title: "Science", children: [{ feed_id: 1 }] }] }] }) }));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.locator("#feed-tree summary").filter({ hasText: /^Science$/ }).click();
  await expect(page.getByRole("button", { name: "Read Science", exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Saved stories", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "All feeds", exact: true }).click();
  await expect(page.locator("#stories-heading")).toHaveText("All feeds");
  await expect(page.locator("#stories .story")).toHaveCount(2);
  expect(model.reads.at(-1).has("query")).toBe(false);
  await page.getByRole("button", { name: "Read Reading", exact: true }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Reading");
  expect(model.reads.at(-1).get("folder")).toBe("0");
  expect(model.reads.at(-1).get("folder_title")).toBe("Reading");
  await page.getByRole("button", { name: "Read Science", exact: true }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Science");
  expect(model.reads.at(-1).get("folder")).toBe("0/1");
  await page.getByLabel("Show", { exact: true }).selectOption("focus");
  await expect(page.locator("#stories .story")).toHaveCount(1);
  expect(model.reads.at(-1).get("folder")).toBe("0/1");
  await page.getByRole("button", { name: /^Focus / }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Focus");
  expect(model.reads.at(-1).has("folder")).toBe(false);
  expect(model.reads.at(-1).get("read_filter")).toBe("focus");
});

test("river account and page limits explain why the collection ends", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/river?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ stories: [story()], page: 1, can_continue: false, limited: true, limit_reached: true }) }));
  await page.getByRole("button", { name: "All feeds", exact: true }).click();
  await expect(page.locator("#story-status")).toContainText("NewsBlur limits this collection for your account.");
  await expect(page.locator("#stream-status")).toContainText("page limit reached");
});

test("thumbs train the selected story field only after NewsBlur confirms", async ({ page }) => {
  const model = await fixture(page);
  model.stories[0].author = "A writer";
  model.stories[0].tags = ["Science"];
  await openStory(page);
  await expect(page.getByLabel("Train NewsBlur on")).toContainText("Topic: Science");
  const like = page.getByRole("button", { name: "Like selected choice", exact: true });
  const dislike = page.getByRole("button", { name: "Dislike selected choice", exact: true });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  expect(model.feedback).toEqual([{ hash: "1:abc", action: "like", target: "title", value: "Synthetic story" }]);
  await page.getByLabel("Train NewsBlur on").selectOption({ label: "Topic: Science" });
  await expect(like).toHaveAttribute("aria-pressed", "false");
  model.failFeedback = true;
  await dislike.click();
  await expect(page.locator("#feedback-status")).toContainText("not confirmed");
  await expect(dislike).toHaveAttribute("aria-pressed", "false");
  model.failFeedback = false;
  await dislike.click();
  await expect(dislike).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Clear training", exact: true }).click();
  await expect(dislike).toHaveAttribute("aria-pressed", "false");
  expect(model.feedback.at(-1)).toEqual({ hash: "1:abc", action: "clear", target: "tag", value: "Science" });
  await expireSession(page, model);
  await expect(page.locator("#feedback")).toBeHidden();
});

test("switching reading mode cancels a stale response and retains stories on failure", async ({ page }) => {
  const model = await fixture(page);
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let started;
  const requested = new Promise(resolve => { started = resolve; });
  await page.route("**/api/feeds/1/stories?**", async route => {
    if (new URL(route.request().url()).searchParams.get("read_filter") !== "unread") return route.fallback();
    started();
    await held;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ stories: [story("1:stale", "Stale result")], page: 1, can_continue: false }) }).catch(() => {});
  });
  await page.getByLabel("Show", { exact: true }).selectOption("unread");
  await requested;
  await page.getByLabel("Show", { exact: true }).selectOption("all");
  await expect(page.locator("#stories")).toHaveAttribute("aria-busy", "false");
  release();
  await expect(page.locator("#stories")).not.toContainText("Stale result");
  model.failRead = true;
  await page.getByLabel("Show", { exact: true }).selectOption("focus");
  await expect(page.locator("#story-status")).toHaveClass(/error/);
  await expect(page.locator("#stories .story")).toHaveCount(2);
});

for (const width of [1024, 1440]) {
  test(`newspaper photos sit beside text stories and layout survives hidden pictures at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const model = await fixture(page);
    model.stories = Array.from({ length: 6 }, (_, i) => ({ ...story(`1:paper${i}`, `Newspaper story ${i}`), published_at: "2026-11-13T12:00:00Z", excerpt: "A substantial introduction to this story. ".repeat(5), ...(i < 2 ? { picture: "https://fixture.invalid/photo.png" } : {}) }));
    await page.route("https://fixture.invalid/photo.png", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#987"/></svg>' }));
    await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
    await page.getByRole("button", { name: "All feeds", exact: true }).click();
    await expect.poll(() => page.locator("#stories img").first().evaluate(async image => { await image.decode(); return image.naturalWidth > 0; })).toBe(true);
    const lead = await page.locator("#stories .story").nth(0).boundingBox();
    const sideTop = await page.locator("#stories .story").nth(1).boundingBox();
    const sideBottom = await page.locator("#stories .story").nth(2).boundingBox();
    expect(lead.width).toBeGreaterThan(sideTop.width * 1.8);
    expect(Math.abs(lead.y - sideTop.y)).toBeLessThan(2);
    expect(sideBottom.y).toBeGreaterThanOrEqual(sideTop.y + sideTop.height - 1);
    expect(lead.x + lead.width).toBeLessThan(sideTop.x);
    const original = await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => node.dataset.hash));
    await page.locator("#main").focus();
  await page.keyboard.press("a");
    await page.getByLabel("Pictures", { exact: true }).selectOption("hide");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => node.dataset.hash))).toEqual(original);
    await expect(page.locator("#stories .story-picture").first()).toBeHidden();
  });
}

for (const count of [2, 3]) {
  test(`${count}-story portrait newspaper preserves the photograph and gives neighbours wider text columns`, async ({ page }) => {
    const model = await fixture(page);
    model.stories = Array.from({ length: count }, (_, i) => ({ ...story(`1:portrait${i}`, `Portrait edition ${i}`), excerpt: "A considered introduction with enough detail to read before opening the full article. ".repeat(6), ...(i === 0 ? { picture: "https://fixture.invalid/portrait.svg" } : {}) }));
    await page.route("https://fixture.invalid/portrait.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="240"><rect width="120" height="240" fill="#987"/></svg>' }));
    await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
    await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
    const image = page.locator("#stories img").first();
    await expect.poll(() => image.evaluate(async node => { await node.decode(); return node.naturalHeight > node.naturalWidth; })).toBe(true);
    await expect(page.locator("#stories > li").first()).toHaveAttribute("data-press-role", count === 3 ? "portrait" : "duo-text");
    const boxes = await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
    expect(boxes[1].width).toBeGreaterThan(boxes[0].width * 1.8);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    if (count === 3) expect(boxes[2].y).toBeGreaterThan(boxes[1].y);
    expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe("contain");
    expect(await page.locator("#stories .story-excerpt").nth(1).evaluate(node => getComputedStyle(node).columnCount)).toBe("2");
    expect(model.actions).toEqual([]);
  });
}

test("a later photograph sits beside the opening text without changing story order", async ({ page }) => {
  const model = await fixture(page);
  model.stories = Array.from({ length: 3 }, (_, i) => ({ ...story(`1:later${i}`, `Chronological story ${i}`), ...(i === 1 ? { picture: "https://fixture.invalid/later.png" } : {}) }));
  await page.route("https://fixture.invalid/later.png", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#987"/></svg>' }));
  await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stories > li").nth(1)).toHaveAttribute("data-press-role", "feature-right");
  const boxes = await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
  expect(boxes[1].width).toBeGreaterThan(boxes[0].width * 1.8);
  expect(Math.abs(boxes[1].y - boxes[0].y)).toBeLessThan(2);
  expect(boxes[2].x).toBe(boxes[0].x);
  expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
  expect(await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => node.dataset.hash))).toEqual(["1:later0", "1:later1", "1:later2"]);
  expect(await page.locator("#stories strong").first().evaluate(node => getComputedStyle(node).textWrap)).toBe("balance");
  expect(model.actions).toEqual([]);
});

test("newspaper continuation leaves the existing composition and story nodes in place", async ({ page }) => {
  const model = await fixture(page);
  model.hasMore = true;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route("**/api/feeds/1/stories?**", async route => {
    if (new URL(route.request().url()).searchParams.get("page") !== "2") return route.fallback();
    await held;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ stories: [story("1:appended", "A later story")], page: 2, can_continue: false }) });
  });
  await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stories > li").first()).toHaveAttribute("data-press-role", "brief");
  await page.locator("#stories .story").first().evaluate(node => { window.newspaperOriginal = node; });
  const before = await page.locator("#stories .story").first().boundingBox();
  release();
  await expect(page.locator("#stories .story")).toHaveCount(3);
  await expect(page.locator("#stories > li").first()).toHaveAttribute("data-press-role", "brief");
  expect(await page.locator("#stories .story").first().evaluate(node => node === window.newspaperOriginal)).toBe(true);
  const after = await page.locator("#stories .story").first().boundingBox();
  expect(after.width).toBe(before.width);
  expect(after.y).toBe(before.y);
  expect(model.actions).toEqual([]);
});

test("newspaper text weight gives a substantial introduction room instead of stretching every brief", async ({ page }) => {
  const model = await fixture(page);
  const introduction = "A longer introduction provides the background, evidence, and practical context a reader needs. ".repeat(10);
  model.stories = Array.from({ length: 6 }, (_, i) => ({ ...story(`1:type${i}`, `Type-led story ${i}`), excerpt: i === 0 ? introduction : "A short item with just the essential facts." }));
  await page.locator(`[data-layout-choice="${"magazine"}"]`).click();
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await expect(page.locator("#stories-heading")).toHaveText("Synthetic feed");
  await expect(page.locator("#stories > li").first()).toHaveAttribute("data-press-role", "lead");
  const widths = await page.locator("#stories .story").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(widths[1] * 1.8);
  expect(Math.abs(widths[3] - widths[4])).toBeLessThan(1);
  expect(Math.abs(widths[4] - widths[5])).toBeLessThan(1);
  await expect(page.locator("#stories .story-excerpt").first()).toHaveText(introduction.trim());
  expect(await page.locator("#stories .story-excerpt").first().evaluate(node => getComputedStyle(node).columnCount)).toBe("2");
  expect(model.actions).toEqual([]);
});
