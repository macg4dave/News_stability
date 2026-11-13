// Original News Stability implementation. No upstream source or assets copied.
const layouts = ["cards", "magazine", "list"];
const storageKey = "news-stability-layout-v1";

export function initializeLayout() {
  const control = document.getElementById("story-layout");
  const reader = document.getElementById("reader");
  const stories = document.getElementById("stories");
  let layout = "cards";
  try {
    const saved = localStorage.getItem(storageKey);
    if (layouts.includes(saved)) layout = saved;
  } catch { /* Disabled storage still allows layout changes for this tab. */ }
  control.value = layout;
  reader.dataset.layout = layout;

  control.addEventListener("change", () => {
    if (!layouts.includes(control.value)) return;
    // Keep a visible story at the same viewport position as its shape changes.
    // Existing DOM nodes, focus, selection, and all request state stay intact.
    const anchor = [...stories.children].find((row) => {
      const box = row.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight;
    });
    const top = anchor?.getBoundingClientRect().top;
    reader.dataset.layout = control.value;
    reader.dispatchEvent(new Event("layoutchange"));
    if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - top);
    try { localStorage.setItem(storageKey, control.value); } catch { /* Keep this tab usable. */ }
  });
}
