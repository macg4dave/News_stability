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
operation. Dedicated reader shortcuts and accessibility/browser review remain open.

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
