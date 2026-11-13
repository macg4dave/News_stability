import { KeyboardHandler } from "./keyboard.js";
import { initializeAppearance } from "./appearance.js";
import { getRelationBuckets, pageRelations } from "./relations.js";
import { initializeLayout } from "./layout.js";
import { createPicture, initializePictures } from "./pictures.js";
import { initializeInfiniteScroll } from "./infinite.js";
import { publicationDate, dayKey, dayLabel, timeElement } from "./dates.js";

const el = (id) => document.getElementById(id);
const articlePanel = el("article");
const state = { session: null, feeds: new Map(), folders: [], feed: null, view: "feed", page: 1, canContinue: false, moreError: false, emptyPages: 0, stories: [], story: null, originStory: null, readingPosition: null, selected: null, actionPending: false, resume: null, expiryTimer: null, epoch: 0, feedRequest: null, storyRequest: null, articleRequest: null };
initializeAppearance();
initializeLayout();
const refreshPictures = initializePictures();
el("reader").addEventListener("layoutchange", () => {
  placeArticle();
  if (el("reader").classList.contains("article-open")) {
    if (el("reader").dataset.layout === "list") el("article-title").scrollIntoView({ block: "nearest", behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }
  scheduleMore();
});
el("show-appearance").addEventListener("click", () => el("appearance").showModal());

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
  state.articleRequest?.abort();
}

function signedOut(text = "Sign in to your NewsBlur account.", clear = false) {
  cancelReading();
  clearTimeout(state.expiryTimer);
  if (el("shortcuts").open) el("shortcuts").close();
  state.resume = !clear && (state.feed || state.view !== "feed") ? { username: state.session?.username, view: state.view, feedID: state.feed?.id, page: state.page, filter: state.filter, query: state.query } : null;
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
  state.view = "feed";
  state.story = null;
  state.stories = [];
  el("feed-tree").replaceChildren();
  el("stories").replaceChildren();
  message("stories-heading", "Choose a feed");
  message("story-status", "Choose a feed to load stories.");
  state.canContinue = false;
  state.moreError = false;
  state.emptyPages = 0;
  el("stream-footer").hidden = true;
  el("collection-updated").replaceChildren();
  el("collection-updated").hidden = true;
  el("story-filters").hidden = true;
  el("story-query").value = "";
  el("read-filter").value = "all";
  state.filter = "all";
  state.query = "";
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
el("refresh").addEventListener("click", async () => {
  await loadFeeds();
  if (state.session?.authenticated && (state.feed || state.view !== "feed")) await loadReadingPage({ kind: state.view, feed: state.feed, page: 1 });
});
el("daily-briefing").addEventListener("click", () => loadReadingPage({ kind: "briefing", page: 1 }));
el("saved-stories").addEventListener("click", () => loadReadingPage({ kind: "saved", page: 1 }));
el("story-filters").addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.feed) loadReadingPage({ kind: "feed", feed: state.feed, page: 1, filter: el("read-filter").value, query: el("story-query").value.trim() });
});

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
  button.addEventListener("click", () => loadReadingPage({ kind: "feed", feed, page: 1 }));
  return button;
}

function renderFeeds() {
  const used = new Set();
  const hadFolders = el("feed-tree").querySelector("details") !== null;
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
        details.open = !hadFolders || openFolders.has(path);
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
  el("daily-briefing").setAttribute("aria-current", String(state.view === "briefing"));
  el("saved-stories").setAttribute("aria-current", String(state.view === "saved"));
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
    if (resume?.username === state.session?.username) {
      if (resume.view !== "feed") await loadReadingPage({ kind: resume.view, page: 1 });
      else if (state.feeds.has(resume.feedID)) await loadReadingPage({ kind: "feed", feed: state.feeds.get(resume.feedID), page: 1, filter: resume.filter, query: resume.query });
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
      state.canContinue = false;
      el("stream-footer").hidden = true;
      el("story-filters").hidden = true;
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
  el("reader").append(articlePanel);
  el("reader").classList.remove("article-open");
  state.readingPosition = null;
  state.articleRequest?.abort();
  state.story = null;
  state.selected = null;
  state.originStory = null;
  el("back-to-stories").hidden = true;
  renderActions();
  message("article-title", "A little space for the stories that matter.");
  message("article-feed", "SETTLE IN");
  message("article-meta", "Choose a story to start reading.");
  el("article-content").replaceChildren();
  el("original").hidden = true;
  el("original").removeAttribute("href");
  el("article-status").hidden = true;
  el("full-text-status").hidden = true;
  el("connections").replaceChildren();
  el("connections").hidden = true;
}

function renderStoryMeta(target, story) {
  const readingTime = story.reading_minutes > 0 ? `About ${story.reading_minutes} min read` : "";
  const date = publicationDate(story);
  const parts = [story.kind === "briefing_summary" ? "NewsBlur summary" : "", story.feed_title, story.author, date ? timeElement(date) : story.date, readingTime, story.read ? "Read" : "", story.saved ? "Saved" : ""].filter(Boolean);
  target.replaceChildren();
  for (const part of parts) {
    if (target.childNodes.length) target.append(" · ");
    target.append(part);
  }
}

function selectStory(story, preserveOrigin = false) {
  if (!el("reader").classList.contains("article-open")) {
    state.readingPosition = { x: window.scrollX, y: window.scrollY };
  }
  el("reader").classList.add("article-open");
  state.articleRequest?.abort();
  el("article-status").hidden = true;
  state.story = story.hash;
  state.selected = story;
  if (!preserveOrigin && state.stories.some((item) => item.hash === story.hash)) state.originStory = story.hash;
  placeArticle();
  el("back-to-stories").hidden = !state.originStory;
  renderActions();
  message("article-title", story.title || "Untitled story");
  message("article-feed", story.feed_title || state.feeds.get(story.feed_id)?.title || state.feed?.title || "NewsBlur");
  renderStoryMeta(el("article-meta"), story);
  renderArticleContent(story);
  let original = null;
  try {
    const url = new URL(story.url);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) original = url.href;
  } catch { /* No safe original link was supplied. */ }
  el("original").hidden = !original;
  if (original) el("original").href = original;
  else el("original").removeAttribute("href");
  renderConnections(story);
  for (const button of el("stories").querySelectorAll(".story")) button.setAttribute("aria-current", String(button.dataset.hash === story.hash));
  if (el("reader").dataset.layout === "list") el("article-title").scrollIntoView({ block: "nearest", behavior: "instant" });
  else window.scrollTo({ top: 0, behavior: "instant" });
  el("article-title").focus({ preventScroll: true });
  el("full-text-status").hidden = true;
  if (story.kind !== "briefing_summary") loadFullText(story);
}

function renderArticleContent(story) {
  // This is the sole HTML insertion point. Feed, linked, briefing and full-text
  // endpoints all apply the same server-owned article sanitizer allowlist.
  el("article-content").innerHTML = story.html;
  if (!story.html) message("article-content", "This story has no article text. You can read it on the original site.");
  if (!el("article-content").querySelector("img[data-picture-src]")) {
    const lead = createPicture(story.picture);
    if (lead) el("article-content").prepend(lead);
  }
  refreshPictures();
}

async function loadFullText(story) {
  el("full-text-status").hidden = false;
  if (story.fullTextLoaded) {
    message("full-text-status", "Full text from NewsBlur.");
    return;
  }
  const controller = new AbortController();
  state.articleRequest = controller;
  const epoch = state.epoch;
  message("full-text-status", "Loading full text from NewsBlur...");
  try {
    const text = await api(`/api/stories/${encodeURIComponent(story.hash)}/text`, { signal: controller.signal });
    if (epoch !== state.epoch || controller.signal.aborted || state.selected !== story) return;
    if (text.hash !== story.hash || typeof text.html !== "string") throw new Error("Unexpected full-text response.");
    // Only replace content fields: read/saved state may have changed in flight.
    Object.assign(story, { html: text.html, reading_minutes: text.reading_minutes, links: text.links, picture: text.picture || story.picture, fullTextLoaded: true });
    renderArticleContent(story);
    renderStoryMeta(el("article-meta"), story);
    renderConnections(story);
    message("full-text-status", "Full text from NewsBlur.");
  } catch (error) {
    if (epoch !== state.epoch || controller.signal.aborted || state.selected !== story) return;
    if (error.code === "session_expired") await readingError(error, "full-text-status");
    else message("full-text-status", `${error.code === "full_text_unavailable" ? "Full text is unavailable." : "Could not load full text."} Showing the feed version. You can read the original.`, true);
  }
}

function renderActions() {
  const story = state.selected;
  el("story-actions").hidden = !story || story.kind === "briefing_summary";
  el("toggle-read").textContent = story?.read ? "Mark unread" : "Mark read";
  el("toggle-save").textContent = story?.saved ? "Unsave story" : "Save story";
  el("toggle-read").disabled = state.actionPending;
  el("toggle-save").disabled = state.actionPending;
}

async function changeStoryState(field) {
  const story = state.selected;
  if (!story || state.actionPending) return;
  const epoch = state.epoch;
  const value = !story[field];
  const action = field === "read" ? (value ? "read" : "unread") : (value ? "save" : "unsave");
  state.actionPending = true;
  renderActions();
  message("article-status", "Saving change to NewsBlur...");
  el("article-status").hidden = false;
  try {
    await api(`/api/stories/${encodeURIComponent(story.hash)}/state`, { method: "POST", body: JSON.stringify({ action }) });
    if (epoch !== state.epoch) return;
    // Update only after confirmation. Navigation may have changed during the write.
    story[field] = value;
    for (const item of state.stories) if (item.hash === story.hash) item[field] = value;
    if (state.selected?.hash === story.hash) {
      state.selected[field] = value;
      renderStoryMeta(el("article-meta"), state.selected);
      message("article-status", "Change saved to NewsBlur.");
      el("article-status").hidden = false;
    }
    renderStories();
    if (field === "read") await loadFeeds();
  } catch (error) {
    if (epoch === state.epoch) {
      el("article-status").hidden = false;
      await readingError(error, "article-status");
    }
  } finally {
    state.actionPending = false;
    renderActions();
  }
}

el("toggle-read").addEventListener("click", () => changeStoryState("read"));
el("toggle-save").addEventListener("click", () => changeStoryState("saved"));
function returnToStories() {
  el("reader").classList.remove("article-open");
  placeArticle();
  const origin = [...el("stories").querySelectorAll(".story")].find((button) => button.dataset.hash === state.originStory);
  if (!origin) return;
  origin.focus({ preventScroll: true });
  if (state.readingPosition) window.scrollTo({ left: state.readingPosition.x, top: state.readingPosition.y, behavior: "instant" });
  const box = origin.getBoundingClientRect();
  if (box.bottom <= 0 || box.top >= innerHeight) origin.scrollIntoView({ block: "center", behavior: "instant" });
  scheduleMore();
}
el("back-to-stories").addEventListener("click", returnToStories);

function placeArticle() {
  const inline = el("reader").dataset.layout === "list";
  const open = el("reader").classList.contains("article-open");
  let row = null;
  for (const button of el("stories").querySelectorAll(".story")) {
    if (inline) {
      button.setAttribute("aria-expanded", String(open && button.dataset.hash === state.originStory));
      button.setAttribute("aria-controls", "article");
    } else {
      button.removeAttribute("aria-expanded");
      button.removeAttribute("aria-controls");
    }
    if (button.dataset.hash === state.originStory) row = button.parentElement;
  }
  const destination = inline && open && row ? row : el("reader");
  if (articlePanel.parentElement !== destination) destination.append(articlePanel);
  el("back-to-stories").textContent = inline ? "Close story" : "Back to stories";
}

function renderStories(items = state.stories, append = false) {
  const list = document.createDocumentFragment();
  const offset = append ? el("stories").children.length : 0;
  let previousDay = offset ? dayKey(publicationDate(state.stories[offset - 1])) : null;
  for (const story of items) {
    const row = document.createElement("li");
    const date = publicationDate(story);
    const day = dayKey(date);
    if (day !== previousDay) {
      const heading = document.createElement("h3");
      heading.className = "date-heading";
      heading.textContent = dayLabel(date);
      row.append(heading);
      row.dataset.dayStart = "true";
    }
    previousDay = day;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `story${story.read ? " read" : ""}`;
    button.dataset.hash = story.hash;
    button.setAttribute("aria-current", String(story.hash === state.story));
    const picture = createPicture(story.picture, "", true);
    if (picture) button.append(picture);
    const title = document.createElement("strong");
    title.dir = "auto";
    title.textContent = story.title || "Untitled story";
    const meta = document.createElement("small");
    renderStoryMeta(meta, story);
    button.append(title, meta);
    if (story.excerpt) {
      const excerpt = document.createElement("span");
      excerpt.className = "story-excerpt";
      excerpt.dir = "auto";
      excerpt.textContent = story.excerpt;
      // The title and metadata name the button; the excerpt remains available
      // in reading order without making keyboard controls excessively verbose.
      const titleID = `story-title-${offset + list.childElementCount}`;
      const metaID = `story-meta-${offset + list.childElementCount}`;
      title.id = titleID;
      meta.id = metaID;
      button.setAttribute("aria-labelledby", `${titleID} ${metaID}`);
      button.append(excerpt);
    }
    button.addEventListener("click", () => {
      if (el("reader").dataset.layout === "list" && el("reader").classList.contains("article-open") && state.originStory === story.hash) returnToStories();
      else selectStory(story);
    });
    row.append(button);
    list.append(row);
  }
  if (append) {
    el("stories").append(list);
    placeArticle();
    refreshPictures();
    return;
  }
  // Keep the single article panel and its controls alive while replacing rows.
  const focused = articlePanel.contains(document.activeElement) ? document.activeElement : null;
  el("reader").append(articlePanel);
  el("stories").replaceChildren(list);
  placeArticle();
  focused?.focus({ preventScroll: true });
  refreshPictures();
}

function renderConnections(story) {
  const panel = el("connections");
  panel.replaceChildren();
  const relatedHashes = new Set();
  function group(title, items, scope = "") {
    const unique = new Map(items.filter((item) => item.hash && item.hash !== story.hash).map((item) => [item.hash, item]));
    if (!unique.size) return;
    const heading = document.createElement("h2");
    heading.textContent = title;
    panel.append(heading);
    if (scope) {
      const explanation = document.createElement("p");
      explanation.textContent = scope;
      panel.append(explanation);
    }
    const list = document.createElement("ul");
    for (const item of [...unique.values()].slice(0, 50)) {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = [item.title || "Untitled story", item.feed_title].filter(Boolean).join(" · ");
      button.addEventListener("click", () => loadLinkedStory(item));
      row.append(button);
      list.append(row);
    }
    panel.append(list);
  }
  for (const item of story.related || []) relatedHashes.add(item.hash);
  group(story.kind === "briefing_summary" ? "Briefing source stories" : "Related coverage from NewsBlur", story.related || []);
  const visible = state.stories.some((item) => item.hash === story.hash) ? state.stories : [...state.stories, story];
  const links = getRelationBuckets(pageRelations(visible), story.hash);
  group("Links to loaded stories", links.referencing.filter((item) => !relatedHashes.has(item.hash)), "These articles are explicitly linked in the story above.");
  group("Linked from loaded stories", links.referenced, "These loaded articles link to this story; this is not a search of all your feeds.");
  panel.hidden = !panel.childElementCount;
}

async function loadLinkedStory(reference) {
  const cached = state.stories.find((story) => story.hash === reference.hash);
  if (cached) { selectStory(cached, true); return; }
  state.articleRequest?.abort();
  const controller = new AbortController();
  state.articleRequest = controller;
  const epoch = state.epoch;
  message("article-status", "Loading linked story...");
  el("article-status").hidden = false;
  try {
    const story = await api(`/api/stories/${encodeURIComponent(reference.hash)}`, { signal: controller.signal });
    if (epoch !== state.epoch || controller.signal.aborted) return;
    story.feed_title ||= reference.feed_title || state.feeds.get(story.feed_id)?.title || "NewsBlur";
    selectStory(story, true);
  } catch (error) {
    if (epoch === state.epoch && !controller.signal.aborted) await readingError(error, "article-status");
  }
}

async function loadReadingPage(selection) {
  const { kind, feed, page, append = false } = selection;
  const sameFeed = kind === "feed" && state.view === "feed" && feed?.id === state.feed?.id;
  const filter = selection.filter ?? (sameFeed ? state.filter || "all" : "all");
  const query = selection.query ?? (sameFeed ? state.query || "" : "");
  state.storyRequest?.abort();
  const controller = new AbortController();
  state.storyRequest = controller;
  const epoch = state.epoch;
  el("stories").setAttribute("aria-busy", "true");
  el("load-more").disabled = true;
  const title = kind === "briefing" ? "Daily Briefing" : kind === "saved" ? "Saved stories" : feed.title;
  if (append) message("stream-status", "Loading more stories...");
  else message("story-status", `Loading ${title}...`);
  try {
    const path = kind === "briefing" ? `/api/briefing?page=${page}` : kind === "saved" ? `/api/saved?page=${page}` : `/api/feeds/${feed.id}/stories?${new URLSearchParams({ page, read_filter: filter, query })}`;
    const result = await api(path, { signal: controller.signal });
    if (epoch !== state.epoch || controller.signal.aborted) return;
    const changed = state.view !== kind || state.feed?.id !== feed?.id || state.filter !== filter || state.query !== query;
    state.feed = feed || null;
    state.view = kind;
    state.page = page;
    state.filter = filter;
    state.query = query;
    el("story-filters").hidden = kind !== "feed";
    el("read-filter").value = filter;
    el("story-query").value = query;
    const known = new Set(append ? state.stories.map((story) => story.hash) : []);
    const fresh = result.stories.filter((story) => {
      if (known.has(story.hash)) return false;
      known.add(story.hash);
      return true;
    });
    state.stories = append ? [...state.stories, ...fresh] : fresh;
    state.canContinue = result.can_continue === true;
    state.moreError = false;
    state.emptyPages = fresh.length ? 0 : (append ? state.emptyPages + 1 : 1);
    if (!append) state.preview = result.preview;
    if (!append && changed) clearArticle();
    else if (!append && state.story) {
      const selected = state.stories.find((story) => story.hash === state.story);
      if (selected) selectStory(selected);
      else clearArticle();
    }
    if (!append) renderFeeds();
    if (!append) {
      el("collection-updated").replaceChildren("Last refreshed ", timeElement(new Date()));
      el("collection-updated").hidden = false;
    }
    message("stories-heading", title);
    renderStories(append ? fresh : state.stories, append);
    const briefingStates = {
      unsupported: "Daily Briefing is not available on this NewsBlur server.",
      disabled: "Daily Briefing is turned off in NewsBlur. Enable it there to receive summaries.",
      empty: "No briefing is available yet. Check back after NewsBlur creates one.",
    };
    const ready = state.stories.length ? `${state.stories.length} stories${state.preview ? " · NewsBlur preview" : ""}` : result.can_continue ? "Looking for visible stories..." : query ? "No stories match this search." : kind === "saved" ? "No saved stories." : "No stories in this feed.";
    message("story-status", kind === "briefing" && briefingStates[result.state] ? briefingStates[result.state] : ready);
  } catch (error) {
    if (epoch === state.epoch && !controller.signal.aborted) {
      state.moreError = true;
      await readingError(error, append ? "stream-status" : "story-status");
    }
  } finally {
    if (state.storyRequest === controller) {
      el("stories").setAttribute("aria-busy", "false");
      state.storyRequest = null;
      renderStreamStatus();
      scheduleMore();
    }
  }
}

function renderStreamStatus() {
  el("stream-footer").hidden = !state.session?.authenticated || (!state.feed && state.view === "feed");
  el("load-more").hidden = !state.canContinue;
  el("load-more").disabled = state.storyRequest !== null;
  el("load-more").textContent = state.moreError ? "Retry loading stories" : "Load more stories";
  const text = state.moreError ? "Could not load more stories. Your current stories have been kept." : !state.canContinue ? "No more stories." : state.emptyPages >= 3 ? "No new visible stories in the last few batches. Load more to continue." : "More stories load as you scroll.";
  message("stream-status", text, state.moreError);
}

function loadMoreStories(automatic = false) {
  if (!state.session?.authenticated || !state.canContinue || state.storyRequest) return;
  if (automatic && (state.moreError || state.emptyPages >= 3)) return;
  if (!automatic) state.emptyPages = 0;
  return loadReadingPage({ kind: state.view, feed: state.feed, page: state.page + 1, append: true });
}

const scheduleMore = initializeInfiniteScroll(el("stream-footer"), () => loadMoreStories(true));
el("load-more").addEventListener("click", () => loadMoreStories());
window.addEventListener("offline", () => notice("You are offline. Your current view will stay here; retry when the connection returns."));
window.addEventListener("online", () => notice("Connection restored. Refresh when you are ready."));

function moveStory(direction) {
  if (!state.stories.length) return;
  const current = state.stories.findIndex((story) => story.hash === state.story);
  const next = current < 0 ? (direction > 0 ? 0 : state.stories.length - 1) : current + direction;
  if (next >= 0 && next < state.stories.length) selectStory(state.stories[next]);
}

const keyboard = new KeyboardHandler(() => state.session?.authenticated && !el("reader").hidden);
keyboard.on("j", () => moveStory(1));
keyboard.on("k", () => moveStory(-1));
keyboard.on("v", () => { if (!el("original").hidden) el("original").click(); });
keyboard.on("g f", () => {
  if (el("reader").classList.contains("article-open")) returnToStories();
  (el("feed-tree").querySelector(".feed[aria-current='true']") || el("feed-tree").querySelector(".feed"))?.focus();
});
keyboard.on("g s", () => {
  if (el("reader").classList.contains("article-open")) returnToStories();
  else (el("stories").querySelector(".story[aria-current='true']") || el("stories").querySelector(".story"))?.focus();
});
keyboard.on("?", () => el("shortcuts").showModal());
keyboard.listen();
el("show-shortcuts").addEventListener("click", () => el("shortcuts").showModal());
connect();
