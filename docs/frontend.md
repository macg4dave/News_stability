# Frontend implementation

The first reader uses native JavaScript modules, semantic HTML, and CSS. The
current interaction needs do not require a framework or frontend build pipeline.
Revisit that choice when source complexity demonstrates a need. Go remains the
server language; NewsBlur owns all news and reading state.

`web/index.html` defines the login and three reading panels. `web/reader.js`
keeps only temporary UI state in memory: selected feed/page/story, current
session's CSRF token, and in-flight requests. It never writes credentials,
cookies, feeds, or articles to localStorage, sessionStorage, or IndexedDB.
`web/reader.css` provides wide and narrow layouts, visible focus, and system
light/dark colors. Native buttons and disclosure controls provide basic keyboard
operation. Reader shortcuts are now implemented; accessibility/browser review remains open.

## Development

Run `docker compose up --build -d app web` and open the exact `PUBLIC_ORIGIN`
(default `http://localhost:8080`). Static files are mounted directly. Refresh the
browser after editing; no Node install, npm dependencies, or bundle step is needed.
Use browser developer tools to debug the module and inspect reader API responses.
Use the existing Go debugger for server routes. Do not export network traces
containing passwords, session cookies, CSRF tokens, or private story content.

## Data and failure behavior

The UI bootstraps `/api/session`, then loads folders and unread counts. Selecting
a feed requests one story page; selecting a story displays its sanitized content.
Selection never marks a story read. Read/unread and save/unsave actions remain P07.
Counts display positive plus neutral unread stories; hidden counts are kept
separate by the server. Empty pages with hidden stories can still be paginated.

Failed reads preserve the current view. New selections abort older requests, and
session transitions invalidate pending results. Sign-out and session expiry clear
account content. A feed/page location can be resumed only when the same username
signs back in. There is no offline synchronization or automatic retry of writes.

Article HTML has one insertion point, accepting only the server's sanitized
`html` field. Other upstream text uses `textContent`. The sanitizer excludes
scripts, styles, forms, frames, embedded media, remote images, IDs, and event
handlers. Original links accept only absolute HTTP(S) URLs without credentials.
The static server also supplies a restrictive Content Security Policy.

This is implemented source, not a browser-verified or accessible-release claim.
The test pass and installed-server acceptance are deliberately deferred while the
larger implementation slice is being built.

## Reused reading features

The Miniflux/Fusion adaptations add j/k story navigation, v for the original,
g then f/s for feed/story focus, and ? for keyboard help. Shortcuts pause while
typing, composing text, selecting text, or using a modal. Navigation never marks
stories read. Story metadata shows a reading-time estimate based on sanitized
article text, including CJK character-count handling. See the [reuse review](open-source-reuse.md)
for pinned source revisions, changes, and license records.

The footer links `/third-party-notices.txt`, which includes full license texts.
Regenerate this bundle with `python scripts/update_notices.py` after notice or
module changes. No runtime network lookup or external script is used.

## Appearance and connected reading

The Appearance dialog works before and after sign-in. Shiori-derived theme logic
and Memos-derived paper colors provide system/light/dark/warm-paper backgrounds,
serif/sans-serif article fonts, and three text sizes. Only allowlisted display
preferences persist under `news-stability-appearance-v1` in localStorage. Blocked
storage leaves the controls usable for the tab; no account/story data is saved.
The source does not claim that contrast or accessibility has been audited.

Daily Briefing reads NewsBlur summaries and curated source stories. Its page shows
ready, preview, disabled, empty, unsupported, and failed states as the inspected
contract permits. No local summary or AI generation is performed, and no generation
or preference-write endpoint is exposed. An empty response is not labeled pending
because the inspected API supplies no explicit generation-progress field.

Article connections separate NewsBlur cluster metadata from actual hyperlinks
among loaded stories. Memos-derived relation buckets show outgoing links and
backlinks on the current page. Linked stories already loaded open immediately;
other NewsBlur references use a fixed story-hash read endpoint. The same sanitizer
and safe-link policy apply to feed, briefing, and individual-story output.
Network failures preserve the current article and reading page. The inspected
upstream contracts still require installed-server acceptance and browser tests.
