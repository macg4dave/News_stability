# Go coding rules

## Official foundations

- [Module and server layout](https://go.dev/doc/modules/layout)
- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments)
- [Standard library documentation](https://pkg.go.dev/std)

Effective Go covers core idioms but explicitly predates modules and generics;
use current documentation for modern APIs. The rules below combine that guidance
with this project's decisions; Go does not prescribe one universal architecture.

## Layout and packages

Use `cmd/reader` for executable wiring and `internal/` for application packages,
following the official server-layout guidance. Put tests beside the behavior
they verify. Add directories when real code needs them, not as an empty template.
Do not add `src/`, a public `pkg/` tree, or separate modules without a real need.
The local module name is `newsstability`; change it consistently if publishing
under a confirmed repository URL.

Use short, specific package names. Avoid `utils`, `common`, `helpers`, and `base`.
Keep executable wiring free of reader business logic. Default to unexported
identifiers; expose only what another package needs.

## Language and APIs

Let `gofmt` format code. Use clear names, normal Go initialisms (`HTTP`, `URL`,
`ID`), and doc comments for exported declarations. Keep the successful path easy
to follow through early error returns. Prefer ordinary structs and functions;
use generics only when they remove meaningful repeated type-independent logic.

Return errors for expected failures. Add useful operation context with `%w` when
callers need the cause; use `errors.Is`/`errors.As` rather than matching strings.
Handle errors at the layer that can act; avoid logging and returning the same
error at every level. Do not panic or call `log.Fatal` inside application packages.

Accept `context.Context` first for cancellable work and propagate request
contexts to upstream calls. Pass dependencies explicitly. Prefer concrete types;
define small interfaces where a consumer actually needs a boundary, not merely
to manufacture mocks. Make goroutine ownership and termination visible.

## Server decisions

Start with the standard library: `net/http`, `log/slog`, `encoding/json`, and
`testing`. Add a dependency when it solves a concrete problem better, especially
security-sensitive tasks such as HTML sanitization; do not hand-roll those.

Configure HTTP timeouts and bounded request/response sizes when adding endpoints.
Reuse HTTP clients/transports, close response bodies, and check HTTP status before
decoding. Make retry behavior explicit; never blindly retry state-changing calls.
Validate configuration once at startup. Keep secrets out of errors and logs.
Use graceful shutdown with a deadline. Do not expose diagnostic handlers on the
public application mux.

Before changing Go behavior or tests, follow [Go test design](go-testing.md)
for test placement, assertions, fixtures and deterministic concurrency.
See [design](design.md) for whole-flow review and [verification](testing.md) for commands.
