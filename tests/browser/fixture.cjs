const { expect } = require("@playwright/test");

const story = (hash = "1:abc", title = "Synthetic story") => ({ hash, title, html: "<p>Readable article text.</p>", excerpt: "Readable article text.", url: "https://example.invalid/story", read: false, saved: false, related: [], links: [], reading_minutes: 1 });

async function fixture(page, baseURL = "http://127.0.0.1:4173/") {
  const model = { authenticated: false, failAction: false, failRead: false, expired: false, actions: [], actionRequests: [], reads: [], pages: {}, hasMore: false, failMore: false, textRequests: [], failText: false, fullTexts: {}, stories: [story(), story("1:def", "Second synthetic story")] };
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
    if (path.endsWith("/text")) {
      const hash = path.split("/")[3];
      model.textRequests.push(hash);
      if (model.failText) return reply({ code: "full_text_unavailable", message: "Full text unavailable." }, 404);
      const source = model.stories.find(item => item.hash === hash) || story(hash);
      return reply({ hash, html: model.fullTexts[hash] ?? source.html, reading_minutes: 3, links: source.links, picture: source.picture });
    }
    if (path.endsWith("/state")) {
      const action = route.request().postDataJSON().action;
      model.actions.push(action);
      model.actionRequests.push({ hash: path.split("/")[3], action });
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
      if (current > 1 && model.failMore) return route.abort("failed");
      return reply(model.pages[current] ?? { stories: current === 1 ? model.stories : [], page: current, can_continue: current === 1 && model.hasMore });
    }
    throw new Error(`Unexpected synthetic API route: ${path}`);
  });
  // No routine browser test may contact NewsBlur or an external story site.
  const localOrigin = new URL(baseURL).origin;
  await page.route(/^https?:\/\//, route => new URL(route.request().url()).origin === localOrigin ? route.fallback() : route.abort());
  await page.goto(baseURL);
  await page.getByLabel("NewsBlur username").fill("fixture");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Synthetic feed" })).toBeVisible();
  return model;
}

module.exports = { fixture, story };
