// Original News Stability implementation. No upstream source or assets copied.
const layouts = ["cards", "magazine", "list"];
const storageKey = "news-stability-layout-v1";

export function initializeLayout() {
  const controls = [...document.querySelectorAll("[data-layout-choice]")];
  const reader = document.getElementById("reader");
  const stories = document.getElementById("stories");
  let layout = "cards";
  try {
    const saved = localStorage.getItem(storageKey);
    if (layouts.includes(saved)) layout = saved;
  } catch { /* Disabled storage still allows layout changes for this tab. */ }
  function applyLayout(value) {
    reader.dataset.layout = value;
    controls.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.layoutChoice === value)));
  }
  applyLayout(layout);

  controls.forEach(control => control.addEventListener("click", () => {
    const value = control.dataset.layoutChoice;
    if (!layouts.includes(value) || reader.dataset.layout === value) return;
    // Keep a visible story at the same viewport position as its shape changes.
    // Existing DOM nodes, focus, selection, and all request state stay intact.
    const anchor = reader.classList.contains("article-open") ? null : [...stories.querySelectorAll(".story")].find((row) => {
      const box = row.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight;
    });
    const top = anchor?.getBoundingClientRect().top;
    applyLayout(value);
    reader.dispatchEvent(new Event("layoutchange"));
    if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - top);
    try { localStorage.setItem(storageKey, value); } catch { /* Keep this tab usable. */ }
  }));
}
