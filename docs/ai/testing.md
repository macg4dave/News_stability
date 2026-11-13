# Verification rules

Run checks appropriate to changed behavior. For Go changes:

```sh
go fmt ./...
go vet ./...
go test ./...
go build ./...
```

Formatting must leave no differences. CI checks it explicitly. Run
`go test -race ./...` for concurrency work and in Linux CI; local Windows race
testing requires a compatible C compiler. Report unavailable checks accurately.
Without a local C toolchain, run the supplied Linux race-test image target:
`docker build --target test -f Dockerfile.reader .`.

Test observable contracts and failure cases, not private function structure.
Use table-driven tests where cases share a meaningful contract. Prefer `httptest`
for HTTP boundaries and synthetic data for upstream calls. Avoid sleep-based
synchronization, live LAN dependencies, redundant assertion-only tests, and
coverage quotas. Add a regression test for meaningful repaired behavior.

For proxy or container changes:

```sh
python -B -m unittest discover -s tests -v
docker compose config --quiet
docker compose -f compose.yaml -f compose.test.yaml --profile test config --quiet
docker compose -f compose.yaml -f compose.test.yaml --profile test run --build --rm integration
docker compose -f compose.yaml -f compose.test.yaml --profile test down
```

The Compose integration suite uses an unreachable synthetic origin and checks
static/proxy/unauthenticated boundaries. Authenticated behavior belongs in Go TLS
mock-upstream tests covering login, reading, actions and briefing presentation. Never use real login credentials,
subscriptions, read state, or briefings as routine fixtures. Documentation-only
changes require link/command consistency review, not new tests mirroring prose.

For reader UI changes, run the synthetic Chromium smoke suite:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
```

It requires Node 24+ and Python, serves local static assets, blocks external
requests and supplies synthetic API responses. CI uses Playwright's
`install --with-deps chromium` on Linux. Never attach real browser sessions or
credentials to this routine suite. See [installed acceptance](../acceptance.md)
for the separate operator checks. Use a distinct Compose project name when
running integration checks alongside an active preview.
