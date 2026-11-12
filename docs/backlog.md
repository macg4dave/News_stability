# Backlog

Priority: P0 required for the first reading flow, P1 next product value,
P2 later refinement. Items inherit the milestone's definition of done.
Move delivered work out of the active list and update the roadmap.

| ID | Priority | Milestone | Work item and acceptance | Depends on |
| --- | --- | --- | --- | --- |
| P01 | P0 | M1 | Choose frontend approach; document build/debug flow and one accessible reading-layout prototype | Product scope; no framework installed yet |
| P02 | P0 | M1 | Inventory installed NewsBlur API, including briefing routes; record response contracts with synthetic fixtures | B02, B03 |
| P03 | P0 | M1 | Thin Go upstream client with context, timeouts, bounded bodies, status handling, safe redirects, and transport tests | P02 |
| P04 | P0 | M1 | Session/login/logout and CSRF design; test expiry, invalid login, and secure cookie behavior; remove superseded development passthrough paths | P02, P03 |
| P05 | P0 | M2 | Folders/feeds and unread counts; useful loading, empty, offline, and session-expired states | P01, P04 |
| P06 | P0 | M2 | Story list pagination and article view; maintained HTML sanitizer, safe links, and hostile-markup tests | P05 |
| P07 | P0 | M2 | Read/unread and saved-story actions; rollback/report upstream failure and avoid automatic write retries | P06 |
| P08 | P1 | M3 | Daily Briefing view, availability detection, source-story navigation, and pending/error/unsupported states | P02, P06 |
| P09 | P1 | M4 | Keyboard navigation, mobile layouts, visible focus, semantic controls, and light/dark themes | M2 |
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
