// Original News Stability code. Server-side NewsBlur cookies stay in Go;
// the browser makes normal image requests governed by its cookie settings.
const storageKey = "news-stability-pictures-v1";

function safePictureURL(value) {
  try {
    const url = new URL(value, location.origin);
    if (url.origin === location.origin && !url.username && !url.password && url.pathname === "/api/newsblur-picture" && !url.hash && [...url.searchParams].length === 1 && url.searchParams.get("path")?.startsWith("/imageproxy/")) return url.href;
    if (url.protocol === "https:" && !url.username && !url.password && url.origin !== location.origin) return url.href;
  } catch { /* Invalid image metadata leaves a text-only story. */ }
  return "";
}

export function createPicture(value, alt = "", thumbnail = false, small = "") {
  const candidates = [...new Set((Array.isArray(value) ? value : [value]).map(safePictureURL).filter(Boolean))].slice(0, 6);
  const url = candidates[0];
  if (!url) return null;
  const image = document.createElement("img");
  image.dataset.pictureSrc = url;
  image.dataset.pictureCandidates = JSON.stringify(candidates);
  if (safePictureURL(small)) image.dataset.thumbnailSrc = safePictureURL(small);
  image.alt = alt;
  return pictureFrame(image, thumbnail);
}

function pictureFrame(image, thumbnail = false) {
  const frame = document.createElement("span");
  frame.className = thumbnail ? "picture-frame story-picture" : "picture-frame article-picture";
  const fallback = document.createElement("span");
  fallback.className = "picture-fallback";
  fallback.textContent = image.alt ? `Picture unavailable: ${image.alt}` : "Picture unavailable";
  fallback.hidden = true;
  frame.append(image, fallback);
  return frame;
}

export function initializePictures() {
  const control = document.getElementById("appearance-pictures");
  const reader = document.getElementById("reader");
  const prepared = new WeakSet();
  try {
    const saved = localStorage.getItem(storageKey);
    if (["show", "hide"].includes(saved)) control.value = saved;
  } catch { /* The control still works without browser storage. */ }

  function refresh() {
    for (const image of reader.querySelectorAll("img[data-picture-src]")) {
      let values;
      try { values = JSON.parse(image.dataset.pictureCandidates || "null"); } catch { values = null; }
      if (!Array.isArray(values)) values = [image.dataset.pictureSrc, image.dataset.pictureFallback];
      if (reader.dataset.layout === "list" && image.dataset.thumbnailSrc) values = [image.dataset.thumbnailSrc, ...values];
      const candidates = [...new Set(values.map(safePictureURL).filter(Boolean))].slice(0, 6);
      if (!candidates.length) { image.remove(); continue; }
      if (!image.parentElement.classList.contains("picture-frame")) {
        const placeholder = document.createTextNode("");
        image.replaceWith(placeholder);
        placeholder.replaceWith(pictureFrame(image));
      }
      const frame = image.parentElement;
      const visible = control.value === "show";
      frame.hidden = !visible;
      const selection = JSON.stringify(candidates);
      if (image.dataset.selection !== selection) {
        image.dataset.selection = selection;
        image.dataset.candidateIndex = "0";
        delete image.dataset.failed;
        image.hidden = false;
        frame.querySelector(".picture-fallback").hidden = true;
        image.removeAttribute("src");
      }
      if (!prepared.has(image)) {
        prepared.add(image);
        // Ordinary image display does not require CORS permission. Keep URLs
        // isolated from reader-origin endpoints and suppress the referrer.
        // External hosts receive a normal browser image request.
        image.referrerPolicy = "no-referrer";
        image.loading = "lazy";
        image.decoding = "async";
        image.addEventListener("load", () => {
          const small = image.naturalWidth < 100 || image.naturalHeight < 80;
          image.dataset.smallPicture = String(small);
          // Try the remaining NewsBlur-supplied candidates before accepting a
          // thumbnail. Never guess a URL or fetch a publisher page.
          const sources = JSON.parse(image.dataset.selection);
          const next = Number(image.dataset.candidateIndex) + 1;
          if (small && reader.dataset.layout !== "list" && next < sources.length) {
            image.dataset.candidateIndex = String(next);
            image.src = sources[next];
            return;
          }
          frame.classList.toggle("small-picture", small);
          reader.dispatchEvent(new Event("pictureschange"));
        });
        image.addEventListener("error", () => {
          if (!image.hasAttribute("src")) return;
          const sources = JSON.parse(image.dataset.selection);
          const next = Number(image.dataset.candidateIndex) + 1;
          if (control.value === "show" && next < sources.length) {
            image.dataset.candidateIndex = String(next);
            image.src = sources[next];
            return;
          }
          image.dataset.failed = "true";
          image.hidden = true;
          frame.querySelector(".picture-fallback").hidden = false;
          reader.dispatchEvent(new Event("pictureschange"));
        });
      }
      if (!visible) image.removeAttribute("src");
      else if (!image.dataset.failed && !image.hasAttribute("src")) image.src = candidates[Number(image.dataset.candidateIndex) || 0];
    }
  }

  control.addEventListener("change", () => {
    if (!["show", "hide"].includes(control.value)) return;
    refresh();
    reader.dispatchEvent(new Event("pictureschange"));
    try { localStorage.setItem(storageKey, control.value); } catch { /* Tab-local choice. */ }
  });
  // Refresh image visibility before layout.js restores its story scroll anchor.
  reader.addEventListener("layoutchange", refresh);
  return refresh;
}
