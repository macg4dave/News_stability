const { expect } = require("@playwright/test");

const story = (hash = "1:abc", title = "Synthetic story") => ({ hash, title, html: "<p>Readable article text.</p>", excerpt: "Readable article text.", url: "https://example.invalid/story", read: false, tags: [], score: 0, feed_id: 1, related: [], links: [], reading_minutes: 1 });

async function fixture(page, baseURL = "http://127.0.0.1:4173/", remember = false) {
  const model = { authenticated: false, loginRequests: [], expiresAt: Date.now() + 3600000, failAction: false, failRead: false, expired: false, actions: [], actionRequests: [], feedback: [], failFeedback: false, reads: [], pages: {}, hasMore: false, failMore: false, textRequests: [], failText: false, fullTexts: {}, stories: [story(), story("1:def", "Second synthetic story")] };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = decodeURIComponent(url.pathname);
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const session = () => ({ authenticated: model.authenticated, username: "fixture", csrf_token: "synthetic-csrf", expires_at: new Date(model.expiresAt).toISOString() });
    if (path === "/api/session") { if (Date.now() >= model.expiresAt) model.authenticated = false; return reply(session()); }
    if (path === "/api/login") {
      model.loginRequests.push(route.request().postDataJSON());
      model.expiresAt = Date.now() + (model.loginRequests.at(-1).remember_me ? 30 * 86400000 : 8 * 3600000);
      model.authenticated = true;
      return reply(session());
    }
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
    if (path.endsWith("/feedback")) {
      const input = route.request().postDataJSON();
      model.feedback.push({ hash: path.split("/")[3], ...input });
      return model.failFeedback ? reply({ code: "feedback_rejected", message: "Feedback was not confirmed." }, 409) : reply(input);
    }
    if (path.endsWith("/state")) {
      const action = route.request().postDataJSON().action;
      model.actions.push(action);
      model.actionRequests.push({ hash: path.split("/")[3], action });
      if (model.failAction) return reply({ code: "action_rejected", message: "NewsBlur could not apply that action." }, 409);
      return reply({ action: model.actions.at(-1) });
    }
    if (path === "/api/briefing") return reply({ stories: [], state: "unsupported", page: 1, can_continue: false });
    if (path === "/api/stories/1:linked") return reply(story("1:linked", "Linked synthetic story"));
    if (path === "/api/feeds/1/stories" || path === "/api/river") {
      model.reads.push(url.searchParams);
      if (model.failRead) return route.abort("failed");
      const current = Number(url.searchParams.get("page") || 1);
      if (current > 1 && model.failMore) return route.abort("failed");
      return reply(model.pages[current] ?? { stories: current === 1 ? (url.searchParams.get("read_filter") === "focus" ? model.stories.filter(item => item.score > 0) : model.stories) : [], page: current, can_continue: current === 1 && model.hasMore });
    }
    throw new Error(`Unexpected synthetic API route: ${path}`);
  });
  // No routine browser test may contact NewsBlur or an external story site.
  const localOrigin = new URL(baseURL).origin;
  await page.route(/^https?:\/\//, route => new URL(route.request().url()).origin === localOrigin ? route.fallback() : route.abort());
  await page.goto(baseURL);
  await page.getByLabel("NewsBlur username").fill("fixture");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await expect(page.getByRole("checkbox", { name: "Remember me", exact: true })).not.toBeChecked();
  if (remember) await page.getByRole("checkbox", { name: "Remember me", exact: true }).check();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Synthetic feed" })).toBeVisible();
  return model;
}

module.exports = { fixture, story };
