# Backlog

Priority: P0 required for the first reading flow, P1 next product value,
P2 later refinement. Items inherit the milestone's definition of done.
Move delivered work out of the active list and update the roadmap.

| ID | Priority | Milestone | Work item and acceptance | Depends on |
| --- | --- | --- | --- | --- |
| P01 | P0 | M1 | Source implemented: native JavaScript/CSS reader layout and [build/debug flow](frontend.md); browser/accessibility review pending | Browser review |
| P02 | P0 | M1 | In progress: HTTPS origin and public briefing calls identified; finish installed API/version inventory and synthetic response fixtures ([evidence](newsblur-contract.md)) | B02, B03 |
| P03 | P0 | M1 | Transport wired into reader source, including CSRF bootstrap and private CA roots; candidate feed/story adapters added; combined test pass and installed acceptance pending | P02 |
| P04 | P0 | M1 | [Session/login/logout and CSRF source](sessions.md) implemented; passthrough removed; expiry, invalid login, secure cookies, and full-flow tests pending | P02, P03 |
| P05 | P0 | M2 | Source implemented: folders/feeds and unread counts with loading, empty, offline, and session-expired UI; combined tests/acceptance pending | P01, P04 |
| P06 | P0 | M2 | Source implemented: story pagination, article view, maintained sanitizer, safe links; NewsBlur-related coverage and loaded-page hyperlink/backlink navigation added; hostile-markup, pagination, link, and browser tests pending | P05 |
| P07 | P0 | M2 | Read/unread and saved-story actions; rollback/report upstream failure and avoid automatic write retries | P06 |
| P08 | P1 | M3 | Source implemented: read-only NewsBlur briefing summaries, curated source links, preview/disabled/empty/unsupported/error states; installed contract, explicit generation-progress detection, and acceptance remain | P02, P06 |
| P09 | P1 | M4 | Source now includes Miniflux/Fusion-derived keyboard navigation, help dialog, mobile layouts, visible focus, semantic controls, and system/light/dark/paper backgrounds with font/size controls; browser/accessibility verification remains | M2 |
| P10 | P1 | M4 | Use NewsBlur search, intelligence filters, saved stories, and tags where installed API supports them | P02, M2 |
| P11 | P1 | M5 | Browser-level reading/session smoke tests, manual accessibility review, and real-server acceptance checklist | M2, M3 |
| P12 | P1 | M5 | HTTPS/reverse-proxy deployment and session review; document upgrade/recovery and container image update policy | M1, B01 |
| P13 | P2 | M4+ | Briefing preferences and other useful NewsBlur settings through verified existing endpoints | P08 |
| P14 | P2 | M4+ | Measure slow flows before adding caching, prefetching, profiling listeners, or additional infrastructure | Real usage evidence |

## Outside current scope

Feed crawling, independent article extraction, replacement search infrastructure,
AI briefing generation, social-network rebuilding, and a second story database.
Offline synchronization is deferred until a concrete reader need justifies its
state ownership and conflict behavior.
