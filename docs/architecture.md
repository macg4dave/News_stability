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
  `scroll-read.js` and `relations.js` own their focused presentation responsibilities.
- Nginx serves static assets and proxies `/api/` to Go with CSP and auth limits.

The three layouts share one ordered collection and action model. Layout changes
are browser-local and do not request new data. List reparents one reusable article
panel into its originating row; Cards/Magazine hide the collection for focused
reading. Return restores browsing context. Full text comes only from NewsBlur;
feed content stays visible until extraction succeeds.

Image presentation adapts NewsBlur full images and small thumbnails. Signed
relative `/imageproxy/...` URLs (or equivalent URLs on the configured origin)
become `/api/newsblur-picture?path=...`. That authenticated endpoint validates the
known signed path format, requests only the configured NewsBlur origin, follows
no redirects, bounds responses to 8 MiB/15 seconds and serves recognized raster
types with no-store/nosniff/sandbox headers. It never fetches arbitrary publisher
URLs or forwards upstream headers/cookies to the browser. External image-proxy
hosts remain direct HTTPS browser requests. NewsBlur verifies proxy signatures.

Common lazy image attributes and publisher-relative paths are resolved before
the existing sanitizer; output images stay inert until Pictures is enabled.
Lead images have at most six distinct safe candidates, including HTTPS originals;
inline signed images retain a safe original fallback. List prefers NewsBlur's
thumbnail and switches to full images when the layout changes. A failed candidate
is not retried endlessly. Filled/hollow unread dots use confirmed read state and
include equivalent textual metadata.

The stream requests the next upstream page near the collection's end, deduplicates
hashes and appends rows. A single request, cancellation/epoch guards, bounded
empty-batch continuation and explicit retries preserve context. Loaded stories
remain in memory; refresh restarts at page one. Storage contains allowlisted
appearance/layout preferences, never credentials, stories or account state.

Deliberate downward scrolling marks previously visible stories read once their
headline buttons pass above the viewport. An opened article is marked read when
its end becomes visible while scrolling. Navigation/layout changes reset this
tracking. Briefing summaries, unseen stories, background tabs and offline browsing
are excluded. Read writes are serialized, deduplicated and applied to existing
nodes only after NewsBlur confirms them; unread-filter rows are retained to avoid
moving the reader's position. Failures pause writes until a successful collection
refresh. Logout aborts pending writes and discards their queue. Read/save buttons
are absent; the Saved stories scope still presents NewsBlur's existing saves.
After confirmed read writes, unread-only continuation restarts its upstream scan
and deduplicates against existing rows, since changed read state can shift page
offsets. Read revisions also detect writes made while a batch is in flight.

Publication instants derive from NewsBlur `story_timestamp` and render in the
browser timezone. List/Magazine group contiguous calendar-day runs without
sorting; the first story of each Magazine day spans the available columns.
Cards show individual timestamps without group headings. Unknown dates remain
literal metadata in a Date unavailable group. Today/Yesterday labels reflect
the collection render time; refresh updates them. Last refreshed records a
successful first-batch load, not feed publication time or continuation time.

See [roadmap](roadmap.md), [reuse review](open-source-reuse.md),
[verification](ai/testing.md) and [release acceptance](acceptance.md).
