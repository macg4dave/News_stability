# Roadmap: Cards, Magazine, and List

Updated 13 November 2026. Milestones 1?5 are implemented and locally verified.
Milestone 6 has local verification plus open installed/human release gates.
This is a reviewable build, not a claim of completed production acceptance.

## Product direction

A calm reader with exactly **Cards**, **Magazine**, and **List**. Cards is the
new-browser default. Borrow useful reading ideas from Whisper and Fluent Reader,
with original branding and an explicit [source/license review](open-source-reuse.md).
Go and native JavaScript/CSS remain the implementation. NewsBlur owns feeds,
stories, state, search, intelligence, full-text extraction and briefing generation.
See [architecture](architecture.md) for responsibility boundaries.

## 1. Visual and reuse foundation ? complete

- [x] Review pinned Whisper and Fluent Reader presentation source, screenshots,
  license texts and inherited attribution; record exact paths and reuse decisions.
- [x] Keep original layout/interaction code; retain notices for the actual
  Miniflux, Fusion, Shiori, Memos and Go/module imports.
- [x] Share spacing, typography, image ratios, focus/selection, read/saved state,
  light/dark/paper themes and clear loading/empty/error treatments.
- [x] Provide repeatable synthetic examples: pictures, text-only, long titles,
  CJK, right-to-left content, missing metadata and unavailable pictures.
- [x] Trace shared selection, actions, continuation and article-return flows;
  retain one state/action model with focused presentation modules.

Evidence: [reuse inventory](open-source-reuse.md), `npm run review:ui` gallery
and browser checks. The gallery covers desktop/phone in all layouts/themes,
with the collection and expanded article. Reference assets are not distributed.

## 2. Selector and List ? complete

- [x] Visible Cards / Magazine / List selector; validated local preference with
  usable defaults when storage is invalid or unavailable.
- [x] Keep source scope separate from layout across feed/search, saved and briefing.
- [x] Compact rows, optional 56-pixel thumbnails, consistent metadata and confirmed
  read/saved indicators. No empty picture column or nested action buttons.
- [x] Open one article immediately below its headline, moving subsequent rows down.
  Click its headline again or Close story to collapse and restore focus.
- [x] Preserve selection, query, filter, loaded stories, shortcuts and browsing
  position across layout changes and return; no layout-triggered API calls/writes.

## 3. Cards and pictures ? complete implementation

- [x] Responsive card grid, bounded excerpts, useful text-only cards and shared actions.
- [x] Adapt NewsBlur image metadata and signed replacements; fall back to sanitized
  inline pictures without publisher scraping or an arbitrary image proxy.
- [x] Allow only validated HTTPS images, preserve safe alt text, reserve space,
  lazy-load/decode and cap collection pictures at half the viewport height.
- [x] Normal browser image requests, no referrer or unnecessary CORS requirement;
  reject reader-origin image URLs and retain text when pictures fail.
- [x] Appearance ? Pictures hides images and suppresses their requests across views.

Installed-host compatibility remains a release gate. HTTP-only pictures without
secure replacements, blocked hosts and expired signed URLs may be unavailable.
External requests expose the browser IP and follow its external-site cookie policy.

## 4. Magazine and article presentation ? complete

- [x] Restrained lead and supporting stories, at most two columns, single-column
  phones, with identical upstream story order and shared authoritative state.
- [x] Date headings for contiguous day runs in Magazine/List, including batch
  boundaries. Never sort or merge noncontiguous dates. Cards retain timestamps.
- [x] Browser-local date policy using NewsBlur epoch timestamps, accessible absolute
  `<time>` metadata, Today/Yesterday labels and explicit unknown-date handling.
  Legacy dates without a timezone are not guessed. Refresh updates day labels.
- [x] Cards/Magazine hide the collection and open the article at the top of the
  reading area. Back to stories restores browsing position and selected focus.
- [x] List uses the same article panel inline, including full text and related
  coverage. Partial/one-story batches, text-only content and large text work.
- [x] Full text loads automatically from NewsBlur; feed content remains visible
  during loading/failure. Late responses cannot replace another selection.
  No local extraction, persistent article cache, or unsupported summary actions.

## 5. Reading polish and continuous scrolling ? complete locally

- [x] Shared folders, filters, saved/briefing scopes, related coverage, source links,
  appearance controls and keyboard help across all layouts.
- [x] Successful Last refreshed timestamp, retained on failure and cleared at logout;
  separate loading, no matches, end, hidden batches, offline, expiry and errors.
- [x] Load ahead within 800 pixels of the collection end. Append in upstream order,
  deduplicate hashes and retain existing rows, inline article, focus and scroll.
- [x] One batch request at a time; cancel stale scope requests. Pause automatic
  loading offline, in background tabs and while focused reading hides the collection.
- [x] Stop at NewsBlur's end; retain explicit Load more/Retry controls. After three
  hidden/duplicate-only batches, require manual continuation to prevent a loop.
- [x] Check names, focus, 44-pixel control heights, readable theme contrast,
  reduced motion, 200% text reflow and right-to-left text direction. Repair
  selected-row muted contrast and enlarged-text account-control overflow.

Refresh/sign-in restart at the first batch. Loaded stories stay in memory;
there is no DOM virtualization or offline story database. Installed large-feed
performance and human screen-reader acceptance remain milestone 6 gates.

## 6. Verify and release ? local checks complete; release gates open

- [x] Synthetic Chromium behavior coverage for layouts, storage failures, actions,
  filters, images, full text, selection/return, inline expansion, continuous loading,
  single-flight/cancellation, retry, dates, contrast, touch targets and text reflow.
- [x] Repeatable 36-image review matrix: three layouts ? three themes ? two sizes
  ? collection/article. Browser exceptions and horizontal overflow are checked.
- [x] Go formatting/vet/tests/build, Linux race tests, Python security check,
  Compose configuration and isolated proxy integration tests.
- [x] Verify generated notices, license manifest and container packaging.
- [x] Rebuild the healthy Docker preview; handle ordinary Compose stderr progress
  correctly when the PowerShell script's output is redirected for review logs.
- [ ] Verify installed NewsBlur version/endpoints using a dedicated synthetic account.
- [ ] Complete human screen-reader/keyboard and intended-browser acceptance.
- [ ] Exercise actual HTTPS/session deployment, upgrade and rollback.
- [ ] Select a first-party distribution license before public release.

Use [release acceptance](acceptance.md) to record evidence and [open gates](blockers.md)
for the missing inputs and unblocking actions. No routine test accesses real
NewsBlur account data. Local implementation is not blocked by these release gates.

## Copying and follow-on work

Actual imports require pinned source/local-path mappings, copyright and modification
notices, complete license/NOTICE texts, compatibility review and any required
corresponding source. Update the explicit notices generator inventory, public
bundle and manifest, then verify distribution packaging. The
[reuse review](open-source-reuse.md) records Whisper GPL-3.0-or-later and Fluent
Reader BSD-3-Clause requirements. No source/assets from either were copied.

After release, consider per-feed layouts, density controls and presentation of
verified NewsBlur intelligence explanations. Bulk catch-up needs verified write
semantics, explicit scope, confirmation and genuine undo. Mosaic, local ranking,
feed fetching, regex search, automatic mark-on-scroll, offline article caching
and local briefing generation are outside this three-view release.
