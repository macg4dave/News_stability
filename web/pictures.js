// Original News Stability code. Server-side NewsBlur cookies stay in Go;
// the browser makes normal image requests governed by its cookie settings.
const storageKey = "news-stability-pictures-v1";

function safePictureURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && url.origin !== location.origin) return url.href;
  } catch { /* Invalid image metadata leaves a text-only story. */ }
  return "";
}

export function createPicture(value, alt = "", thumbnail = false) {
  const url = safePictureURL(value);
  if (!url) return null;
  const image = document.createElement("img");
  image.dataset.pictureSrc = url;
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
      const url = safePictureURL(image.dataset.pictureSrc);
      if (!url) { image.remove(); continue; }
      if (!image.parentElement.classList.contains("picture-frame")) {
        const placeholder = document.createTextNode("");
        image.replaceWith(placeholder);
        placeholder.replaceWith(pictureFrame(image));
      }
      const frame = image.parentElement;
      const visible = control.value === "show";
      frame.hidden = !visible;
      if (!prepared.has(image)) {
        prepared.add(image);
        // Ordinary image display does not require CORS permission. Keep URLs
        // isolated from reader-origin endpoints and suppress the referrer.
        // External hosts receive a normal browser image request.
        image.referrerPolicy = "no-referrer";
        image.loading = "lazy";
        image.decoding = "async";
        image.addEventListener("error", () => {
          if (!image.hasAttribute("src")) return;
          image.dataset.failed = "true";
          image.hidden = true;
          frame.querySelector(".picture-fallback").hidden = false;
        });
      }
      if (!visible) image.removeAttribute("src");
      else if (!image.dataset.failed && !image.hasAttribute("src")) image.src = url;
    }
  }

  control.addEventListener("change", () => {
    if (!["show", "hide"].includes(control.value)) return;
    refresh();
    try { localStorage.setItem(storageKey, control.value); } catch { /* Tab-local choice. */ }
  });
  // Refresh image visibility before layout.js restores its story scroll anchor.
  reader.addEventListener("layoutchange", refresh);
  return refresh;
}
