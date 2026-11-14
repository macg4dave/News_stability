# Reader architecture

News Stability presents an existing NewsBlur server. NewsBlur owns subscriptions,
stories, state, search, intelligence and briefing generation. The reader has no
feed fetcher, publisher scraper, ranking system or story database.

- `cmd/reader`: configuration, HTTP wiring and graceful shutdown.
- `internal/newsblur`: fixed-origin HTTPS transport and upstream field adaptation.
- `internal/session`: in-memory reader sessions; upstream credentials stay server-side.
  Anonymous sessions last 15 minutes. Normal logins last at most 8 hours and use
  browser-session cookies. Opt-in remembered logins last at most 30 days and use
  persistent HttpOnly cookies with matching absolute expiry. Neither lifetime is
  extended by reading. NewsBlur expiry or a reader process restart ends either
  kind of session; no password or session token enters localStorage.
- `internal/article`: maintained HTML sanitizer, excerpts, safe pictures/links,
  and reading-time presentation.
- `internal/httpserver`: authenticated reader endpoints and a shared sanitized
  story contract across feeds, folder/all-feed rivers, briefing, related coverage
  and full text.
- `web/reader.js`: current account, scope, stories, selection and confirmed actions.
  `layout.js`, `appearance.js`, `pictures.js`, `dates.js`, `infinite.js`, `keyboard.js`
  `scroll-read.js`, `feedback.js`, `newspaper.js` and `relations.js` own focused
  presentation responsibilities.
- Nginx serves static assets and proxies `/api/` to Go with CSP and auth limits.
- `tests/e2e` and `compose.e2e.yaml`: a test-only synthetic HTTPS NewsBlur server
  behind the shipped Go/Nginx images. Chromium checks behavior and image decoding
  without API/image mocks or screenshot judgments. `npm test` runs this with Go,
  race, static security, notices and the faster browser contract tests in CI.

The UI targets desktop browsers, with a persistent feed sidebar. Refresh,
Appearance and Keyboard shortcuts share the sidebar toolbar. There is no top
masthead, displayed username, logout control or visible feeds heading. Opened
articles fill the available reading column; List retains inline expansion.
Expiry clears reader content; the server logout endpoint remains supported.
All feeds and Read folder use NewsBlur's multi-feed river, including nested subscriptions.
The server resolves folder index paths against current subscriptions, checks the
folder title to reject stale choices, and omits duplicate/unsubscribed IDs. River
reads use NewsBlur's read-only POST variant to avoid long feed-list URLs; encoded
forms are bounded to 16 KiB. Empty folders never fall back to all subscriptions.
River pagination stops at NewsBlur's 400-page limit and explains that boundary.
NewsBlur premium-limit messages become a plain account-limitation notice.

All/Unread/Focus selection applies immediately. Focus reads upstream unread
pages, retaining only positive NewsBlur scores. On older responses, classifier
values use NewsBlur's documented hide/positive/negative/feed precedence. Missing
scores produce an explicit unavailable state; neutral/hidden batches preserve
continuation. New selections cancel pending requests. Search, saved collections,
saved metadata, and save/unsave mutations are removed from this reader.

Article thumbs train the selected full headline, author, or topic through
`/classifier/save`. The server re-reads the story and validates membership before
sending one feed-scoped change, never a publisher-wide rule. Classifier success
is code 0; read-state success is code 1. Failures are not retried or presented as
confirmed feedback. Clear training removes the selected classifier. Headlines,
authors, and topics longer than NewsBlur's 255-character limit are not offered.
Confirmed button highlights last for this reader session; existing classifiers
are not loaded into those controls. Training persists in NewsBlur. Refresh reads
updated scores; existing rows remain in place until then. Logout cancels pending
feedback and clears session-local confirmations.

Warm paper is the only active palette, including first paint and system dark
mode. Other colour palettes are archived outside the web root in `docs/archive/`.
The appearance control retains article font, size and picture choices. Legacy
theme preferences are removed while preserving valid typography preferences.

The three layouts share one ordered collection and action model. Layout changes
are browser-local and do not request new data. List reparents one reusable article
panel into its originating row; Cards/Magazine hide the collection for focused
reading. Top and bottom return controls restore browsing context and headline focus.
List shows an upward double chevron on the bottom control to collapse its inline
article. Both controls use the same return path without browser-history navigation. Full text comes only from NewsBlur;
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
is not retried endlessly. Vertical blue unread markers clear only after confirmed read state and
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
refresh. Logout aborts pending writes and discards their queue. Explicit read
buttons are absent.
After confirmed read writes, Unread/Focus continuation restarts its upstream scan
and deduplicates against existing rows, since changed read state can shift page
offsets. Read revisions also detect writes made while a batch is in flight.

Publication instants derive from NewsBlur `story_timestamp` and render in the
browser timezone. List/Magazine group contiguous calendar-day runs without
sorting; the first story of each Magazine day spans the available columns.
Magazine composes consecutive groups of at most three stories, stopping at day
boundaries. The composer uses image availability/orientation and occupied-line
estimates measured in the current system typeface to choose a photo lead with
stacked side stories, a narrow portrait with wider neighbours, a later photograph
beside opening text, or text columns. Substantial text gets room; short endings
remain briefs. No semantic ranking or relatedness is inferred. Fetched groups are
sealed so appending does not regroup existing nodes. Picture changes and width
changes can recompose those groups, preserving a visible story's scroll anchor
and resetting scroll-read tracking. Logout clears detached composition references.

`newspaper.css` uses native grid and columns, balanced headlines, paragraph
wrapping/hyphenation and natural photo proportions. Collection introductions are
up to 1200 Unicode characters of sanitized plain text, cut near a word boundary.
The original story buttons remain in source/DOM order in every layout; Magazine
uses `display: contents` on their existing list rows so day headings and story
buttons participate in the newspaper grid. The single article panel and its
sanitized HTML insertion point remain shared. See [research and licence review](newspaper-research.md).
Magazine also keeps the original introduction on each excerpt element, applies
sentence-aware length budgets, and restores full supplied copy outside Magazine.
Short consecutive items use an In brief band. Decoded tiny pictures try the next
bounded upstream candidate; remaining tiny pictures cannot select a photo lead.
Opened articles retain sanitized figures/captions and user-selected body type.
Cards show individual timestamps without group headings. Unknown dates remain
literal metadata in a Date unavailable group. Today/Yesterday labels reflect
the collection render time; refresh updates them. Last refreshed records a
successful first-batch load, not feed publication time or continuation time.

See [UI roadmap](ui-roadmap.md),
[verification](ai/testing.md) and [release acceptance](acceptance.md).
