# Roadmap: Cards, Magazine, and List

Updated 13 November 2026. This replaces the previous milestone roadmap.
All work below is planned unless explicitly described as existing behavior.

## Implementation progress

The first implementation slice delivers the visible Cards / Magazine / List
selector, Cards as the default, allowlisted browser-local preference storage,
and three responsive text-first treatments. Magazine emphasizes the first
returned story without changing order; List uses compact rows. Switching uses
the same story DOM nodes and preserves selection, handlers, filters, pagination,
and a visible story scroll anchor without making API calls. Read and saved
indicators continue to reflect confirmed NewsBlur state.

Verification of the foundation: all 13 synthetic Chromium browser tests passed, including three new
tests for layout context/request preservation, preference persistence and invalid
or unavailable storage, and narrow screens with long titles. Desktop synthetic
screenshots of all three treatments were visually reviewed. No reference-project
source or assets were copied; this slice adds original implementation code.

The next slice adds a shared server-generated plain-text excerpt, bounded to 240
Unicode characters and derived only from sanitized content. Cards and Magazine
show bounded previews; List remains compact. A Back to stories button restores
focus and scrolls to the originating story after reading linked coverage, even
if the layout changes. Pagination clears obsolete return targets.

Verification of this slice: Go formatting, vet, tests, and build pass; all 15
synthetic Chromium tests pass. New coverage checks sanitized excerpt output,
Unicode boundaries, inert markup-like preview text, compact List behavior, and
mobile return to the originating story after related coverage and layout changes.
No additional upstream code or assets were copied.

Milestone 2's selector/List foundation is delivered. Milestones 1, 3, and 4 remain
partial or planned: exact upstream code-candidate review, safe image
presentation, date grouping, further article-return polish, and full theme/mobile
visual and accessibility acceptance still need work. Existing installed-server
release gates remain open. This is not the completed three-view release.

## Product direction

Make News Stability a calm, fast web reader with exactly three story layouts:
**Cards**, **Magazine**, and **List**. Borrow the best reading interactions from
[Whisper](https://github.com/Nyancat-Labs/whisper_feed) and
[Fluent Reader](https://github.com/yang991178/fluent-reader), and adapt useful
code where its license and architecture fit. Aim for their quality of reading
experience while giving News Stability its own visual identity.

Go remains the server language. Keep native JavaScript modules and CSS unless
a demonstrated requirement justifies changing that choice. NewsBlur at the
configured origin (currently `https://news101.lan`) continues to own feeds,
stories, read/saved state, intelligence, search, full text, and Daily Briefing
generation. This roadmap adds presentation and thin adapters to those services.

## Starting point

The repository already contains login/logout, server-side sessions, nested feed
navigation, pagination, sanitized articles, explicit read/unread and save/unsave,
saved reading, feed search/unread filtering, themes/fonts, keyboard navigation,
related-story links, and presentation of NewsBlur Daily Briefing output.
The initial story renderer was a title/metadata list. The three-layout selector,
text-first card/magazine composition, excerpts, and article return are now
implemented as described above; card imagery remains new work.

Existing synthetic Go, browser, and proxy tests provide a foundation. This
documentation change does not rerun or certify those suites. Installed-account
acceptance, human accessibility review, intended-browser checks, and the final
HTTPS/upgrade/rollback exercise remain open. Earlier user confirmation that
installed briefing generation works does not establish a generation-progress
API contract or the installed NewsBlur version.

## The three views

| View | Reading experience | Required behavior |
| --- | --- | --- |
| Cards | Comfortable image-led browsing with consistent cards, headline, short excerpt, source, age, and read/saved indicators. | Responsive grid on wide screens; single column on phones; stable image space; equally useful text-only cards. |
| Magazine | Editorial rhythm with a larger lead story and smaller supporting stories, generous typography, and restrained imagery. | Lead spans at most two columns; DOM, visual, and keyboard order agree; narrow screens become a readable single column. |
| List | Dense scanning with compact headline rows, source, age, and read/saved indicators. | Images optional and off by default; long titles remain accessible; controls work with keyboard, touch, and pointer. |

Cards is the default for a new browser. A visible, accessible selector offers
Cards / Magazine / List and remembers the choice as a local appearance setting.
The same choice applies to feed results, search results, saved stories, and
briefing source stories. Briefing summaries retain an appropriate summary
presentation and do not acquire unsupported story actions.

Switching layout preserves the selected story, feed, query, filter, loaded page,
and a meaningful scroll/focus anchor. It does not fetch a new story set, reorder
stories, or mark anything read. Initially Magazine emphasizes the first story
in NewsBlur's returned order; visual prominence makes no claim of importance.

## Reference ideas and reuse candidates

These are design selections based on the upstream READMEs and license files
reviewed on 13 November 2026, not claims that code has already been imported.
Inspect exact implementation files and pin their commit before adapting code.

| Reference | Bring into the reader | Adaptation boundary |
| --- | --- | --- |
| Whisper | Cards/Magazine/List, concise source/category/age metadata, responsive columns, restrained lead-story sizing, and a feed beside the open article on large screens. | Use NewsBlur-provided metadata; keep chronological/upstream order; implement browser layouts without importing Android UI or persistence. |
| Whisper | Today/Yesterday grouping, visible last-refresh state, clear read/saved treatment, and understandable related coverage. | Group dates without changing upstream order; distinguish refresh time from publication time; use NewsBlur clusters rather than inventing local topic detection. |
| Fluent Reader | Clear folder navigation, read-status filtering, efficient keyboard reading, theme consistency, and an integrated article pane. | Extend existing native modules and NewsBlur adapters; inspect reusable helpers without adopting Electron, React, Redux, or its local database. |
| Both, plus reader improvements | Consistent return-to-story behavior, readable text-only stories, visible failures, reduced motion, and a distraction-free article mode. | Keep one story/action model across all layouts and retain context on failed reads or writes. |

Do not add Mosaic as a fourth layout. Feed discovery/import, scraping, full-text
extraction, local personalization/ranking, regex automation, background feed
fetching, weather, launcher integration, and a second synchronization engine are
outside this reader roadmap. Saved stories remain NewsBlur saves; they do not
promise offline downloads. Search retains NewsBlur semantics, without claiming
Fluent Reader's regex search or Whisper's offline search.

## Delivery sequence

### 1. Establish the visual and reuse foundation

- Inspect the reference screenshots and relevant layout/navigation source files;
  record exact commits, candidate files, licenses, and the reason to reuse each.
- Define shared spacing, typography, image ratios, focus, selection, read/saved,
  light/dark/paper, and loading/empty/error treatments using existing theme tokens.
- Produce representative Cards, Magazine, and List examples with synthetic
  image-rich, text-only, long-title, multilingual, and missing-metadata stories.
- Trace the existing story-selection, pagination, actions, and article-return
  flows before deciding module boundaries. Keep shared state and actions in one
  place; extract presentation responsibilities only where needed.

Exit: reviewable examples cover desktop and phone sizes; the source inventory
distinguishes design inspiration from actual copying and resolves licensing for
each proposed import. Existing reader behavior has a recorded baseline.

### 2. Deliver the selector and complete List view

- Add the three-choice layout control and allowlisted local preference, including
  a usable fallback when storage is unavailable or contains an invalid value.
- Separate content scope (feed/saved/briefing) from presentation layout in state.
- Complete the compact List treatment and shared story metadata/actions.
- Preserve selection, pagination, search/filter state, keyboard behavior, and
  scroll/focus anchors through layout changes and article return.

Exit: selector behavior and List work across supported content scopes; changing
layout causes no NewsBlur write, extra page load, or loss of reading context.

### 3. Deliver Cards

- Add responsive card grids, bounded excerpts, metadata, and read/saved controls
  that do not conflict with opening the article or create nested buttons.
- Establish a safe presentation contract for excerpts and optional thumbnails.
  The current story decoder has no dedicated thumbnail field: verify NewsBlur's
  actual response before extending it. Derive only from available sanitized
  content if appropriate; never fetch publisher pages to fill gaps.
- Validate image URLs, reserve dimensions, lazy-load offscreen images, avoid
  credential/referrer leakage, and provide missing/broken-image fallbacks. Review
  external-image privacy and the existing content policy before enabling them;
  do not introduce an unrestricted image proxy.

Exit: image-rich and image-free feeds remain useful; broken/slow images do not
  obstruct reading; hostile HTML/URLs cannot bypass existing protections.

### 4. Deliver Magazine

- Compose a restrained lead story and supporting stories from the same ordered
  collection used by Cards and List. Avoid masonry that scrambles reading order.
- Add date headings where compatible with server ordering and pagination, using
  a defined browser-local date policy and accessible absolute timestamps.
- Keep article and story collection alongside each other where space permits;
  provide a clear return path and preserved position on small screens.
- Preserve text-only composition, large-text layouts, and all story actions.

Exit: all three views display the same story identities/order and authoritative
state; Magazine works on partial pages, one-story pages, and narrow screens.

### 5. Polish the reading experience

- Make existing folders, search, unread filters, saved stories, briefing sources,
  and related coverage consistent across the three views.
- Add distraction-free article reading, clear source links, and reliable return
  to the originating story. Retain existing appearance controls and shortcut help.
- Distinguish loading, no matches, end of feed, hidden-page continuation, expired
  sessions, offline state, unavailable briefing, and upstream failure.
- Audit focus visibility, accessible names, contrast, touch targets, reduced
  motion, zoom, screen-reader reading order, and keyboard-only navigation.

Exit: readers can browse, open, save, mark read/unread, and return in every view
without losing context; failures preserve context and never report false success.

### 6. Verify and release

- Extend synthetic browser smoke coverage for layout switching/persistence,
  selection/focus restoration, responsive behavior, action consistency, missing
  images, and hostile content. Use behavior assertions rather than tests of CSS
  implementation details; visually review all three views in each theme.
- Run Go checks for any adapter changes, browser checks for UI changes, and
  proxy/container checks when those boundaries change, following
  [testing rules](ai/testing.md). Do not access real user data for routine tests.
- Verify installed NewsBlur version and required endpoints with a dedicated
  account and synthetic content. Complete human accessibility, intended-browser,
  HTTPS/session, upgrade, and rollback acceptance before claiming release readiness.
- Verify complete attribution in source, the public notices page, container
  images, and downloadable distributions. Publish corresponding source wherever
  required by any adopted license.

Exit: all three views meet their acceptance criteria, applicable checks pass,
license obligations are fulfilled, and remaining limitations are documented.

## Copying code, assets, and licenses

Reuse is welcome, including adapted code, but adding a license file alone is
not sufficient. No code or assets from these two projects are copied by this
roadmap change; existing third-party notices remain applicable and unchanged.

**Fluent Reader:** its [LICENSE](https://github.com/yang991178/fluent-reader/blob/master/LICENSE)
is BSD-3-Clause, copyright (c) 2020 Haoyuan Liu. When copying, preserve copyright,
all three conditions, and the disclaimer in source; reproduce them with binary
distributions; do not imply endorsement. Check each selected file and dependency
for separately licensed material. Port small useful pieces to our native
frontend where practical, with source mapping and a description of modifications.

**Whisper:** its [README](https://github.com/Nyancat-Labs/whisper_feed#licence-and-attribution)
declares GPL-3.0-or-later and supplies the full
[GPLv3 text](https://github.com/Nyancat-Labs/whisper_feed/blob/main/LICENSE).
Its [attribution](https://github.com/Nyancat-Labs/whisper_feed/blob/main/ATTRIBUTION.md)
also identifies inherited work from Neo Feed, HomeFeeder, and other contributors.
If adapting protected code, including a translation from Kotlin into JavaScript,
determine the scope of the resulting derivative/combined work and compatibility
with existing licenses before merging it. Meet GPL requirements for the covered
work: retain notices, identify modifications and dates, supply the license,
provide required legal notices, and make complete corresponding source and
build/install material available through an applicable distribution mechanism.
Browser-delivered code is itself distributed; server hosting does not remove
obligations for code sent to browsers. Do not assume a separate file/module
avoids copyleft. If that licensing scope is unsuitable, implement the interaction
independently from the behavior reference or obtain alternative permission.

For every actual import:

1. Record upstream URL, full commit, exact source paths, local destinations,
   copyright holders, license/SPDX identifier, inherited notices, and changes.
2. Inspect file-specific licenses and NOTICE files, dependencies, fonts, icons,
   translations, and artwork separately. Do not assume the repository license
   grants trademark rights or covers every bundled asset. Use original branding
   and synthetic story imagery unless asset permissions are established.
3. Copy required license/NOTICE texts verbatim into `licenses/`; preserve source
   headers and add clear attribution/modification notices to adapted files.
4. Update [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), the license manifest,
   and `scripts/update_notices.py` inventory for new imports. Regenerate the
   public bundle with `python scripts/update_notices.py`, then run
   `python scripts/update_notices.py --check` and inspect distribution packaging.
   The current generator has an explicit adapted-source inventory, so adding
   an unlisted license file alone does not publish it.
5. Verify license compatibility, source availability, required notices, and
   packaging before the import is considered complete. Keep existing MIT,
   Apache-2.0, BSD, and patent notices; do not replace them with a blanket credit.

## Dependencies and follow-on ideas

| Open dependency | Impact | Unblocking action |
| --- | --- | --- |
| Exact upstream code candidates and commits not selected | Design references are usable; code imports are not yet ready. | Inspect relevant files during milestone 1 and complete the reuse inventory. |
| Whisper derivative-work licensing scope unresolved | Copying protected Whisper implementation cannot be treated as attribution-only. | Establish compatible GPL distribution/source handling, obtain alternative permission, or implement the interaction independently. |
| Images currently removed by `internal/article/sanitize.go` and blocked by `img-src 'none'` in the Nginx policy; installed thumbnail and intelligence contracts unverified | Text-first layouts and excerpts work; imagery and importance explanations remain pending. | Verify the installed image contract, define privacy/credential-safe delivery, and update sanitizer/CSP boundaries with appropriate security and proxy checks before enabling images. No local ranking substitute. |
| Installed release acceptance and human accessibility checks open | Three-view implementation alone will not establish release readiness. | Complete milestone 6 with recorded evidence. |

After the three-view release, consider per-feed layout preferences, density
controls, and presentation of NewsBlur-provided intelligence explanations.
Evaluate bulk catch-up only against verified NewsBlur write semantics, explicit
scope, confirmation, and genuine undo support. Automatic mark-on-scroll, offline
article caching, and inferred ranking are deferred; they are not prerequisites
for these views. Daily Briefing remains a presentation of NewsBlur output, with
no invented generation-progress state.
