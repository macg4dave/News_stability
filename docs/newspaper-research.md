# Newspaper composition research

Reviewed 13 November 2026 using the public repositories and their actual licence
files, rather than relying only on GitHub's detected licence label.

## Inspected projects

| Project and pinned revision | Files inspected | Licence evidence | Useful idea and decision |
| --- | --- | --- | --- |
| [FT Labs Columnflow](https://github.com/ftlabs/ftcolumnflow/tree/f138232683162f8c9773d2ca36bd0c15f6202f08) | `README.md`, `src/FTColumnflow.js`, `LICENCE.txt` | MIT; Copyright (C) 2012 The Financial Times Ltd. | Column measures, baseline rhythm, spanning photographs, keep-with-next, and reflow after type/width changes. Use those composition principles with native CSS; do not import the archived engine's cloned/overflow-hidden paragraphs or dynamic inline styles. |
| [Treesaver](https://github.com/Treesaver/treesaver/tree/2d5e8ee0c03a869f3e32a7c1e812379088de4adb) | `README.md`, `src/layout/grid.js`, `MIT-LICENSE.txt` | README explicitly offers MIT or GPLv2; the MIT licence names Filipe Fortes (2011). GitHub's GPL-only metadata does not describe that choice fully. | Fit content to a small family of templates and account for the amount of type and picture space. Write a reader-specific composer; no Closure runtime, page engine, or source is imported. |
| [Adobe BalanceText](https://github.com/adobe/balance-text/tree/0f0826f7a9933cdb478cacea99196e4b874bfd0d) | `README.md`, `balancetext.js`, `LICENSE` | Apache-2.0 for Adobe's code; the source also contains a separate MIT notice for its debounce helper. | Avoid a long headline line followed by a stranded word. Use native `text-wrap: balance`, not the polyfill or its DOM/text rewriting. Neither source component is imported. |
| [Tufte CSS](https://github.com/edwardtufte/tufte-css/tree/b5d7b7bbe5ce9c4c50fcfad4f19ee3646cfd7ae1) | `README.md`, typography/figure sections of `tufte.css`, `LICENSE` | MIT; Copyright (c) 2014 Dave Liepmann. | Comfortable line measure, restrained typography, and graphics integrated with reading. No CSS or ET Book font files are copied; retain the reader's local Georgia/system fonts. |
| [Ghost Source](https://github.com/TryGhost/Source/tree/7c678147b624ff6a5a902951e65318c7f4f13eaa) | `README.md`, `partials/post-card.hbs`, `LICENSE` | MIT; Copyright (c) 2013-2026 Ghost Foundation. | Separate source/topic, title, introduction and byline; use source-provided pictures and excerpts. No Handlebars, CSS, fonts, icons or Ghost assets are imported. |

## Implemented composition

`web/newspaper.js` owns presentation templates, while `web/newspaper.css` owns
their type, columns, figures and spacing. The implementation is original native
JavaScript/CSS. The reviewed source was used to understand design choices, not
translated or copied into the app. No new library or font dependency is added.
The existing adapted Shiori/Memos portions retain their notices and licence files.

- Consecutive stories form groups of at most three, stopping at publication-day
  boundaries. Source order and DOM order remain unchanged. There is no semantic
  ranking, invented importance label, or inferred relationship between neighbours.
- A landscape-led group places its lead across two text measures, next to two
  shorter introductions. A portrait lead keeps a narrow photograph column and
  gives its neighbours more room for text. A photograph in the second story can
  sit beside the opening text, without moving that story ahead of it.
- Text-only groups use occupied-line estimates from the actual system typeface
  and current width to choose a substantial lead or ordinary columns. Two-story
  and one-story endings get explicit templates. This estimates typographic fit;
  it does not understand topics or provide AI art direction.
- The server supplies up to 1200 Unicode characters of sanitized plain text,
  preferring a word ending near the bound. Introductions can flow through native
  columns beneath a photograph. Side introductions remain shorter; full articles
  open through the existing action model. No new HTML insertion point is added.
- Headlines use balanced line wrapping. Copy uses native paragraph wrapping and
  hyphenation. Native columns avoid splitting headings from the following text;
  paragraph widows/orphans are specified where the browser supports them.
- Photographs retain their natural proportions, including portraits. Missing and
  hidden photographs cause a text composition. Image decoding and layout changes
  never mark stories read. A visible story anchors reflow during reading.
- Fetched groups are sealed: appending a batch does not regroup existing nodes.
  Resizing, fonts becoming ready and picture availability can recompose the
  existing groups. Narrow windows fall back to a single reading column.

## Editorial refinement

The follow-up adds sentence-aware introductions using the browser's native
`Intl.Segmenter`, with a word-boundary fallback. Magazine keeps the full supplied
introduction separately and restores it when returning to Cards. Supporting copy
uses a smaller budget when the neighbouring column also contains a photograph;
lead and supporting photo heights are restrained to reduce unequal group heights.
This remains a bounded typographic heuristic, not exact page fitting.

Consecutive short text items use a compact "In brief" band, keeping source order
and publication-day boundaries. Lead, supporting and brief headlines have distinct
sizes. No item is promoted based on inferred editorial importance.

Decoded images below 100 pixels wide or 80 pixels tall try the remaining bounded
NewsBlur candidates outside List. A remaining small image gets a modest frame in
Magazine and does not select a photo-led template. Size cannot reliably identify
a large logo; no semantic image recognition or publisher fetching is introduced.

Opened articles have a ruled byline, introductory paragraph and quotation
treatments. The subsequent full-width update removes headline/body width caps
so the article uses the available space beside the feed sidebar.
User-selected body font and size remain effective. The sanitizer now preserves
`figure` and `figcaption` without active attributes, so captions and credits
already present in NewsBlur article HTML retain their context. No credit or
caption is invented, and collection images do not gain metadata absent upstream.

## Licence handling

These new references are design research, not bundled components. Their actual
licence texts were checked, but are not presented as licences for this project's
original source. If source or assets are imported later, pin the exact files,
retain all applicable copyright and licence notices (including embedded notices),
record modifications, and update the shipped notice bundle before distribution.
Do not assume a repository's main licence covers separately licensed fonts,
photos, fixtures, or embedded helpers.

The application's existing attribution inventory is
[Third-party notices](../THIRD_PARTY_NOTICES.md). Neither this research nor a
permissive reference project selects a licence for the rest of News Stability.
