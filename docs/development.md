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
The LAN certificate remains unverified in this development session; providing a
configuration path is not evidence that the installed certificate chain is trusted.

## Request flow

Nginx serves static assets and plain-text `/healthz`. `/api/healthz` reaches the
Go JSON health handler. Other `/api/` routes preserve their paths and reach Go's
explicit reader endpoints. The old `/newsblur/` passthrough is removed. The browser
never receives NewsBlur cookies and never chooses an upstream URL.

`GET /api/session` bootstraps a session and CSRF token. Login/logout require the
reader cookie, `X-CSRF-Token`, and matching Origin. `GET /api/feeds` returns adapted
folder navigation; `GET /api/feeds/{id}/stories?page=1` returns a sanitized story
page. See [session design](sessions.md) for expiry and error semantics.

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

The larger source pass on 2026-11-13 intentionally defers test execution. Native
Go build, Go formatting, JavaScript syntax, and diff checks passed. Existing
health test callers and integration/static test sources were adapted to the new
routes; new session/CSRF/expiry/sanitizer/reading cases still need implementation
and execution. Earlier M0 and isolated-client test results do not validate this flow.

The next pass should run the [verification commands](ai/testing.md), add focused
TLS mock-upstream coverage for the complete auth/reading flow and hostile markup,
then perform browser review. The Compose integration stack uses an unreachable
synthetic origin and covers static/proxy/unauthenticated boundaries; it cannot
prove authenticated behavior. Never use real subscriptions or login credentials
as routine fixtures. Installed version and test-account acceptance remain B02.
