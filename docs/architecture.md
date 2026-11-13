# Reader architecture

News Stability presents an existing NewsBlur server. NewsBlur owns subscriptions,
stories, state, search, intelligence and briefing generation. The reader has no
feed fetcher, publisher scraper, ranking system or story database.

- `cmd/reader`: configuration, HTTP wiring and graceful shutdown.
- `internal/newsblur`: fixed-origin HTTPS transport and upstream field adaptation.
- `internal/session`: in-memory reader sessions; upstream credentials stay server-side.
- `internal/article`: maintained HTML sanitizer, excerpts, safe pictures/links,
  and reading-time presentation.
- `internal/httpserver`: authenticated reader endpoints and a shared sanitized
  story contract across feeds, saved, briefing, related coverage and full text.
- `web/reader.js`: current account, scope, stories, selection and confirmed actions.
  `layout.js`, `appearance.js`, `pictures.js`, `dates.js`, `infinite.js`, `keyboard.js`
  and `relations.js` own their focused presentation responsibilities.
- Nginx serves static assets and proxies `/api/` to Go with CSP and auth limits.

The three layouts share one ordered collection and action model. Layout changes
are browser-local and do not request new data. List reparents one reusable article
panel into its originating row; Cards/Magazine hide the collection for focused
reading. Return restores browsing context. Full text comes only from NewsBlur;
feed content stays visible until extraction succeeds.

The stream requests the next upstream page near the collection's end, deduplicates
hashes and appends rows. A single request, cancellation/epoch guards, bounded
empty-batch continuation and explicit retries preserve context. Loaded stories
remain in memory; refresh restarts at page one. Storage contains allowlisted
appearance/layout preferences, never credentials, stories or account state.

Publication instants derive from NewsBlur `story_timestamp` and render in the
browser timezone. List/Magazine group contiguous calendar-day runs without
sorting; the first story of each Magazine day spans the available columns.
Cards show individual timestamps without group headings. Unknown dates remain
literal metadata in a Date unavailable group. Today/Yesterday labels reflect
the collection render time; refresh updates them. Last refreshed records a
successful first-batch load, not feed publication time or continuation time.

See [roadmap](roadmap.md), [reuse review](open-source-reuse.md),
[verification](ai/testing.md) and [release acceptance](acceptance.md).
