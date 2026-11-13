# Architecture and layout

## Scope and decisions

News Stability presents NewsBlur through a clean reading interface. NewsBlur
owns accounts, subscriptions, feed fetching, story storage, read state, saved
stories, classifiers, search, full-text extraction, and briefing generation.
We own reader presentation, navigation, session integration, and thin API adapters.
No reader database, background fetcher, or AI generation service is planned.

Go is the server language. Start with its standard library; no framework is
needed for the current service. Go 1.26 is the minimum baseline in `go.mod` and
the container; newer supported Go versions can be used locally. Keep CI and
container versions aligned when changing the baseline. The frontend uses native
JavaScript modules and CSS, with no bundler or framework; see [frontend](frontend.md).

## Current request flow

```text
Browser -> Nginx :8080
            /                 -> static web/ files
            /healthz          -> Nginx liveness (plain text)
            /api/healthz      -> Go app:8090/healthz (JSON)
            /api/*            -> Go reader adapters -> configured HTTPS NewsBlur
```

The temporary `/newsblur/*` passthrough has been removed. Explicit Go endpoints
own login/logout, cookie sessions, feed navigation, and story pages, explicit story-state actions, feed search and saved reading. Upstream
cookies stay in a per-reader server-side jar; the browser receives an opaque
reader session cookie and a CSRF token. Story HTML is sanitized before JSON output.
Synthetic TLS login/session tests and isolated proxy checks pass. Synthetic reading/action/briefing and Chromium smoke coverage pass;
installed-server acceptance remains open. See [sessions](sessions.md) and [contract
discovery](newsblur-contract.md). No unrestricted upstream proxy is exposed.

## Repository layout

```text
cmd/reader/              executable wiring, process signals, server settings
internal/config/         environment loading and validation
internal/httpserver/     routing and HTTP lifecycle; tests beside implementation
internal/newsblur/       fixed-origin upstream transport and response types
internal/session/        bounded in-memory reader sessions and expiry
internal/article/        maintained HTML sanitizer and safe article links
web/                    reader HTML, JavaScript modules, and responsive CSS
nginx/                  entry-point configuration template
tests/                  static security and cross-service integration test sources
docs/ai/                focused contributor rules
docs/                   architecture, development, debugging, planning
.vscode/                native Go debugging and editor tasks
.github/workflows/      verification in CI
Dockerfile              Nginx image
Dockerfile.reader       Go build and non-root runtime image
compose*.yaml           local services and isolated integration stack
```

This follows the [official Go server layout guidance](https://go.dev/doc/modules/layout):
commands in `cmd`, application packages in `internal`. Go does not require a
universal project skeleton. Packages appear when implemented behavior needs them.
Avoid empty layers and a public `pkg` tree for private server code.

## Boundaries as features arrive

- HTTP handlers translate requests and responses; they do not absorb all logic.
- The NewsBlur client owns upstream HTTP behavior and response types.
- Session code owns authentication material and expiry; synthetic login/logout tests pass.
- The frontend owns layout and local interaction state; server data remains
  authoritative and failures must be visible to the reader.

Create an interface at a real consumer boundary when needed. Do not require
interfaces, repositories, and services for every operation. One deployable Go
binary can remain modular through cohesive packages and small explicit APIs.
