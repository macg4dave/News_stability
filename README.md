# News Stability

A focused web reader for an existing self-hosted **NewsBlur** server at
`news101.lan`. Go provides the reader server; Nginx serves the web entry point.
NewsBlur remains responsible for feeds, stories, intelligence, and Daily Briefing
generation. We present those capabilities through a simpler reading interface.

The reader includes login with optional Remember me, server-side sessions and logout API support, nested feeds, continuously loaded
sanitized articles, automatic mark-read while scrolling, All feeds and nested-folder
reading, Focus intelligence filtering, NewsBlur like/dislike training, Warm paper typography controls and
keyboard navigation. Search and saved-story features are intentionally absent. Daily Briefing presents
NewsBlur summaries and source stories. Native/race, synthetic TLS, browser smoke,
and isolated proxy checks cover these flows; installed acceptance remains open.
The frontend uses native JavaScript/CSS with no bundling step.

Magazine composes consecutive stories into newspaper groups, using picture
orientation and the amount of text. Photo leads sit beside stacked stories;
portraits keep their proportions; substantial introductions flow into columns.
Headlines balance naturally and paragraphs use browser-native hyphenation. Cards display lead pictures, and the article
reader supports inline pictures. Use Appearance → Pictures to hide them across the reader. Images load
through NewsBlur's signed image proxy when supplied, with direct HTTPS originals
and other supplied images as bounded fallbacks. Relative `/imageproxy/...` URLs
use an authenticated reader relay to the configured NewsBlur server; List prefers
NewsBlur's small thumbnails. Lazy image attributes and publisher-relative paths
are recovered before sanitization. No publisher pages are scraped.
External images load without a referrer or CORS requirement; external-site cookies
follow your browser's settings. Unavailable images retain a placeholder, and
Pictures hidden suppresses both relay and external requests.

Each story has a small filled dot when unread and a hollow dot when read. It
changes only after NewsBlur confirms the read update; state is also available
as text for accessibility.

Opening a story automatically requests NewsBlur's full-text extraction. The feed
version stays visible while it loads; successful full text replaces it in the
article pane. If NewsBlur cannot provide full text, the reader says so and keeps
the feed version and original link. Extraction remains a NewsBlur responsibility.

Cards and Magazine open a focused article at the top of the reading area.
List expands the article directly beneath its headline, pushing later stories
down. Click the expanded headline again or Close story to collapse it.
Back to stories (or `g` then `s`) restores your selected story and browsing position.

Scroll toward the end of the collection to load more stories automatically.
Loaded stories stay in place, including expanded List articles. Loading pauses
offline and offers Retry loading stories after an error; Load more stories is
also available for keyboard access. Refresh starts again at the newest batch.

Scrolling past a story marks it read in NewsBlur; scrolling to the end of an
opened article marks that article read. Only stories actually seen are included.
Opening stories, changing layouts, and loading batches do not mark them read.
Explicit read buttons are absent. Failed read updates keep stories unread and pause further
updates until Refresh; offline/background browsing does not send read updates.

List and Magazine group consecutive publication days in your browser timezone;
Cards show publication timestamps. Last refreshed records the last successful
collection reload. Layout, article font/size and picture settings stay in your browser. Warm paper is
the only active palette during development; light/dark/system styles are
[archived](docs/archive/README.md). Older theme choices migrate automatically.

Milestones 1–5 are implemented. Local verification passes; installed-server,
human accessibility, HTTPS/upgrade/rollback and distribution-license gates remain
open in [release acceptance](docs/acceptance.md).

Article thumbs send likes/dislikes to NewsBlur for the selected headline, author,
or topic within that feed. Clear training removes that choice. Changes are shown
only after confirmation; refresh to update Focus results. Focus contains unread
stories with positive NewsBlur scores, using your existing training. Training
persists on the server; button highlights track confirmations in this session.

## Documentation

- [Architecture and project layout](docs/architecture.md)
- [Development, configuration and debugging](docs/debugging.md)
- [Installed acceptance checklist](docs/acceptance.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Reader UI roadmap](docs/ui-roadmap.md)
- [Newspaper research and licence review](docs/newspaper-research.md)
- [AI rule index](AGENTS.md)

## Native Go development

Go includes built-in testing: `go test ./...` runs tests and
`go test -race ./...` checks for data races on supported toolchains.

For the complete automated application gate:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

Requires Go, Node 24+, Python, and Docker with Linux containers. CI runs the same
gate. `npm run test:e2e` tests the built Docker app against synthetic NewsBlur
over verified HTTPS, including actual image decoding in Chromium. Pass/fail
uses assertions, with no screenshot or AI review. See [testing](docs/ai/testing.md).

Requires Go 1.26 or newer. Go modules include the maintained bluemonday HTML sanitizer.

```sh
go run ./cmd/reader
```

Open http://127.0.0.1:8090/healthz. This starts the Go service only. Use the
included **Go: reader** VS Code debug configuration for breakpoints; see the
[debugging guide](docs/debugging.md) for Go extension/Delve setup.

## Start development

Requires Docker Engine/Desktop with Linux containers and Docker Compose v2.

For a quick build and review from PowerShell:

```powershell
.\scripts\preview.ps1 -OpenBrowser
```

The script builds and starts Nginx and the Go reader, waits for both to become
healthy, and prints the configured review URL (normally `http://localhost:8080`).
Omit `-OpenBrowser` to leave the browser closed. It works from any working
directory when invoked by its path, creates `.env` only if missing, and respects
existing settings and `compose.override.yaml`. Re-run it to rebuild; use
`docker compose stop app web` from the repository to stop the preview.
If PowerShell blocks local scripts, run
`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\preview.ps1 -OpenBrowser`
for this invocation. Service health does not verify NewsBlur sign-in or connectivity.

Alternatively, start Compose manually:

```sh
cp .env.example .env
docker compose up --build -d web
```

In PowerShell, use `Copy-Item .env.example .env` for the copy step.
Open http://localhost:8080. Compose starts both Nginx and the Go app.
Files in `web/` are mounted for immediate editing.
Set `WEB_PORT`, `PUBLIC_ORIGIN`, and `NEWSBLUR_ORIGIN` in `.env` as needed, then rebuild.
Use an origin without a trailing slash, for example `https://news101.lan`.
The container must be able to resolve and reach that host.
Go owns the HTTPS upstream connection. See [CA configuration](docs/debugging.md)
if the server uses a private certificate authority.

```sh
docker compose logs -f app web
docker compose down
```

## Test

```sh
go fmt ./...
go vet ./...
go test ./...
go build ./...
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
npm run review:ui
docker build --target test -f Dockerfile.reader .
python -B -m unittest discover -s tests -v
docker compose config --quiet
docker compose --profile test run --rm test
docker compose -f compose.yaml -f compose.test.yaml --profile test run --build --rm integration
docker compose -f compose.yaml -f compose.test.yaml --profile test down
```

The integration stack starts Nginx and Go with an unreachable synthetic upstream;
it checks static/proxy/unauthenticated boundaries without accessing `news101.lan`
or requiring credentials. Go TLS fixtures and Chromium browser API fixtures use
synthetic data only. Browser checks require Node 24+ and Python. Linux CI also runs
`go test -race ./...`. See [verification rules](docs/ai/testing.md) for details.
`npm run review:ui` writes a 36-image synthetic review gallery to
`.local/ui-review/index.html`, covering every layout/theme at desktop window sizes.

## Early development references

- [NewsBlur API](https://www.newsblur.com/api)
- [NewsBlur source](https://github.com/samuelclay/newsblur)
- [Local NewsBlur](https://news101.lan)
- [Development and integration notes](docs/debugging.md)
- [AI contributor instructions](AGENTS.md)

Development binds to loopback by default. This HTTP setup is for local work;
configure HTTPS before exposing authenticated reader traffic beyond your machine.

## Open-source attribution

Reading-time estimation and keyboard dispatch adapt Miniflux code (Apache-2.0).
The keyboard typing guard adapts Fusion code (MIT). Full licenses, retained
copyrights, pinned revisions, modification notices, and Go dependency notices
are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The reader footer exposes
the full notices, and the Go container ships the license directory.

Shiori (MIT) theme logic and Memos (MIT) paper colors/reference buckets add
appearance controls and linked-reading presentation. Briefing summaries and
related-story groupings are provided by NewsBlur; installed acceptance remains open.

Remember me keeps this browser signed in for up to 30 days with an HttpOnly cookie.
Unchecked logins use a browser-session cookie and an eight-hour maximum. Passwords
are never saved by the reader. NewsBlur expiry and reader server restarts still
require signing in again because upstream sessions remain in memory.
