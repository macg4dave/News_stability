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
mock-upstream tests; those new full-flow cases remain pending. Never use real login credentials,
subscriptions, read state, or briefings as routine fixtures. Documentation-only
changes require link/command consistency review, not new tests mirroring prose.
