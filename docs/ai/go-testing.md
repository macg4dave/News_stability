# Writing useful Go tests

Read this file before adding, changing, or reviewing Go behavior or tests.
[Verification](testing.md) owns commands and CI; this file owns test design.
Use the standard `testing` package and `net/http/httptest` by default.

## Choose the owner and the boundary

Put `*_test.go` files beside the Go code they verify. Name files by the behavior
or source file, for example `images_test.go` beside `images.go`. Do not move
package tests into a top-level `tests/go` tree or create a separate Go module.

| Behavior | Where to put the test | What the test should exercise |
| --- | --- | --- |
| Configuration validation | `internal/config/*_test.go` | Valid defaults, rejected inputs, injected environment lookup; no host environment dependency. |
| NewsBlur transport and decoding | `internal/newsblur/*_test.go` | Real client against a synthetic TLS server: request contract, response adaptation, limits and failures. |
| Sessions | `internal/session/*_test.go` | Isolation, expiry, rotation, capacity, invalidation and relevant concurrent operations. |
| Sanitized article presentation | `internal/article/*_test.go` | Useful content preserved, active content removed, safe links and deferred image attributes. |
| Reader HTTP API | `internal/httpserver/*_test.go` | Real handler, session and upstream client together: status, JSON, cookies, headers, authorization and state changes. |
| Executable configuration/wiring | `cmd/reader/*_test.go`, only when needed | Process-specific behavior; keep reader logic in `internal/` and test it there. |
| Browser rendering and interactions | `tests/browser/*.spec.cjs` | Fast, synthetic UI contracts. These mocks cannot verify Go or proxy behavior. |
| Browser through shipped Nginx/Go images | `tests/e2e/*.spec.cjs` | Real API/image requests to the synthetic TLS upstream, actual decoding, layout and user-visible state. |

Prefer an external test package such as `package httpserver_test` for public
contracts. The same package is appropriate when a meaningful invariant needs
internal access, as in session expiry tests. Do not export production symbols
just for tests or assert private field layout and helper call sequences.
Keep fixtures in the test file until reuse or size justifies package-local
`testdata/`. Go ignores `testdata` directories when discovering packages.

## Start with an observable failure

Before implementing a fix, state the trigger and expected outcome. Add a
regression that fails for the actual defect, then make the repair and run it
again. If the defect cannot be reproduced, report that gap; a passing nearby
test is not evidence that it was fixed. Do not relax assertions to obtain green.

Test behavior that matters to a caller: returned values, error classification,
requests made or prevented, state retained or discarded, and response contents.
Expected results must come from the contract, not by calling the production
function again or copying its algorithm into the test.

Cover the successful path and the relevant failure boundaries. For network
changes, consider rejected input, unauthenticated/expired sessions, malformed
JSON, upstream rejection, redirects, response-size limits, cancellation and
in-flight work after logout. Select cases affected by the change; do not add
every possible scenario to every test or chase a coverage percentage.

A security rejection needs a valid positive control: prove that the legitimate
request succeeds as well as that the unsafe request is denied. A test where all
requests are broken must fail. For rejected writes, check unchanged state and
that no upstream write was issued. For successful writes, check the intended
state and request count so unintended retries cannot pass unnoticed.

## Write clear, independent cases

Use descriptive `Test...` names and `t.Run` names describing the condition and
outcome. Table-driven tests suit several inputs sharing one contract; use
separate tests for different workflows. Keep setup, action and assertions easy
to distinguish. Prefer direct assertions over a new testing framework.

```go
func TestValidStoryHash(t *testing.T) {
    for _, tc := range []struct {
        name string
        input string
        want bool
    }{
        {"feed and digest", "1:abc", true},
        {"missing digest", "1:", false},
        {"URL instead of identity", "https://example.invalid/story", false},
    } {
        t.Run(tc.name, func(t *testing.T) {
            if got := ValidStoryHash(tc.input); got != tc.want {
                t.Errorf("ValidStoryHash(%q) = %v; want %v", tc.input, got, tc.want)
            }
        })
    }
}
```

This example belongs to `package newsblur`; adapt the pattern rather than adding
a duplicate of existing coverage. Check setup errors before using results.
Use `t.Fatal`/`t.Fatalf` when continuing would invalidate later assertions;
use `t.Error`/`t.Errorf` for independent mismatches. Give failures enough context
to diagnose safely. Use `errors.Is`/`errors.As` for error contracts; do not pin
incidental error wording. Decode JSON and inspect fields rather than comparing
key order. Inspect relevant HTML structure/attributes instead of serialization
whitespace, unless exact output is itself the contract.

Helpers that can fail must call `t.Helper()`. Keep them local and small; reuse
existing helpers such as `trustedClient` and `loggedInReader` where appropriate.
Do not build a configurable fake framework to avoid a few lines of clear setup.
Use `t.Cleanup` for resource lifetimes and `t.TempDir` for files. Use synthetic
identities and `.invalid` publisher hosts; never copy real stories or secrets.

## Test HTTP using the real boundary

For handler-only contracts, `httptest.NewRequest` and `httptest.NewRecorder`
are sufficient. Use a test server and real `http.Client` when cookies,
redirects, transport, cancellation or concurrency matter. For NewsBlur use
`httptest.NewTLSServer`, trusting its certificate through the client's existing
CA configuration; do not disable TLS verification or replace production HTTPS
with HTTP to make the test easier.

Assert the relevant method, path, query/form fields, CSRF and session behavior
at the upstream server, then return a representative response. Reject unexpected
routes. Test non-200 statuses, malformed bodies and application-level failures
separately when they have different meanings. Assert both the reader's response
and important side effects; an HTTP 200 alone proves little.

Use valid generated image bytes for successful transport fixtures and invalid
bytes for rejection cases. Go MIME checks alone cannot prove that a browser can
decode an image. If changing image presentation or proxy behavior, add or update
the shipped-app test that calls Chromium's `decode()` and checks natural image
dimensions. An `<img>` element, a mocked successful request, or a screenshot
review is not a substitute for that assertion.

## Keep time and concurrency deterministic

Never use `time.Sleep` to arrange a race, wait for a request, or expire a session.
Coordinate request start/release with channels and wait for owned goroutines
with a completion channel or `sync.WaitGroup`. Bound waits with a context or
timeout that reports a failure; a timeout is a safety limit, not synchronization.
Ensure cleanup releases blocked handlers before closing their test servers,
including on failed assertions. Prefer injected time when expiry behavior needs
it; avoid narrow wall-clock timing assertions.

An HTTP handler runs in a different goroutine. Do not call `t.Fatal`, `t.Fatalf`
or `t.FailNow` there. Record an error and return a failure response, or send the
result to the test goroutine and assert there. Synchronize shared counters and
fixture state. Add `t.Parallel()` only when each case owns its resources; never
combine it with shared mutable fixtures, process-wide environment changes or
assumptions about test order. Race detection complements assertions; a race-free
test can still have incorrect behavior.

## Run and report the relevant checks

While developing, run the focused package/case, for example:

```sh
go test ./internal/newsblur -run TestImageTransportBoundsTypesAndRedirects -count=1
```

`-count=1` forces execution instead of using a cached test result. Before handing
off Go changes, follow [verification](testing.md) for formatting, vet, tests,
build and Linux race checks, plus browser/container checks for affected flows.
For suspicious order/concurrency failures, use targeted `-shuffle=on` or repeated
`-count` runs to investigate; do not hide flakes behind retries. Fuzzing can help
with parsers and sanitizers when there is a meaningful invariant and bounded
input/work; retain minimized failures as regression seeds. Benchmarks belong
with a demonstrated performance question, not as a replacement for correctness.

Report which behavior was proved, commands/results, and remaining gaps. Routine
fixtures must remain independent of the LAN, installed NewsBlur and real accounts.
Installed compatibility still requires the separate acceptance evidence.
