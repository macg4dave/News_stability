# Reader look and feel

Updated 14 November 2026.

## Bottom-of-story return - implemented

Opened stories have a Back to previous page control after the content and linked
coverage. In List it includes an upward double chevron and collapses the inline
article. Both top and bottom controls share the existing return action, restoring
the originating headline's keyboard focus and saved browsing position. Returning
and programmatic scrolling do not mark stories read. Controls clear on expiry.

Verification is recorded in [release acceptance](acceptance.md).

## Remember login - implemented

Sign-in has an unchecked Remember me checkbox. Opting in issues a persistent
HttpOnly reader cookie and a matching 30-day absolute server session. Otherwise
the cookie is browser-session only with an 8-hour server maximum. Existing
clients omitting the new boolean keep the unchecked behavior. Login still
rotates the session ID and CSRF token, and no password/account preference is
stored in localStorage. Daily expiry checks avoid browser timer overflow on
long sessions. NewsBlur session expiry or a reader restart still signs users out,
since the upstream client/session store remains in memory.

Verification is recorded in [release acceptance](acceptance.md).

## Full-width articles and sidebar controls - implemented

Opened articles use the available reading column without the former 52rem panel,
65-character body or 25-character headline caps. List retains inline expansion.
The masthead, displayed username, logout button and Your feeds heading are removed.
Appearance and Keyboard shortcuts sit beside Refresh in a labelled sidebar group.
Sign-in focuses All feeds; expiry still clears content and returns to sign-in.
The logout API remains available and covered by server/container checks.

Verification is recorded in [release acceptance](acceptance.md).

## Newspaper editorial refinement - implemented

- Sentence-aware Magazine introductions restore the full supplied excerpt in
  Cards. Supporting copy budgets account for photographs beside the lead; photo
  heights are restrained to reduce unequal group heights.
- Consecutive short text items form an In brief band with compact headline/copy
  rows. Day boundaries, source order, sealed batches and reading actions remain.
- Tiny decoded pictures try remaining NewsBlur candidates outside List; remaining
  tiny pictures stay small and do not choose a photo-led template. Large logos
  cannot be identified by size alone.
- Opened articles gain a comfortable body measure, stronger headline/byline
  hierarchy, introductory paragraph and quotation treatments. Source figures,
  captions and credits survive sanitization with active attributes removed.
- Original native implementation; no new dependency or third-party assets.

Verification is recorded in [release acceptance](acceptance.md). Exact page
fitting and semantic image selection remain outside this deterministic composer.

## Read-state indicator

Unread stories show a slim vertical blue marker beside the headline in Cards,
List and Magazine, with rounded ends and a subtle blue halo. The line clears after NewsBlur confirms the story was read;
textual read-state metadata remains available.

## Warm paper and content-aware newspaper composition - implemented

- Warm paper is the only active palette, before JavaScript and under system dark
  mode. The old light/dark/system palettes live outside the served website in
  [the archive](archive/README.md). The theme selector and multi-theme review
  matrix are removed. Old theme preferences migrate without losing valid article
  font/size choices. Cards and List remain active reading layouts.
- Magazine now composes small consecutive story groups. Landscape/photo-led
  groups use a large lead with stacked side stories; portrait-led groups retain a
  narrow photograph and wider adjacent copy. A later photograph can sit beside
  opening text. Actual typeface measurements and relative text weight distinguish
  a substantial text lead from equal short columns and single briefs.
- Introductions now contain up to 1200 sanitized Unicode characters and prefer a
  word boundary. Native columns, balanced headline wrapping, hyphenation and
  keep-with-next rules provide real text composition. Pictures retain proportions.
- Existing nodes and source order survive layout changes and pagination. Fetched
  groups are sealed rather than regrouped when another batch arrives. Picture
  availability can recompose a group, with a scroll anchor and reset read tracking.
- Reviewed FT Labs Columnflow, Treesaver, Adobe BalanceText, Tufte CSS, and Ghost
  Source. Actual licence files and embedded notices were checked. The new composer
  is original code using their design ideas, with no new engine/font dependency.
  See [pinned sources and licence decisions](newspaper-research.md).

Verification: the final `npm test` gate passed Go formatting/vet/tests/build,
Linux race checks, licence/notice checks, static security, 65 synthetic browser
checks and 10 shipped-container checks. These include Warm paper migration under
system dark mode, portrait and later-photo layouts, type-weight composition,
picture hiding, order preservation and append stability. Actual portrait PNGs
decoded through Nginx/Go/TLS and retained their proportions. The extra fixture
coverage reuses the existing signed-in flow, keeping production auth limits.

The review gallery now contains 18 Warm paper images: all three layouts at two
widths, plus landscape, portrait, text-only and later-photo newspaper cases.
The local preview was rebuilt and both services report healthy. All 21 packaged
app licence files and the public notice bundle match the source. Installed
NewsBlur and human accessibility acceptance remain separate open gates.

## Previous delivered reading scopes and training

## Reading scopes, training, and newspaper Magazine - implemented

- Search is removed end to end, including query forwarding and draft handling.
  Saved stories, saved metadata, and save/unsave writes are removed from the reader.
  This does not delete anything already saved in NewsBlur.
- All feeds and Read folder show combined NewsBlur rivers. Nested folder reading
  resolves current subscription membership, deduplicates IDs, rejects stale folder
  titles, and keeps empty folders empty. All/Unread/Focus works in each scope.
- Focus shows unread stories with positive NewsBlur intelligence. Neutral-only
  batches continue scanning with the existing bounded empty-batch controls.
  Missing scores explain unavailability; account limits are surfaced.
- Article like/dislike icons train a labelled headline, author, or topic in
  NewsBlur. The server validates the choice against the story and sends one
  feed-scoped classifier write. Clear training removes that choice. Confirmation,
  failure, CSRF and session expiry use the existing reader boundaries.
- Magazine is a newspaper composition with a large photo/text lead, two-column
  photo features alongside narrow text stories, serif headlines, and fine rules.
  It preserves story order, existing nodes, layout switching, pagination, themes,
  and picture controls. It does not use AI for page composition.

Verification: `npm test` passed formatting, vet, Go tests/build, Linux race tests,
notices, static security, 60 browser checks and 10 shipped-container checks. After
adding explicit nested-folder and account/page-limit coverage, the final browser
suite passed all 61 checks; the added Go limit cases passed in the focused HTTP
suite. The 36-image desktop gallery was regenerated and newspaper collections
were visually inspected at 1024px and 1440px. The existing local preview was
rebuilt and both services reported healthy. No real account data was accessed.
Installed NewsBlur version/contract acceptance remains open. Public references:
[river and feed API](https://www.newsblur.com/api),
[classifier endpoint](https://github.com/samuelclay/NewsBlur/blob/master/apps/analyzer/views.py),
[score precedence](https://github.com/samuelclay/NewsBlur/blob/master/media/js/newsblur/reader/reader_utils.js).

## Follow-up backlog

- Read exact existing classifiers into the training controls. Current button
  highlights represent confirmations made during this reader session; all
  training itself persists in NewsBlur.
- Review newspaper layouts with representative feed density, portrait/landscape
  photography, large text, and assistive technology on the installed server.
- Consider optional AI assistance for selecting photo emphasis or composing a
  newspaper edition only after this deterministic layout has real-use feedback.
  Keep NewsBlur responsible for stories, intelligence and generated summaries;
  no new generation service or account integration is included in this pass.

## Earlier UI passes (search/saved and multi-theme behaviour below is superseded)

## Delivered in this pass

- A consistent editorial hierarchy: serif collection titles, restrained navigation
  labels and quieter metadata. The later full-width update removes the masthead
  and article measure cap.
- Original line icons replace boxed Appearance, Keyboard shortcuts, Sign out,
  and Refresh controls. Accessible names, tooltips, focus outlines, and
  44-pixel targets remain. Daily Briefing and Saved stories retain text labels.
- Layout selection shares the collection heading. Search and unread filtering
  share one compact row; the permanent search-availability explanation is removed.
- More deliberate sidebar surfaces, selected navigation, card spacing, article
  source links, sign-in treatment, dialog typography, and modal backdrop.
- Desktop-only presentation, with the feed sidebar always available. Window
  resizing, enlarged text, reduced motion, and all three themes remain supported.

## Automatic filters and search - complete

- All/Unread selection applies immediately, submitting the visible search draft
  too. Search submits on Enter; there is no Apply or search-submit button.
- Clear search resets the query, retains the selected read filter, and returns
  focus to the search field. The browser's native search-clear action also
  submits the cleared query.
- Typing alone makes no requests. A successful response or continuation does not
  erase a newer draft. Filter changes cancel pending search requests; stale
  responses cannot replace the current collection. Layout changes remain local.
- Failed searches retain the previous stories and typed query for retry.
- Behavioral checks cover draft submission, clear/focus behavior, cancellation,
  layout changes during a pending request, failure/retry, and newer typing during
  a successful request.

## Desktop scope

The reader targets desktop browsers. Mobile-specific CSS, phone test cases,
phone gallery sizes, and the planned mobile navigator have been removed at the
user's request. The synthetic gallery now covers 1024px and 1440px desktop windows
in Cards, Magazine, and List, across light, paper, and dark themes, with both
collections and open articles (36 images).

Validation: 59 synthetic browser checks, 9 shipped-container checks, and the
static CSP/link security check pass. The 36-image desktop gallery was generated
and a 1024px collection was visually inspected. Screenshots are design aids,
not automated acceptance gates.

## Editorial refinement - complete

- Cards use shorter lead images and subtle edge emphasis on hover, reducing
  oversized rows while keeping story order and consistent row alignment.
- Wide Magazine collections pair the lead headline and excerpt with its image.
  Smaller desktop windows and text-only leads retain the stacked reading order.
- Failed collection pictures use a compact notice instead of an empty image-sized
  block. Article and List image handling keep their existing behavior.
- Collection count and refresh time share one line; search has a bounded width.
  Date headings, folder labels, account text, and unread count badges have a more
  consistent hierarchy.
- Article subheadings scale with the chosen reading size and font; paragraph
  spacing and quotations have a clearer long-form rhythm.

Verification: 59 browser checks pass. The full 36-image desktop gallery was
regenerated; Cards in light, Magazine in paper, and an article in dark were
visually inspected. This pass changes presentation only.

## Remaining acceptance

Human review with real feed density and assistive technology is still needed.
Routine verification used synthetic content and did not access a real account.
This pass does not establish installed NewsBlur image compatibility or production
deployment acceptance. See [architecture](architecture.md),
[verification](ai/testing.md), and [release acceptance](acceptance.md).

The existing deletions of `roadmap.md`, `blockers.md`, and `open-source-reuse.md`
were preserved. This document records this UI work without restoring those files.
