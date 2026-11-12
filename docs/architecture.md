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
container versions aligned when changing the baseline. The frontend framework
is not chosen or installed yet; Svelte/TypeScript is a candidate, not a dependency.

## Current request flow

```text
Browser -> Nginx :8080
            /                 -> static web/ files
            /healthz          -> Nginx liveness (plain text)
            /api/healthz      -> Go app:8090/healthz (JSON)
            /newsblur/*       -> configured NewsBlur origin (prefix stripped)
```

The direct NewsBlur proxy is an early development tool. It is not a completed
login design. Go currently provides lifecycle/configuration and health only;
it does not yet call NewsBlur. As each feature is implemented, explicit Go
endpoints will own its authentication, transport, and response adaptation.
Remove corresponding temporary paths when superseded rather than maintaining
two implementations. Do not build an unrestricted user-configurable proxy.

## Repository layout

```text
cmd/reader/              executable wiring, process signals, server settings
internal/config/         environment loading and validation
internal/httpserver/     routing and HTTP lifecycle; tests beside implementation
web/                    static development page; future reader assets
nginx/                  entry-point configuration template
tests/                  mock upstream and cross-service integration tests
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
universal project skeleton. Packages such as `internal/newsblur` or
`internal/session` should appear only when implemented behavior needs them.
Avoid empty layers and a public `pkg` tree for private server code.

## Boundaries as features arrive

- HTTP handlers translate requests and responses; they do not absorb all logic.
- A NewsBlur client will own upstream HTTP behavior and response types.
- Session code will own authentication material and expiry, with isolated tests.
- The frontend will own layout and local interaction state; server data remains
  authoritative and failures must be visible to the reader.

Create an interface at a real consumer boundary when needed. Do not require
interfaces, repositories, and services for every operation. One deployable Go
binary can remain modular through cohesive packages and small explicit APIs.
