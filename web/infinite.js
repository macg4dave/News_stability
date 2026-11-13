// Keep network/state ownership in the reader; this module only signals when
// the collection's end is near the viewport. Hidden focused reading is ignored.
export function initializeInfiniteScroll(sentinel, load) {
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (document.hidden || !navigator.onLine || !sentinel.getClientRects().length) return;
      const box = sentinel.getBoundingClientRect();
      if (box.top < innerHeight + 800 && box.bottom > -800) load();
    });
  }
  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(schedule, { rootMargin: "800px 0px" });
    observer.observe(sentinel);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("online", schedule);
  document.addEventListener("visibilitychange", schedule);
  return schedule;
}
