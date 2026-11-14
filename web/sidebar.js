// Original reader presentation. Only display preferences are persisted.
const storageKey = "news-stability-sidebar-width-v1";

export function initializeSidebar(handle, beforeReflow) {
  const root = document.documentElement;
  const sidebar = document.getElementById("feed-sidebar");
  const minimum = 208;
  let preferred = null;
  let drag = null;
  const toggle = document.getElementById("sidebar-toggle");
  let collapsed = false;
  try { collapsed = localStorage.getItem("news-stability-sidebar-collapsed-v1") === "true"; } catch { /* Tab-local state remains usable. */ }

  function applyCollapsed() {
    beforeReflow();
    root.classList.toggle("sidebar-collapsed", collapsed);
    sidebar.hidden = collapsed;
    handle.hidden = collapsed;
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    toggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  }
  toggle.addEventListener("click", () => {
    collapsed = !collapsed;
    applyCollapsed();
    try { localStorage.setItem("news-stability-sidebar-collapsed-v1", String(collapsed)); } catch { /* Keep this tab usable. */ }
  });
  applyCollapsed();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (typeof saved === "number" && Number.isFinite(saved) && saved >= minimum && saved <= 480) preferred = saved;
  } catch { /* Disabled or invalid storage leaves the fluid default. */ }

  const maximum = () => Math.max(minimum, Math.min(480, Math.floor(innerWidth * .4)));
  const bounded = width => Math.round(Math.max(minimum, Math.min(maximum(), width)));

  function describe() {
    const width = sidebar.getBoundingClientRect().width;
    handle.setAttribute("aria-valuemin", String(minimum));
    handle.setAttribute("aria-valuemax", String(maximum()));
    if (width) {
      handle.setAttribute("aria-valuenow", String(Math.round(width)));
      handle.setAttribute("aria-valuetext", `${Math.round(width)} pixels`);
    }
  }

  function apply() {
    beforeReflow();
    if (preferred === null) root.style.removeProperty("--sidebar-size");
    else root.style.setProperty("--sidebar-size", `${bounded(preferred)}px`);
    describe();
  }

  function save() {
    try {
      if (preferred === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(preferred));
    } catch { /* Resizing still works for this page. */ }
  }

  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    handle.focus({ preventScroll:true });
    drag = { id:event.pointerId, x:event.clientX, width:sidebar.getBoundingClientRect().width, previous:preferred };
    handle.setPointerCapture(event.pointerId);
    root.classList.add("sidebar-resizing");
    beforeReflow();
  });
  handle.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    preferred = bounded(drag.width + event.clientX - drag.x);
    apply();
  });
  function finish(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (event.type === "pointercancel") { preferred = drag.previous; apply(); }
    else save();
    drag = null;
    root.classList.remove("sidebar-resizing");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  }
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("lostpointercapture", finish);
  handle.addEventListener("dblclick", () => { preferred = null; apply(); save(); });
  handle.addEventListener("keydown", event => {
    let width = sidebar.getBoundingClientRect().width;
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowLeft") width -= step;
    else if (event.key === "ArrowRight") width += step;
    else if (event.key === "Home") width = minimum;
    else if (event.key === "End") width = maximum();
    else return;
    event.preventDefault();
    preferred = bounded(width);
    apply();
    save();
  });
  window.addEventListener("resize", apply);
  new ResizeObserver(describe).observe(sidebar);
  // Reader initialization runs after the scroll/read controllers are ready.
  apply();
}
