// SPDX-FileCopyrightText: Copyright (c) 2018-present Radhi Fadlillah
// SPDX-License-Identifier: MIT
// Adapted from Shiori webapp/src/composables/useTheme.ts at
// aebb4021a56048eed4c8feb325399be5f46e5470.
// Modified for News Stability: plain JavaScript, data attributes only, a fixed
// paper palette, font/size controls, validated local preferences, and no
// Vue, account synchronization, favicon updates, or assumed contrast validation.
// Full notice: /third-party-notices.txt and licenses/Shiori-MIT.txt.

const choices = {
  font: ["serif", "sans"],
  size: ["normal", "large", "larger"],
};
const defaults = { font: "serif", size: "normal" };
const storageKey = "news-stability-appearance-v1";

// Only these allowlisted display preferences are persisted. Account data,
// credentials, session tokens, and article content never enter browser storage.
export function initializeAppearance() {
  let current = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    for (const name of Object.keys(choices)) {
      if (choices[name].includes(saved?.[name])) current[name] = saved[name];
    }
    // Migrate old theme choices while retaining typography preferences.
    if (saved && Object.hasOwn(saved, "theme")) localStorage.setItem(storageKey, JSON.stringify(current));
  } catch { /* Storage may be disabled; defaults remain fully usable. */ }

  function apply() {
    const root = document.documentElement;
    root.setAttribute("data-theme", "paper");
    root.setAttribute("data-reading-font", current.font);
    root.setAttribute("data-reading-size", current.size);
  }

  for (const name of Object.keys(choices)) {
    const control = document.getElementById(`appearance-${name}`);
    control.value = current[name];
    control.addEventListener("change", () => {
      if (!choices[name].includes(control.value)) return;
      current[name] = control.value;
      apply();
      try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* Keep the selection for this tab. */ }
    });
  }
  apply();
}
