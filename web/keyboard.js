// SPDX-FileCopyrightText: Copyright The Miniflux Authors. All rights reserved.
// SPDX-FileCopyrightText: Copyright (c) 2024 Rook1e
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// Adapted from Miniflux's internal/ui/static/js/keyboard_handler.js at
// fb043227ef6ad98569c848e8cdade0d237dab87e and Fusion's isTypingTarget in
// frontend/src/hooks/use-keyboard.ts at c31ade09b481fa877633899e8cf5d4c86a72c4f9.
// Modified for News Stability: ES module, listener composition, timed prefixes,
// explicit enablement, composition/dialog/selection guards, and handled-key-only
// prevention. See THIRD_PARTY_NOTICES.md and the license copies in /licenses/.

export class KeyboardHandler {
  constructor(enabled = () => true) {
    this.enabled = enabled;
    this.queue = [];
    this.lastKeyAt = 0;
    this.shortcuts = new Map();
    this.triggers = new Set();
  }

  on(combination, callback) {
    const keys = combination.split(" ");
    this.shortcuts.set(combination, { keys, callback });
    this.triggers.add(keys[0]);
  }

  listen() {
    document.addEventListener("keydown", (event) => {
      if (this.isEventIgnored(event) || KeyboardHandler.isModifierKeyDown(event)) {
        this.queue = [];
        return;
      }
      if (event.timeStamp - this.lastKeyAt > 1200) this.queue = [];
      this.lastKeyAt = event.timeStamp;
      const key = KeyboardHandler.getKey(event);
      this.queue.push(key);

      for (const { keys, callback } of this.shortcuts.values()) {
        if (keys.length === this.queue.length && keys.every((value, index) => value === this.queue[index])) {
          this.queue = [];
          event.preventDefault();
          callback(event);
          return;
        }
      }
      const prefix = [...this.shortcuts.values()].some(({ keys }) =>
        this.queue.length < keys.length && this.queue.every((value, index) => value === keys[index]));
      if (prefix) {
        event.preventDefault();
        return;
      }
      // An unmatched prefix must not consume an unrelated browser key. The
      // current key may start a new command, including a single-key command.
      this.queue = [];
      if (!this.triggers.has(key)) return;
      const single = this.shortcuts.get(key);
      if (single) {
        event.preventDefault();
        single.callback(event);
      } else {
        this.queue = [key];
        event.preventDefault();
      }
    });
    window.addEventListener("blur", () => { this.queue = []; });
  }

  isEventIgnored(event) {
    return !this.enabled() || event.defaultPrevented || event.isComposing || event.repeat ||
      document.querySelector("dialog[open]") !== null ||
      !window.getSelection()?.isCollapsed || KeyboardHandler.isTypingTarget(event.target);
  }

  static isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tagName = target.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
    return target.closest("[contenteditable='true'], [data-hotkey-ignore='true']") !== null;
  }

  static isModifierKeyDown(event) {
    return event.getModifierState("Control") || event.getModifierState("Alt") || event.getModifierState("Meta");
  }

  static getKey(event) {
    switch (event.key) {
      case "Esc": return "Escape";
      case "Up": return "ArrowUp";
      case "Down": return "ArrowDown";
      case "Left": return "ArrowLeft";
      case "Right": return "ArrowRight";
      default: return event.key;
    }
  }
}
