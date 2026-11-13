# Reader look and feel

Updated 13 November 2026.

## Delivered in this pass

- A consistent editorial hierarchy: serif masthead and collection titles,
  restrained navigation labels, quieter metadata, and a narrower article measure.
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
