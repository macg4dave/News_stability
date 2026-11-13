const el = (id) => document.getElementById(id);
const state = { session: null, feeds: new Map(), folders: [], feed: null, page: 1, stories: [], story: null, resume: null, expiryTimer: null, epoch: 0, feedRequest: null, storyRequest: null };

class APIError extends Error {
  constructor(status, data) {
    super(data.message || "The reader could not complete that request.");
    this.status = status;
    this.code = data.code;
    this.signedOut = data.signed_out === true;
  }
}

async function api(path, options = {}) {
  const headers = { Accept: "application/json", ...options.headers };
  if (options.method === "POST") {
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = state.session?.csrf_token || "";
  }
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  let data;
  try { data = await response.json(); } catch { throw new Error("The reader returned an unexpected response. Try again."); }
  if (!response.ok) throw new APIError(response.status, data);
  return data;
}

function message(id, text, error = false) {
  const target = el(id);
  target.textContent = text;
  target.classList.toggle("error", error);
}

function notice(text) {
  message("notice", text);
  el("notice").hidden = !text;
}

function cancelReading() {
  state.epoch++;
  state.feedRequest?.abort();
  state.storyRequest?.abort();
}

function signedOut(text = "Sign in to your NewsBlur account.", clear = false) {
  cancelReading();
  clearTimeout(state.expiryTimer);
  state.resume = !clear && state.feed ? { username: state.session?.username, feedID: state.feed.id, page: state.page } : null;
  state.session = null;
  el("signin").hidden = false;
  el("reader").hidden = true;
  el("account").hidden = true;
  el("login-submit").disabled = true;
  el("login-password").value = "";
  message("login-status", text);
  // Discard account content before another user can sign in. Only a location
  // may be resumed, after verifying that the same username signed back in.
  state.feeds.clear();
  state.folders = [];
  state.feed = null;
  state.story = null;
  state.stories = [];
  el("feed-tree").replaceChildren();
  el("stories").replaceChildren();
  message("stories-heading", "Choose a feed");
  message("story-status", "Choose a feed to load stories.");
  message("page-label", "");
  el("previous").hidden = true;
  el("next").hidden = true;
  clearArticle();
}

async function connect() {
  el("reconnect").hidden = true;
  el("login-submit").disabled = true;
  try {
    const session = await api("/api/session");
    state.session = session;
    if (session.authenticated) {
      showReader();
      await loadFeeds();
    } else {
      el("signin").hidden = false;
      el("reader").hidden = true;
      el("account").hidden = true;
      message("login-status", "Sign in to your NewsBlur account.");
    }
    el("login-submit").disabled = false;
  } catch (error) {
    message("login-status", error.message || "Could not connect to the reader.", true);
    el("reconnect").hidden = false;
  }
}

function showReader() {
  clearTimeout(state.expiryTimer);
  const remaining = Date.parse(state.session.expires_at) - Date.now();
  state.expiryTimer = setTimeout(async () => {
    signedOut("Your session expired. Sign in again to continue.");
    await connect();
    message("login-status", "Your session expired. Sign in again to continue.");
  }, Math.max(0, remaining));
  el("signin").hidden = true;
  el("reader").hidden = false;
  el("account").hidden = false;
  el("username").textContent = state.session.username;
  notice("");
}

async function readingError(error, target) {
  if (error.name === "AbortError") return;
  if (error.status === 401 && error.code === "session_expired") {
    signedOut("Your session expired. Sign in again to continue.");
    await connect();
    message("login-status", "Your session expired. Sign in again to continue.");
    el("login-username").focus();
    return;
  }
  message(target, error.message || "Could not connect. Your current view has been kept.", true);
}

el("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  el("login-submit").disabled = true;
  message("login-status", "Signing in...");
  const payload = { username: el("login-username").value, password: el("login-password").value };
  try {
    state.session = await api("/api/login", { method: "POST", body: JSON.stringify(payload) });
    showReader();
    await loadFeeds();
    el("feeds-heading").setAttribute("tabindex", "-1");
    el("feeds-heading").focus();
  } catch (error) {
    message("login-status", error.message || "Could not sign in. Try again.", true);
    if (error.code === "session_expired" || error.code === "csrf_rejected" || error.code === "session_changed") {
      state.session = null;
      await connect();
      message("login-status", "The sign-in form has been refreshed. Please try again.");
    }
  } finally {
    payload.password = "";
    el("login-password").value = "";
    el("login-submit").disabled = !state.session;
  }
});

el("logout").addEventListener("click", async () => {
  el("logout").disabled = true;
  cancelReading();
  try {
    await api("/api/logout", { method: "POST", body: "{}" });
    signedOut("Signed out.", true);
    await connect();
    message("login-status", "Signed out. Sign in whenever you are ready.");
  } catch (error) {
    if (error.signedOut || error.code === "session_expired") {
      signedOut("Signed out of this reader.", true);
      await connect();
      notice(error.message);
    } else {
      // A network failure leaves upstream/local outcome unknown. Never claim
      // success or discard the retry path without a confirmed local invalidation.
      notice(error.message || "Could not confirm sign-out. Please try again.");
    }
  } finally { el("logout").disabled = false; }
});

el("reconnect").addEventListener("click", connect);
el("refresh").addEventListener("click", loadFeeds);

function feedButton(feed) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "feed";
  button.dataset.feedId = String(feed.id);
  button.setAttribute("aria-current", String(feed.id === state.feed?.id));
  const title = document.createElement("span");
  title.textContent = feed.title || "Untitled feed";
  const count = document.createElement("span");
  count.className = "count";
  count.textContent = String(feed.positive + feed.neutral);
  count.setAttribute("aria-label", `${count.textContent} unread`);
  button.append(title, count);
  button.addEventListener("click", () => loadStories(feed, 1));
  return button;
}

function renderFeeds() {
  const used = new Set();
  const openFolders = new Set([...el("feed-tree").querySelectorAll("details[open]")].map((d) => d.dataset.folderPath));
  function tree(folders, parent = "") {
    const list = document.createElement("ul");
    folders.forEach((folder, index) => {
      const row = document.createElement("li");
      if (folder.feed_id) {
        const feed = state.feeds.get(folder.feed_id);
        if (!feed || used.has(feed.id)) return;
        used.add(feed.id);
        row.append(feedButton(feed));
      } else {
        const details = document.createElement("details");
        const path = `${parent}/${index}:${folder.title}`;
        details.dataset.folderPath = path;
        details.open = openFolders.size === 0 || openFolders.has(path);
        const summary = document.createElement("summary");
        summary.textContent = folder.title || "Untitled folder";
        details.append(summary, tree(folder.children || [], path));
        row.append(details);
      }
      list.append(row);
    });
    return list;
  }
  const root = tree(state.folders);
  for (const feed of state.feeds.values()) {
    if (!used.has(feed.id)) {
      const row = document.createElement("li");
      row.append(feedButton(feed));
      root.append(row);
    }
  }
  el("feed-tree").replaceChildren(root);
}

async function loadFeeds() {
  state.feedRequest?.abort();
  const controller = new AbortController();
  state.feedRequest = controller;
  const epoch = state.epoch;
  el("refresh").disabled = true;
  el("feed-tree").setAttribute("aria-busy", "true");
  message("feed-status", "Loading your feeds...");
  try {
    const navigation = await api("/api/feeds", { signal: controller.signal });
    if (epoch !== state.epoch || controller.signal.aborted) return;
    state.feeds = new Map(navigation.feeds.map((feed) => [feed.id, feed]));
    state.folders = navigation.folders;
    renderFeeds();
    message("feed-status", state.feeds.size ? `${state.feeds.size} feeds` : "No subscriptions yet. Add feeds in NewsBlur, then refresh.");
    const resume = state.resume;
    state.resume = null;
    if (resume?.username === state.session?.username && state.feeds.has(resume.feedID)) {
      await loadStories(state.feeds.get(resume.feedID), resume.page);
    }
    if (state.feed && state.feeds.has(state.feed.id)) {
      state.feed = state.feeds.get(state.feed.id);
      message("stories-heading", state.feed.title);
    } else if (state.feed) {
      state.feed = null;
      state.storyRequest?.abort();
      state.stories = [];
      el("stories").replaceChildren();
      clearArticle();
      message("stories-heading", "Choose a feed");
      message("page-label", "");
      el("previous").hidden = true;
      el("next").hidden = true;
      message("story-status", "This feed is no longer in your subscriptions. Choose another feed.");
    }
  } catch (error) {
    if (epoch === state.epoch) await readingError(error, "feed-status");
  } finally {
    if (state.feedRequest === controller) {
      el("refresh").disabled = false;
      el("feed-tree").setAttribute("aria-busy", "false");
    }
  }
}

function clearArticle() {
  state.story = null;
  message("article-title", "A little space for the stories that matter.");
  message("article-feed", "SETTLE IN");
  message("article-meta", "Choose a story to start reading.");
  el("article-content").replaceChildren();
  el("original").hidden = true;
  el("original").removeAttribute("href");
}

function selectStory(story) {
  state.story = story.hash;
  message("article-title", story.title || "Untitled story");
  message("article-feed", state.feed.title);
  message("article-meta", [story.author, story.date, story.saved ? "Saved" : ""].filter(Boolean).join(" · "));
  // This is the sole HTML insertion point. /api/feeds/{id}/stories emits HTML
  // only after applying the server-owned article sanitizer allowlist.
  el("article-content").innerHTML = story.html;
  if (!story.html) message("article-content", "This story has no article text. You can read it on the original site.");
  let original = null;
  try {
    const url = new URL(story.url);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) original = url.href;
  } catch { /* No safe original link was supplied. */ }
  el("original").hidden = !original;
  if (original) el("original").href = original;
  else el("original").removeAttribute("href");
  for (const button of el("stories").querySelectorAll("button")) button.setAttribute("aria-current", String(button.dataset.hash === story.hash));
  el("article-title").focus();
}

function renderStories() {
  const list = document.createDocumentFragment();
  for (const story of state.stories) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `story${story.read ? " read" : ""}`;
    button.dataset.hash = story.hash;
    button.setAttribute("aria-current", String(story.hash === state.story));
    const title = document.createElement("strong");
    title.textContent = story.title || "Untitled story";
    const meta = document.createElement("small");
    meta.textContent = [story.author, story.date, story.saved ? "Saved" : ""].filter(Boolean).join(" · ");
    button.append(title, meta);
    button.addEventListener("click", () => selectStory(story));
    row.append(button);
    list.append(row);
  }
  el("stories").replaceChildren(list);
}

async function loadStories(feed, page) {
  state.storyRequest?.abort();
  const controller = new AbortController();
  state.storyRequest = controller;
  const epoch = state.epoch;
  el("stories").setAttribute("aria-busy", "true");
  el("previous").disabled = true;
  el("next").disabled = true;
  message("story-status", `Loading ${feed.title}...`);
  try {
    const result = await api(`/api/feeds/${feed.id}/stories?page=${page}`, { signal: controller.signal });
    if (epoch !== state.epoch || controller.signal.aborted) return;
    const changed = state.feed?.id !== feed.id || state.page !== page;
    state.feed = feed;
    state.page = page;
    state.stories = result.stories;
    if (changed) clearArticle();
    else if (state.story) {
      const selected = state.stories.find((story) => story.hash === state.story);
      if (selected) selectStory(selected);
      else clearArticle();
    }
    renderFeeds();
    message("stories-heading", feed.title);
    renderStories();
    message("story-status", result.stories.length ? `${result.stories.length} stories` : result.can_continue ? "No visible stories on this page. Try the next page." : "No more stories in this feed.");
    message("page-label", `Page ${page}`);
    el("previous").hidden = page <= 1;
    el("next").hidden = !result.can_continue;
  } catch (error) {
    if (epoch === state.epoch) await readingError(error, "story-status");
  } finally {
    if (state.storyRequest === controller) {
      el("stories").setAttribute("aria-busy", "false");
      el("previous").disabled = false;
      el("next").disabled = false;
    }
  }
}

el("previous").addEventListener("click", () => state.feed && loadStories(state.feed, state.page - 1));
el("next").addEventListener("click", () => state.feed && loadStories(state.feed, state.page + 1));
window.addEventListener("offline", () => notice("You are offline. Your current view will stay here; retry when the connection returns."));
window.addEventListener("online", () => notice("Connection restored. Refresh when you are ready."));
connect();
