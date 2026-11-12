# Blockers and unverified dependencies

An unverified dependency is not a confirmed server defect. Record evidence before
changing its status. Remove or close entries when resolved and update the roadmap.

| ID | Status | Evidence / uncertainty | Impact | Unblocking action / owner |
| --- | --- | --- | --- | --- |
| B01 | Resolved | Docker initially reported a missing engine pipe; subsequently became available. Nginx/Go builds and the isolated proxy/session integration suite passed | Container validation no longer blocks M0 | Re-run the documented checks after container/proxy changes |
| B02 | Unverified dependency | Installed NewsBlur version, authenticated API responses, and session policy have not been inspected | Blocks final API/session contract for M1, not isolated implementation | Contributor with access: record server version, inspect endpoints and synthetic/redacted responses; use credentials outside Git |
| B03 | Unverified feature dependency | Upstream NewsBlur has briefing support; availability and endpoint contracts on `news101.lan` are not yet verified | Blocks committing to full M3 functionality | Contributor: inspect installed briefing routes, settings, dependencies, and availability during M1; document graceful unsupported state |
| B04 | Resolved for CLI; editor launch unverified | Installed Delve 1.27.2 in the Go bin directory; hit the health-handler breakpoint, inspected `r.Method`, continued, and received a successful response | CLI debugging is verified; supplied VS Code configuration still needs an editor launch on the developer's machine | Use the Go extension to locate/install Delve if the Go bin directory is not on PATH |

Native formatting, vet, unit tests, build, and health smoke check passed. The
Windows environment has CGO disabled; the Linux Docker test target successfully
ran `go test -race ./...` with the Go 1.26 baseline instead.

## Recording new blockers

Include the failing operation or missing fact, observed evidence, affected
milestone, what can proceed, and a concrete next action. Keep credentials and
private responses out of the record. Do not mark a feature complete just because
an isolated mock works; real-server acceptance is a separate verification step.
