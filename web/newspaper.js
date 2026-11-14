// Original News Stability composition. Design research and licence decisions:
// docs/newspaper-research.md. No third-party layout engine or source is bundled.

// Consecutive stories form a small editorial unit. Template selection considers
// real picture shape and the estimated amount of type, never inferred importance.
const sentences = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(document.documentElement.lang || "en", { granularity: "sentence" }) : null;

function introduction(text, limit) {
  if (text.length <= limit) return text;
  let complete = "";
  if (sentences) {
    for (const part of sentences.segment(text)) {
      if (part.index + part.segment.length > limit) break;
      complete += part.segment;
    }
  }
  if (complete.trim().length >= limit * .45) return complete.trim();
  const cut = Array.from(text).slice(0, limit - 1).join("").replace(/\s+\S*$/, "").trimEnd();
  return cut + "\u2026";
}

function compose(group, width, fontSize, textWidth) {
  const items = group.map(row => {
    const button = row.querySelector(".story");
    const image = button.querySelector(".story-picture:not([hidden]) img:not([hidden])");
    const picture = image && !image.dataset.failed && image.dataset.smallPicture !== "true";
    return {
      picture,
      portrait: picture && image.naturalWidth > 0 && image.naturalHeight > image.naturalWidth * 1.15,
      title: button.querySelector("strong").textContent,
      copy: button.querySelector(".story-excerpt")?.dataset.fullExcerpt || "",
    };
  });
  if (items.length > 1 && items.every(item => !item.picture && item.title.length + item.copy.length < 220)) return items.map(() => "brief");
  if (items.length === 1) return [!items[0].picture && items[0].title.length + items[0].copy.length < 280 ? "brief" : "solo"];
  if (items.length === 2) {
    if (items[0].portrait && items[1].portrait) return ["half", "half"];
    if (items[0].portrait) return ["duo-text", "duo-photo"];
    if (items[0].picture) return ["duo-photo", "duo-text"];
    if (items[1].picture) return ["duo-text", "duo-photo"];
    return ["half", "half"];
  }
  // Estimate occupied lines using the actual system typeface, not character
  // count (wide scripts and long words must not be mistaken for short copy).
  // Native CSS owns final wrapping; no text is split or cloned in JavaScript.
  const columnWidth = Math.max(1, (width - 3 * fontSize) / 3);
  const occupiedLines = items.map(item => textWidth(item.title, `700 ${1.45 * fontSize}px Georgia`) / columnWidth * 1.8
    + textWidth(item.copy, `${fontSize}px Georgia`) / columnWidth);
  const substantialLead = occupiedLines[0] > 12 && occupiedLines[0] > Math.max(occupiedLines[1], occupiedLines[2]) * 1.5;
  if (items[0].portrait) return ["portrait", "wide-side", "wide-side"];
  if (items[0].picture || substantialLead) return ["lead", "side", "side"];
  if (items[1].picture && !items[1].portrait) return ["opener", "feature-right", "under-opener"];
  return ["column", "column", "column"];
}

export function initializeNewspaper(reader, list, beforeReflow) {
  let first = null;
  let groups = [];
  let assigned = new WeakSet();
  let queued = false;
  const measure = document.createElement("canvas").getContext("2d");
  const textWidth = (text, font) => { measure.font = font; return measure.measureText(text).width; };

  function refresh() {
    if (!list.children.length) {
      first = null;
      groups = [];
      assigned = new WeakSet();
      return;
    }
    if (reader.dataset.layout !== "magazine") {
      for (const excerpt of list.querySelectorAll(".story-excerpt")) excerpt.textContent = excerpt.dataset.fullExcerpt;
      return;
    }
    if (reader.classList.contains("article-open")) return;
    if (list.firstElementChild !== first) {
      first = list.firstElementChild;
      groups = [];
      assigned = new WeakSet();
    }
    // Seal each fetched unit. Appending must not regroup already visible rows.
    let pending = [];
    const seal = () => { if (pending.length) groups.push(pending); pending = []; };
    for (const row of list.children) {
      if (assigned.has(row)) continue;
      if (row.dataset.dayStart) seal();
      pending.push(row);
      assigned.add(row);
      if (pending.length === 3) seal();
    }
    seal();
    const width = list.getBoundingClientRect().width;
    const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const changes = [];
    for (const group of groups) {
      const roles = compose(group, width, fontSize, textWidth);
      const sidePhoto = group.slice(1).some(row => row.querySelector('.story-picture:not([hidden]) img[data-small-picture="false"]'));
      group.forEach((row, index) => {
        const excerpt = row.querySelector(".story-excerpt");
        const photo = row.querySelector(".story-picture img");
        const limit = ["side", "opener", "under-opener"].includes(roles[index]) ? (sidePhoto ? 300 : 480)
          : photo && photo.dataset.smallPicture !== "true" ? 800 : 1200;
        const copy = excerpt ? introduction(excerpt.dataset.fullExcerpt, limit) : "";
        const briefStart = roles[index] === "brief" && index === 0;
        if (row.dataset.pressRole !== roles[index] || excerpt && excerpt.textContent !== copy || row.hasAttribute("data-brief-start") !== briefStart) changes.push([row, roles[index], copy, briefStart]);
      });
    }
    if (!changes.length) return;
    const anchor = [...list.querySelectorAll(".story")].find(node => {
      const box = node.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight;
    });
    const top = anchor?.getBoundingClientRect().top;
    beforeReflow();
    for (const [row, role, copy, briefStart] of changes) {
      row.dataset.pressRole = role;
      row.toggleAttribute("data-brief-start", briefStart);
      const excerpt = row.querySelector(".story-excerpt");
      if (excerpt) excerpt.textContent = copy;
    }
    // Recomposition is presentation, never a reading gesture.
    if (anchor && window.scrollY > 0) window.scrollBy(0, anchor.getBoundingClientRect().top - top);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; refresh(); });
  }
  new ResizeObserver(schedule).observe(list.parentElement);
  reader.addEventListener("pictureschange", schedule);
  document.fonts.ready.then(schedule);
  return refresh;
}
