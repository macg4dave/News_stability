# Archived appearance variants

`appearance-themes.css` preserves the reader's original light, dark and
system-preference palettes. It is outside `web/`, is not loaded, and is not part
of the current visual-review or colour-contrast matrix.

Warm paper is the sole active palette during development. Older stored theme
choices are removed while font and text-size choices are retained. The HTML and
CSS also use Warm paper before JavaScript runs and under system dark mode.

Restoring theme choice later requires an explicit product decision, moving the
desired palette back into active CSS, restoring the appearance preference/control
flow, and reinstating contrast, migration and visual-review cases. Keep the
existing Memos paper-palette and Shiori preference-handling attributions intact.
Cards, Magazine and List remain active reading layouts; they are not colour themes.
