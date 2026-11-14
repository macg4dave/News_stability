# Third-party notices

News Stability includes the following third-party code. These notices apply to
the identified portions and do not choose a license for the rest of this project.
No project names or authors are used to imply endorsement.

## Design references

The three-layout reading experience uses Whisper and Fluent Reader as behavior
references. No code, translated source, artwork, fonts, icons or branding from
these projects is included. The implementation is original native JavaScript/CSS.

- Whisper: https://github.com/Nyancat-Labs/whisper_feed at
  `2fadadd28524012d055b406b6f38c8f2720b694a` (inspected source: GPL-3.0-or-later).
- Fluent Reader: https://github.com/yang991178/fluent-reader at
  `5912070309759eff37204a5046caba3c780fa4c0` (inspected source: BSD-3-Clause).

The inspected revisions are pinned above. Newspaper composition research and
future-import decisions are recorded in `docs/newspaper-research.md`.
The references' licenses do not replace
the licenses of the actual incorporated components listed below.

Newspaper composition also uses FT Labs Columnflow, Treesaver, Adobe BalanceText,
Tufte CSS, and Ghost Source as design references. Their source and actual licence
files were inspected; no code, translated source, fonts, photographs, icons or
branding from them is distributed here. The composer and native CSS are original.
Exact revisions, inspected files, licence findings and implementation decisions
are recorded in [the newspaper research](docs/newspaper-research.md).

## Adapted source

### Miniflux — Apache License 2.0

Copyright The Miniflux Authors. All rights reserved.

Source repository: https://github.com/miniflux/v2

Pinned revision: `fb043227ef6ad98569c848e8cdade0d237dab87e`

- `internal/reader/readingtime/readingtime.go` adapted into
  `internal/article/readingtime.go`. Changes: local HTML tokenization, fixed reading
  speeds, reader-specific API, and corrected 100-letter CJK sample boundary.
- `internal/ui/static/js/keyboard_handler.js` adapted into `web/keyboard.js`.
  Changes: module export, additive event listeners, enablement callback, timed
  prefixes, editing/dialog/composition/selection guards, and default prevention
  restricted to registered commands and prefixes.

Full license: [licenses/Miniflux-Apache-2.0.txt](licenses/Miniflux-Apache-2.0.txt).
The inspected upstream tree contains no NOTICE file. This project records its
own attribution here and retains copyright/SPDX and modification notices in
the adapted files. No Miniflux backend, database, feed fetcher, or scraper is used.

### Fusion — MIT License

Copyright (c) 2024 Rook1e

Source repository: https://github.com/0x2E/fusion

Pinned revision: `c31ade09b481fa877633899e8cf5d4c86a72c4f9`

The `isTypingTarget` helper in `frontend/src/hooks/use-keyboard.ts` is adapted
into `KeyboardHandler.isTypingTarget` in `web/keyboard.js`. Changes: plain
JavaScript and static class method, without React or Fusion's state/router code.
The combined module retains attribution to both projects and ships both licenses.

Full license: [licenses/Fusion-MIT.txt](licenses/Fusion-MIT.txt).

### Shiori — MIT License

Copyright (c) 2018-present Radhi Fadlillah

Source repository: https://github.com/go-shiori/shiori

Pinned revision: `aebb4021a56048eed4c8feb325399be5f46e5470`

Theme application and preference handling in `webapp/src/composables/useTheme.ts`
are adapted into `web/appearance.js`. Changes: plain JavaScript, allowlisted
local-only appearance settings, a fixed paper theme, font/size controls, and
migration of old theme preferences. Vue, account synchronization, favicon behavior, and the upstream
placeholder contrast-validation function are not included.

Full license: [licenses/Shiori-MIT.txt](licenses/Shiori-MIT.txt).

### Memos — MIT License

Copyright (c) 2025 Memos

Source repository: https://github.com/usememos/memos

Pinned revision: `30f8bad87d586228381c54beea686162cd8c5265`

- A subset of `web/src/themes/paper.css` colors maps to the reader's CSS variables
  in `web/themes.css`; typography settings are local. The local light/dark/system
  variants are archived outside the served website while paper is the only active palette.
- `getRelationBuckets` in `web/src/components/MemoMetadata/Relation/relationHelpers.ts`
  is adapted into `web/relations.js`, using story hashes and explicit hyperlink
  edges on the loaded page. Memo types, React, persistence, and backend code are
  not included. Page-link construction and the NewsBlur adapters are local code.

Full license: [licenses/Memos-MIT.txt](licenses/Memos-MIT.txt).

## Go dependencies

| Module | Version | License | Copyright notice source |
| --- | --- | --- | --- |
| github.com/microcosm-cc/bluemonday | v1.0.27 | BSD-3-Clause | Module LICENSE.md |
| github.com/aymerick/douceur | v0.2.0 | MIT | Module LICENSE |
| github.com/gorilla/css | v1.0.1 | BSD-3-Clause | Module LICENSE |
| golang.org/x/net | v0.62.0 | BSD-3-Clause plus patent grant | Module LICENSE and PATENTS |
| golang.org/x/crypto | v0.58.0 | BSD-3-Clause plus patent grant | Module LICENSE and PATENTS |
| golang.org/x/sys | v0.49.0 | BSD-3-Clause plus patent grant | Module LICENSE and PATENTS |
| golang.org/x/term | v0.47.0 | BSD-3-Clause plus patent grant | Module LICENSE and PATENTS |
| golang.org/x/text | v0.43.0 | BSD-3-Clause plus patent grant | Module LICENSE and PATENTS |
| Go standard library | Build toolchain | BSD-3-Clause plus patent grant | Toolchain LICENSE and PATENTS |

The inventory conservatively includes the complete Go module graph; not every
module in that graph is linked into the current binary. The full copyright
notices, conditions, disclaimers, and patent grants are copied
without editing into `licenses/`. `licenses/manifest.json` records the source
files and SHA-256 digests. The module versions are pinned by `go.mod`/`go.sum`.

## Distribution

Keep this document, the adapted source headers, and the full `licenses/` directory
with source and binary distributions. The reader container includes these files
under `/usr/share/licenses/news-stability/`. The web image serves the combined
full notices at `/third-party-notices.txt`, linked from the reader footer.

Run `python scripts/update_notices.py` after module or notice changes and review
any new license terms. `python scripts/update_notices.py --check` checks that the
copies and public notice bundle match the current source/module inventory.
The generator does not decide license compatibility or fetch unrelated projects.

The newspaper references are documented in
[the research review](docs/newspaper-research.md). Their code is not distributed here.
Container base images retain their own upstream notices; this inventory covers
the application source and Go dependencies, not a replacement audit of OS packages.
