# Development notes

## Services and configuration

See [architecture](architecture.md) for package boundaries and
[debugging](debugging.md) for native execution and breakpoints.

| Setting | Default | Consumer |
| --- | --- | --- |
| `WEB_PORT` | `8080` | Compose; Nginx published on loopback |
| `NEWSBLUR_ORIGIN` | `http://news101.lan` | Nginx template; no trailing slash |
| `HTTP_ADDR` | `127.0.0.1:8090` natively; `:8090` in Compose | Go process; Compose sets the container value explicitly |

Only Compose automatically reads the root `.env` file. Native Go reads process
environment variables. `NEWSBLUR_ORIGIN` is currently used by Nginx, not Go;
move its validation to Go when the upstream client is implemented.

Nginx serves `/healthz` as plain-text liveness. `/api/healthz` forwards to Go's
JSON `/healthz`. Neither endpoint authenticates to or probes NewsBlur. The Go
container runs as a non-root user without a published host port. Nginx waits for
Go's health check before starting. Shutdown allows 10 seconds for Go requests to
drain, within Compose's 15-second stop grace period.

## Development proxy

The browser loads static reader assets from Nginx. Requests under `/newsblur/`
are forwarded to `NEWSBLUR_ORIGIN` with the prefix removed. For example,
`/newsblur/reader/feeds` reaches `http://news101.lan/reader/feeds` by default.
Query strings and request bodies are preserved. Cookie domains are rewritten to
the reader host and paths are scoped to `/newsblur/`.

The existing NewsBlur deployment is managed separately. If `news101.lan` is
instead intended as the reader hostname, change `NEWSBLUR_ORIGIN` to the actual
NewsBlur server and configure DNS and the Compose port binding accordingly.

This passthrough is temporary. Future explicit reader API endpoints live in Go;
see the [roadmap](roadmap.md), [backlog](backlog.md), and
[blockers](blockers.md) for the implementation sequence and dependencies.

## API references

- https://www.newsblur.com/api
- https://github.com/samuelclay/newsblur

The documented API supports cookie sessions via `POST /api/login` and
`POST /api/logout`. Initial reads use `GET /reader/feeds` and
`GET /reader/feed/:id`. Confirm endpoints and response shapes against the installed
server version. Do not assume newsblur.com and the LAN server run the same version.

Use browser requests with credentials enabled. Do not store passwords or session
cookies in localStorage. Before implementing login, verify CSRF, trusted origins,
cookie Secure/SameSite flags, redirects, and HTTPS behavior through the proxy.
The proxy does not bypass upstream authentication or CSRF protection. Cookies
marked Secure by an HTTPS upstream require HTTPS on the reader as well.

## Configuration changes

Nginx templates are copied into the image: rebuild after editing them. Static
files are mounted by the development service. `.env` is local and ignored by Git.
No real credentials or feed content should be added to test fixtures.

Rebuild Go changes with `docker compose up --build -d app web`. The runtime image
does not contain a debugger; use native Go debugging for fast iteration. CI checks
formatting, vet, race-enabled tests, build, Compose configuration, and isolated
cross-service integration. Update `go.mod`, `Dockerfile.reader`, and documentation
together when changing the minimum Go version. No `go.sum` is needed until a
third-party module is added.
