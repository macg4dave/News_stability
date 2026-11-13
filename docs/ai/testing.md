# Verification rules

For Go test placement, case selection, HTTP fixtures, assertions and concurrency,
read [Go test design](go-testing.md). These are required companion rules for Go
code and test changes. This file owns commands and verification scope.

The complete automated gate is `npm test` after `npm ci --ignore-scripts` and
`npx playwright install chromium`. It requires Go, Python, Node 24+, and Docker
with Linux containers. It checks formatting, vet, Go tests/build, Linux race
tests (in Docker on Windows), notices, static security, browser contracts, and
the built Docker application. CI runs the same command on pushes and PRs.
No screenshot or AI visual judgment determines pass/fail.

Run `npm run test:e2e` for just the shipped-app tests. The runner creates a
separate Compose project with dynamically selected loopback ports, builds the
actual Go/Nginx images without development mounts, and starts a synthetic
NewsBlur HTTPS server. Go verifies its ephemeral certificate; no real account
or LAN upstream is used. The runner removes its containers and certificate
volume on completion and prints synthetic container logs on failure.

These tests never mock reader API/image responses. Chromium must decode images
with nonzero natural dimensions through Nginx, Go, and the TLS upstream. Checks
cover Cards/Magazine/List at desktop window sizes, inline full text, picture hiding,
404 and invalid-image responses, pagination, read success/failure, logout, and
session expiry. JUnit failures are saved to `test-results/e2e.xml`. The optional
`review:ui` gallery is a design aid, not an acceptance gate. Synthetic upstream
contracts still cannot establish compatibility with the installed NewsBlur
version; keep that separate evidence in the acceptance checklist.

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

The older Compose integration suite uses an unreachable synthetic origin and checks
static/proxy/unauthenticated boundaries. Authenticated behavior is covered by Go TLS
mock-upstream tests and the shipped-app suite above. Never use real login credentials,
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
