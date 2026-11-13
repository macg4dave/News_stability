# News Stability

A focused web reader for an existing self-hosted **NewsBlur** server at
`news101.lan`. Go provides the reader server; Nginx serves the web entry point.
NewsBlur remains responsible for feeds, stories, intelligence, and Daily Briefing
generation. We present those capabilities through a simpler reading interface.

The reader includes login/logout, server-side sessions, nested feeds, paginated
sanitized articles, explicit read/unread and save/unsave, saved stories, feed
search/unread filtering, themes and keyboard navigation. Daily Briefing presents
NewsBlur summaries and source stories. Native/race, synthetic TLS, browser smoke,
and isolated proxy checks cover these flows; installed acceptance remains open.
The frontend uses native JavaScript/CSS with no bundling step.

Cards and Magazine display lead pictures, and the article reader supports inline
pictures. Use Appearance → Pictures to hide them across the reader. Images load
over HTTPS with anonymous CORS requests and no referrer; hosts must allow CORS.
Unavailable images show a placeholder, and List does not load thumbnails.

## Documentation

- [Architecture and project layout](docs/architecture.md)
- [Development and configuration](docs/development.md)
- [Frontend source and build/debug flow](docs/frontend.md)
- [Session design](docs/sessions.md)
- [HTTPS deployment and recovery](docs/deployment.md)
- [Installed acceptance checklist](docs/acceptance.md)
- [Open-source reuse review](docs/open-source-reuse.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Debugging: Go, VS Code, Docker](docs/debugging.md)
- [Roadmap and milestone acceptance](docs/roadmap.md)
- [Blockers and unverified dependencies](docs/blockers.md)
- [Prioritized backlog](docs/backlog.md)
- [AI rule index](AGENTS.md)

## Native Go development

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
Go owns the HTTPS upstream connection. See [CA configuration](docs/development.md)
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

## Early development references

- [NewsBlur API](https://www.newsblur.com/api)
- [NewsBlur source](https://github.com/samuelclay/newsblur)
- [Local NewsBlur](https://news101.lan)
- [Development and integration notes](docs/development.md)
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
