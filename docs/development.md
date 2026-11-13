# Development notes

See [architecture](architecture.md), [frontend](frontend.md), [sessions](sessions.md),
and [debugging](debugging.md) for ownership and debugging details.

## Configuration

| Setting | Default | Consumer |
| --- | --- | --- |
| `WEB_PORT` | `8080` | Compose; Nginx published on loopback |
| `HTTP_ADDR` | `127.0.0.1:8090` natively; `:8090` in Compose | Go listener |
| `PUBLIC_ORIGIN` | `http://localhost:8080` | Go Origin checks and cookie policy |
| `NEWSBLUR_ORIGIN` | `https://news101.lan` | Go upstream client; HTTPS, no trailing slash |
| `NEWSBLUR_CA_FILE` | Unset: system trust | Go; optional PEM file adding trusted CA roots |

Only Compose automatically reads `.env`. Native Go reads process environment
variables. Change `PUBLIC_ORIGIN` when changing the browser hostname or `WEB_PORT`.
Use the exact configured address in the browser: `localhost` and `127.0.0.1` are
different origins. Non-loopback origins require HTTPS termination in front of Nginx.

Compose passes the public and NewsBlur origins to Go. To supply a private CA,
create a local Compose override with a read-only PEM mount and the container path:

```yaml
services:
  app:
    environment:
      NEWSBLUR_CA_FILE: /etc/news-stability/lan-ca.pem
    volumes:
      - ./lan-ca.pem:/etc/news-stability/lan-ca.pem:ro
```

Keep local certificates and deployment overrides outside Git. The file must be
readable by the non-root Go user. This loads trusted roots without bypassing
certificate/hostname verification. Native Go can use a local absolute PEM path.
On 2026-11-13 the local preview was configured with ignored
`compose.override.yaml`, mounting `.local/newsblur-ca.pem` read-only at
`/etc/news-stability/newsblur-ca.pem`. This trusts the installed self-signed
`news101.lan` certificate only in the reader. Its SHA-256 fingerprint is
`9c6c5de87858b02015f0b61783f1f6a1283abd8e0d27f28000ab8a5bd4306235`.
A Go client on the Compose network successfully prepared an anonymous NewsBlur
session with certificate and hostname verification enabled. Review a replacement
certificate before updating this local trust file; no global trust was changed.

## Request flow

Nginx serves static assets and plain-text `/healthz`. `/api/healthz` reaches the
Go JSON health handler. Other `/api/` routes preserve their paths and reach Go's
explicit reader endpoints. The old `/newsblur/` passthrough is removed. The browser
never receives NewsBlur cookies and never chooses an upstream URL.

`GET /api/session` bootstraps a session and CSRF token. Login/logout require the
reader cookie, `X-CSRF-Token`, and matching Origin. `GET /api/feeds` returns adapted
folder navigation; `GET /api/feeds/{id}/stories?page=1` returns a sanitized story
page. `/api/briefing?page=1` reads existing NewsBlur summaries;
`/api/stories/{hash}` reads an identified source/related story. See [session design](sessions.md) for expiry and error semantics.

Health is liveness only; it does not probe NewsBlur. The Go container has no
published host port. Nginx waits for Go health. Go shutdown drains for up to ten
seconds within Compose's 15-second stop grace period.

## Build and development

```sh
docker compose up --build -d app web
docker compose logs -f app web
```

Static assets are mounted for immediate editing. Rebuild for Go, dependencies,
Dockerfile, or Nginx configuration changes. Go modules are pinned in `go.mod` and
`go.sum`; bluemonday supplies the article sanitizer. No frontend install/build is
required. Stop services with `docker compose down`.

## Verification status and next pass

Native Go formatting, vet, tests and build pass. The Linux race target covers
session concurrency and all Go packages. Synthetic TLS tests cover authentication,
CSRF/Origin, secure cookies, feed/search/saved reads, hidden pagination, write
success/rejection/expiry and briefing presentation. Sanitizer tests reject active
markup and tracking elements. Ten Chromium smoke tests cover the reader flows
without contacting NewsBlur. Four isolated Compose checks include auth burst limits.

Browser checks require Node 24+ and Python on PATH:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
```

CI installs Chromium with OS dependencies. The browser suite serves static assets
on `127.0.0.1:4173` and intercepts every API call with synthetic responses; unexpected
API routes fail and external requests are blocked. Go TLS tests separately check
real transport/handler behavior. These complementary tests are not installed-server
acceptance. Traces/screenshots are disabled by default; artifacts are ignored.

Remaining closure gates are in [acceptance](acceptance.md). The user confirmed
preview sign-in and installed Daily Briefing with local AI. Exact deployed version,
reader output against that installation, human accessibility, and final HTTPS/
upgrade/rollback exercise remain open. See [deployment](deployment.md).

## Local preview build, 2026-11-13

`docker compose up --build -d app web` built both current images and started
healthy Go/Nginx containers at `http://localhost:8080`. HTTP smoke checks returned
200 for the reader page, both health endpoints, anonymous `/api/session`, all
reader JavaScript/CSS modules, and the public third-party notice bundle. Session
bootstrap supplied a CSRF token and an HttpOnly cookie; values were not recorded.
Authenticated NewsBlur reading, browser interaction, and the full behavioral
test pass remain unverified. The preview stack is left running for inspection.

## Third-party notice maintenance

After Go module or attribution changes, run `go mod download all`, then
`python scripts/update_notices.py`. Check freshness with
`python scripts/update_notices.py --check`. The generator copies full license,
notice, and patent files into `licenses/`, records SHA-256 digests, and builds
`web/third-party-notices.txt`. Review new terms before incorporating new code.
See [reuse review](open-source-reuse.md) and [notices](../THIRD_PARTY_NOTICES.md).

## Sign-in repair, 2026-11-13

The container rejected the installed self-signed certificate before submitting
login. The local trust configuration above fixes that connection failure, and
certificate failures now return a specific `upstream_tls` error without request
details. Both preview services were rebuilt/restarted and are healthy.

Native formatting, vet, all existing Go tests and build passed, as did the Linux
race target, static security test, both Compose configuration checks, and three
isolated proxy/session integration tests. New synthetic TLS tests cover private
certificate trust, login form/CSRF forwarding, reader session/token rotation,
authenticated feed access, logout, untrusted certificate rejection, and rejection
of invalid reader CSRF before upstream access. No real credentials were used.
Broader expiry, hostile HTML, reading behavior, and browser acceptance coverage
remain open. The user confirmed successful preview sign-in on 2026-11-13; authenticated
reading and installed session lifecycle acceptance remain open.
