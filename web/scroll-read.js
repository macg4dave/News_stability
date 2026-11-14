// Mark only stories actually seen and then passed during deliberate scrolling.
// Navigation, layout changes, background tabs and offline browsing never write.
export function initializeScrollRead(candidates, markRead) {
  let armed = false;
  let previousY = scrollY;
  let scheduled = false;
  let seen = new WeakSet();
  let touchY = null;

  function inspect(mark = false) {
    if (document.hidden || !navigator.onLine || document.querySelector("dialog[open]")) return;
    for (const { node, story, article } of candidates()) {
      if (!node.getClientRects().length) continue;
      const box = node.getBoundingClientRect();
      if (mark && seen.has(node) && (article ? box.top < innerHeight && box.bottom <= innerHeight : box.bottom <= 0)) markRead(story);
      if (box.bottom > 0 && box.top < innerHeight) seen.add(node);
    }
  }

  function arm(event, downward = false) {
    if (event.target.closest?.(".subscriptions") || document.hidden || !navigator.onLine || document.querySelector("dialog[open]")) { armed = false; return; }
    armed = true;
    inspect();
    // A short article may already fit entirely, leaving no scroll event to emit.
    if (downward && scrollY + innerHeight >= document.documentElement.scrollHeight - 1) inspect(true);
  }
  window.addEventListener("wheel", event => arm(event, event.deltaY > 0), { passive: true });
  window.addEventListener("touchstart", event => { touchY = event.touches[0]?.clientY ?? null; }, { passive: true });
  window.addEventListener("touchmove", event => {
    const nextY = event.touches[0]?.clientY ?? null;
    arm(event, touchY !== null && nextY !== null && nextY < touchY);
    touchY = nextY;
  }, { passive: true });
  window.addEventListener("pointerdown", event => {
    if (event.target === document.documentElement) arm(event); // Native scrollbar.
    else armed = false;
  });
  window.addEventListener("keydown", event => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.target.closest("input,textarea,select,[contenteditable]") || (event.key === " " && event.target.closest("button,a"))) { armed = false; return; }
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home", " "].includes(event.key)) arm(event, ["ArrowDown", "PageDown", "End", " "].includes(event.key));
    else armed = false;
  });
  window.addEventListener("scroll", () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const downward = scrollY > previousY;
      previousY = scrollY;
      if (armed) inspect(downward);
    });
  }, { passive: true });
  function reset() {
    armed = false;
    previousY = scrollY;
    seen = new WeakSet();
    requestAnimationFrame(() => inspect());
  }
  window.addEventListener("offline", reset);
  window.addEventListener("online", reset);
  window.addEventListener("resize", reset);
  document.addEventListener("visibilitychange", reset);
  return reset;
}
