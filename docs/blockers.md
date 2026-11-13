# Blockers and unverified dependencies

An unverified dependency is not a confirmed server defect. Record evidence before
changing its status. Remove or close entries when resolved and update the roadmap.

| ID | Status | Evidence / uncertainty | Impact | Unblocking action / owner |
| --- | --- | --- | --- | --- |
| B01 | Resolved | Docker initially reported a missing engine pipe; subsequently became available. Nginx/Go builds and the isolated proxy/session integration suite passed | Container validation no longer blocks M0 | Re-run the documented checks after container/proxy changes |
| B02 | Unverified dependency | HTTPS origin confirmed on 2026-11-12; HTTP returns 404. HTTPS welcome page and public briefing calls inspected, the preview now trusts the installed self-signed certificate through a reader-local PEM mount. Verified Go anonymous preparation on the Compose network. User confirmed successful preview sign-in on 2026-11-13. Installed version, authenticated reading responses, and session lifecycle policy remain unverified | Blocks final installed API/session acceptance for M1, not isolated implementation | Contributor with access: verify authenticated reading and session lifecycle, record server version, inspect endpoints with a synthetic test account; see [contract discovery](newsblur-contract.md) |
| B03 | Unverified feature dependency | User confirmed installed Daily Briefing works using local AI on 2026-11-13, with potentially slower generation. Installed public JavaScript references `/briefing/stories` and `/briefing/generate`, and upstream grouped-summary/curated-story/cluster shapes were inspected at `9aae0792a92e9ba6a329e41ee80db8dae246631e`; reader adapters and synthetic presentation checks pass, but reader output and a read-only generation-progress contract remain unverified | Blocks closing M3 installed reader/progress acceptance | Contributor: verify reader briefing output and source links; identify an explicit read-only progress signal before implementing pending state |
| B04 | Resolved for CLI; editor launch unverified | Installed Delve 1.27.2 in the Go bin directory; hit the health-handler breakpoint, inspected `r.Method`, continued, and received a successful response | CLI debugging is verified; supplied VS Code configuration still needs an editor launch on the developer's machine | Use the Go extension to locate/install Delve if the Go bin directory is not on PATH |

Earlier foundation/isolated-client verification: native formatting, vet, unit tests,
build, and health smoke check passed. These results predate the larger session/reader source pass. The
Windows environment has CGO disabled; the Linux Docker test target successfully
ran `go test -race ./...` with the Go 1.26 baseline instead.

The 2026-11-13 sign-in repair established reader-local trust and verified anonymous
Go preparation against the installed HTTPS origin. Native checks, Linux race tests,
synthetic TLS login/session tests, and isolated Compose boundary tests pass.
The user confirmed preview sign-in. Synthetic reading/action/briefing, sanitizer,
session-concurrency and ten Chromium smoke tests now pass. Installed reading/session
acceptance and human accessibility remain open; see [acceptance](acceptance.md).
See [development](development.md#sign-in-repair-2026-11-13).

## Recording new blockers

Include the failing operation or missing fact, observed evidence, affected
milestone, what can proceed, and a concrete next action. Keep credentials and
private responses out of the record. Do not mark a feature complete just because
an isolated mock works; real-server acceptance is a separate verification step.
