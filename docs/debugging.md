# Local development and debugging

Use Go 1.26+, Node 24+, Python, and Docker Desktop with Linux containers.
Follow [verification rules](ai/testing.md); keep account data out of logs/fixtures.

## Quick review

```powershell
.\scripts\preview.ps1 -OpenBrowser
docker compose ps
docker compose logs --tail 80 app web
```

The script creates `.env` only if absent, builds both images and waits for health.
Web assets are mounted read-only from `web/` for immediate updates. Re-run after
Go or image changes. Stop with `docker compose stop app web`. Health checks show
local service health, not successful NewsBlur login or installed acceptance.

For a synthetic gallery without a NewsBlur connection:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run review:ui
```

Open `.local/ui-review/index.html`. Browser tests use the same isolated fixture;
they never attach to an existing account or browser session.

## Configuration and private CA

`.env.example` lists the common settings. `NEWSBLUR_ORIGIN` is the upstream HTTPS
origin; `PUBLIC_ORIGIN` is the reader origin without a trailing slash. Public
traffic requires HTTPS; loopback HTTP is supported for local review. The Go app
must resolve and trust the NewsBlur server from inside its container.

For a private CA, add the relevant entries to your ignored
`compose.override.yaml` (merge with existing overrides):

```yaml
services:
  app:
    environment:
      NEWSBLUR_CA_FILE: /etc/news-stability/lan-root-ca.pem
    volumes:
      - ./lan-root-ca.pem:/etc/news-stability/lan-root-ca.pem:ro
```

Point the host side at the actual CA certificate. Do not disable TLS validation.
Keep private keys and credentials outside the repository. Native Go accepts the
CA file's host path through `NEWSBLUR_CA_FILE` instead.

## Native breakpoints

`go run ./cmd/reader` starts only Go; `/healthz` defaults to
`http://127.0.0.1:8090/healthz`. Use the existing **Go: reader** VS Code launch
configuration with the Go extension/Delve for breakpoints. Nginx serves the UI;
the browser never talks to NewsBlur directly for API requests.

Inspect status codes and error codes rather than logging request bodies, story
content, cookies or headers. Full-text/picture failures have separate UI states.
See [acceptance](acceptance.md) for installed checks and [blockers](blockers.md)
for work that local fixtures cannot establish.
