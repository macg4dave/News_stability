# Backlog

Priority: P0 required for the first reading flow, P1 next product value,
P2 later refinement. Items inherit the milestone's definition of done.
Move delivered work out of the active list and update the roadmap.

| ID | Priority | Milestone | Work item and acceptance | Depends on |
| --- | --- | --- | --- | --- |
| P02 | P0 | M1 | In progress: HTTPS origin and public briefing calls identified; finish installed API/version inventory and synthetic response fixtures ([evidence](newsblur-contract.md)) | B02, B03 |
| P03 | P0 | M1 | Transport wired into reader source, including CSRF bootstrap and private CA roots; candidate feed/story adapters added; synthetic TLS reading/action tests pass; installed acceptance pending | P02 |
| P04 | P0 | M1 | [Session/login/logout and CSRF source](sessions.md) implemented; passthrough removed; expiry, invalid login, secure cookies and synthetic full-flow tests pass; installed session policy pending | P02, P03 |
| P05 | P0 | M2 | Source implemented: folders/feeds and unread counts with loading, empty, offline, and session-expired UI; synthetic Go/browser checks pass; installed acceptance pending | P01, P04 |
| P06 | P0 | M2 | Source implemented: story pagination, article view, maintained sanitizer, safe links; NewsBlur-related coverage and loaded-page hyperlink/backlink navigation added; hostile-markup, pagination, link and browser checks pass; installed acceptance pending | P05 |
| P08 | P1 | M3 | Source implemented: read-only NewsBlur briefing summaries, curated source links, preview/disabled/empty/unsupported/error states; user confirms installed feature works with local AI; reader contract acceptance and explicit generation-progress detection remain | P02, P06 |
| P09 | P1 | M4 | Source now includes Miniflux/Fusion-derived keyboard navigation, help dialog, mobile layouts, visible focus, semantic controls, and system/light/dark/paper backgrounds with font/size controls; Chromium keyboard/mobile/appearance checks pass; human accessibility/contrast and intended-browser review remain | M2 |
| P10 | P1 | M4 | Feed search, unread filtering and saved reading implemented/tested; inspect installed support for further intelligence filters/tags as a follow-up | P02, M2 |
| P11 | P1 | M5 | Ten synthetic Chromium smoke tests and [acceptance checklist](acceptance.md) delivered; human accessibility and real-server acceptance remain | M2, M3 |
| P12 | P1 | M5 | [HTTPS, upgrade/recovery and image policy guide](deployment.md) delivered, auth burst limiting and base digests pinned; operator deployment/rollback exercise remains | M1, B01 |
| P13 | P2 | M4+ | Briefing preferences and other useful NewsBlur settings through verified existing endpoints | P08 |
| P14 | P2 | M4+ | Measure slow flows before adding caching, prefetching, profiling listeners, or additional infrastructure | Real usage evidence |

## Delivered locally, 2026-11-13

- P01: native JavaScript/CSS layout and build/debug flow, with Chromium smoke
  coverage. Human accessibility is tracked separately in P09/P11.
- P07: explicit read/unread/save/unsave, confirmation-only visible updates,
  rejected/uncertain-result reporting and no automatic retries. Go TLS/browser
  tests pass; installed-account action acceptance remains the M2 gate.

## Outside current scope

Feed crawling, independent article extraction, replacement search infrastructure,
AI briefing generation, social-network rebuilding, and a second story database.
Offline synchronization is deferred until a concrete reader need justifies its
state ownership and conflict behavior.
