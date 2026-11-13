const { test, expect } = require("@playwright/test");

const story = (hash = "1:abc", title = "Synthetic story") => ({ hash, title, html: "<p>Readable article text.</p>", url: "https://example.invalid/story", read: false, saved: false, related: [], links: [], reading_minutes: 1 });

async function fixture(page) {
  const model = { authenticated: false, failAction: false, failRead: false, expired: false, actions: [], reads: [], stories: [story(), story("1:def", "Second synthetic story")] };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = decodeURIComponent(url.pathname);
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const session = () => ({ authenticated: model.authenticated, username: "fixture", csrf_token: "synthetic-csrf", expires_at: new Date(Date.now() + 3600000).toISOString() });
    if (path === "/api/session") return reply(session());
    if (path === "/api/login") { model.authenticated = true; return reply(session()); }
    if (path === "/api/logout") { model.authenticated = false; return reply({ signed_out: true }); }
    if (model.expired) { model.authenticated = false; return reply({ code: "session_expired", message: "Session expired." }, 401); }
    if (path === "/api/feeds") return reply({ feeds: [{ id: 1, title: "Synthetic feed", positive: 1, neutral: 2 }], folders: [{ title: "Reading", children: [{ feed_id: 1 }] }] });
    if (path.endsWith("/state")) {
      model.actions.push(route.request().postDataJSON().action);
      if (model.failAction) return reply({ code: "action_rejected", message: "NewsBlur could not apply that action." }, 409);
      return reply({ action: model.actions.at(-1) });
    }
    if (path === "/api/briefing") return reply({ stories: [], state: "unsupported", page: 1, can_continue: false });
    if (path === "/api/saved") return reply({ stories: [story("1:saved", "Previously saved story")], page: 1, can_continue: false });
    if (path === "/api/stories/1:linked") return reply(story("1:linked", "Linked synthetic story"));
    if (path === "/api/feeds/1/stories") {
      model.reads.push(url.searchParams);
      if (model.failRead) return route.abort("failed");
      const current = Number(url.searchParams.get("page") || 1);
      return reply({ stories: current === 1 ? model.stories : [], page: current, can_continue: current === 1 });
    }
    throw new Error(`Unexpected synthetic API route: ${path}`);
  });
  // No routine browser test may contact NewsBlur or an external story site.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/, route => route.abort());
  await page.goto("/");
  await page.getByLabel("NewsBlur username").fill("fixture");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Synthetic feed" })).toBeVisible();
  return model;
}

async function openStory(page) {
  await page.getByRole("button", { name: "Synthetic feed" }).click();
  await page.getByRole("button", { name: "Synthetic story", exact: false }).first().click();
  await expect(page.locator("#article-content")).toContainText("Readable article text.");
}

test("read, save, pagination and logout", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  await page.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark unread", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save story", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unsave story", exact: true })).toBeEnabled();
  expect(model.actions).toEqual(["read", "save"]);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("#page-label")).toHaveText("Page 2");
  await expect(page.locator("#article-content")).toBeEmpty();
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.locator("#page-label")).toHaveText("Page 1");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("#reader")).toBeHidden();
  await expect(page.locator("#article-content")).toBeEmpty();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("failed writes preserve story and state without retries", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  model.failAction = true;
  await page.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(page.locator("#article-status")).toContainText("could not apply");
  await expect(page.getByRole("button", { name: "Mark read", exact: true })).toBeEnabled();
  await expect(page.locator("#article-title")).toHaveText("Synthetic story");
  expect(model.actions).toEqual(["read"]);
});

test("search and unread filters use NewsBlur and persist across pagination", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  await page.getByLabel("Show", { exact: true }).selectOption("unread");
  await page.getByLabel("Search this feed").fill("cats & dogs");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("#article-content")).toBeEmpty();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("#page-label")).toHaveText("Page 2");
  expect(model.reads.at(-1).get("query")).toBe("cats & dogs");
  expect(model.reads.at(-1).get("read_filter")).toBe("unread");
});

test("failed page navigation preserves the article and pagination position", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  model.failRead = true;
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("#story-status")).toHaveClass(/error/);
  await expect(page.locator("#article-title")).toHaveText("Synthetic story");
  await expect(page.locator("#page-label")).toHaveText("Page 1");
});

test("keyboard navigation pauses in inputs and appearance survives reload", async ({ page }) => {
  await fixture(page);
  await openStory(page);
  await page.keyboard.press("j");
  await expect(page.locator("#article-title")).toHaveText("Second synthetic story");
  await page.getByLabel("Search this feed").focus();
  await page.keyboard.press("k");
  await expect(page.locator("#article-title")).toHaveText("Second synthetic story");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Background", { exact: true }).selectOption("paper");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(["news-stability-appearance-v1"]);
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

test("saved view and unsupported briefing are explicit", async ({ page }) => {
  await fixture(page);
  await page.getByRole("button", { name: "Saved stories", exact: true }).click();
  await expect(page.locator("#stories")).toContainText("Previously saved story");
  await expect(page.locator("#story-filters")).toBeHidden();
  await page.getByRole("button", { name: "Daily Briefing", exact: true }).click();
  await expect(page.locator("#story-status")).toContainText("not available");
});

test("mobile reading and dialogs fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await openStory(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("refresh reloads authoritative story state and preserves collapsed folders", async ({ page }) => {
  const model = await fixture(page);
  await openStory(page);
  await page.locator("#feed-tree summary").click();
  model.stories[0].read = true;
  model.stories[0].saved = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark unread", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unsave story", exact: true })).toBeVisible();
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
