// SPDX-FileCopyrightText: Copyright (c) 2018-present Radhi Fadlillah
// SPDX-License-Identifier: MIT
// Adapted from Shiori webapp/src/composables/useTheme.ts at
// aebb4021a56048eed4c8feb325399be5f46e5470.
// Modified for News Stability: plain JavaScript, data attributes only, paper
// palette, font/size controls, validated local appearance preferences, and no
// Vue, account synchronization, favicon updates, or assumed contrast validation.
// Full notice: /third-party-notices.txt and licenses/Shiori-MIT.txt.

const choices = {
  theme: ["system", "light", "dark", "paper"],
  font: ["serif", "sans"],
  size: ["normal", "large", "larger"],
};
const defaults = { theme: "system", font: "serif", size: "normal" };
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
  } catch { /* Storage may be disabled; defaults remain fully usable. */ }

  function apply() {
    const root = document.documentElement;
    if (current.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", current.theme);
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
  // CSS media queries handle system-theme changes without another global listener.
  apply();
}
