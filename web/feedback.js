// Explicit NewsBlur classifier training; confirmed choices live only in memory.
export function initializeFeedback({ api, current, epoch, readingError }) {
  const panel = document.getElementById("feedback");
  const target = document.getElementById("training-target");
  const status = document.getElementById("feedback-status");
  const like = document.getElementById("like-story");
  const dislike = document.getElementById("dislike-story");
  const clear = document.getElementById("clear-training");
  const confirmed = new Map();
  let pending = false;
  let request = null;
  let choices = [];
  let owner = null;

  function update() {
    const choice = choices[Number(target.value)];
    const opinion = choice && confirmed.get(JSON.stringify([owner, choice.target, choice.value]));
    like.setAttribute("aria-pressed", String(opinion === "like"));
    dislike.setAttribute("aria-pressed", String(opinion === "dislike"));
    for (const button of [like, dislike, clear]) button.disabled = pending || !choice;
    target.disabled = pending;
    const label = choice?.label || "choice";
    like.title = `Like ${label} in NewsBlur`;
    dislike.title = `Dislike ${label} in NewsBlur`;
  }

  function render(story) {
    owner = story.hash.split(":")[0];
    choices = [];
    const add = (kind, value, label) => {
      if (typeof value === "string" && value.trim() && [...value].length <= 255) choices.push({ target: kind, value, label });
    };
    add("title", story.title, `Headline: ${story.title}`);
    add("author", story.author, `Author: ${story.author}`);
    for (const tag of new Set(story.tags || [])) add("tag", tag, `Topic: ${tag}`);
    target.replaceChildren(...choices.map((choice, i) => new Option(choice.label, String(i))));
    status.textContent = "";
    panel.hidden = story.kind === "briefing_summary" || !choices.length;
    update();
  }

  async function train(action) {
    const story = current();
    const choice = choices[Number(target.value)];
    if (!story || !choice || pending) return;
    const startedEpoch = epoch();
    const key = JSON.stringify([owner, choice.target, choice.value]);
    pending = true;
    const controller = new AbortController();
    request = controller;
    status.classList.remove("error");
    status.textContent = "Sending feedback to NewsBlur…";
    update();
    try {
      await api(`/api/stories/${encodeURIComponent(story.hash)}/feedback`, { method: "POST", body: JSON.stringify({ action, target: choice.target, value: choice.value }), signal: controller.signal });
      if (startedEpoch !== epoch()) return;
      confirmed.set(key, action);
      if (current() === story) status.textContent = action === "clear" ? "Training cleared in NewsBlur. Refresh to update Focus." : "NewsBlur confirmed your feedback. Refresh to update Focus.";
    } catch (error) {
      if (startedEpoch === epoch() && current() === story) await readingError(error, "feedback-status");
    } finally {
      if (request === controller) {
        request = null;
        pending = false;
        if (startedEpoch === epoch()) update();
      }
    }
  }

  target.addEventListener("change", () => { status.textContent = ""; update(); });
  like.addEventListener("click", () => train("like"));
  dislike.addEventListener("click", () => train("dislike"));
  clear.addEventListener("click", () => train("clear"));
  return { render, reset: () => { request?.abort(); request = null; pending = false; confirmed.clear(); panel.hidden = true; } };
}
