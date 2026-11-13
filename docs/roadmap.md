# Roadmap

Status reflects delivered code, not aspirations. No dates are promised before
the installed NewsBlur capabilities and first reading flow are verified.
Work milestones in order; independent documentation and UI exploration can proceed
while an integration dependency is unresolved.

| Milestone | Status | Deliverable and exit criteria | Dependencies |
| --- | --- | --- | --- |
| M0 — Foundation | Complete | Go layout, focused AI rules, debugger configuration and CLI breakpoint smoke check, Nginx/Go services, health checks, native checks, Linux race tests, proxy integration, CI configuration, documentation | Editor-specific launch remains a developer setup check; see B04 |
| M1 — NewsBlur contract and session | In progress: session/reader source; validation pending | Confirm installed version and endpoints; document fixtures; login/logout, expiry and CSRF behavior tested end to end; no credentials in browser storage or logs | B02; authentication design and HTTPS/cookie checks |
| M2 — Core reading | Source in progress; validation pending | Folders/feeds with unread counts; paginated story list; readable sanitized story view; mark read/unread and save/unsave; failures preserve user context | M1; frontend choice (P01) |
| M3 — Daily Briefing | Source in progress; installed acceptance pending | Show NewsBlur-generated briefing and story links; handle pending, empty, unsupported, and failed states; settings use existing endpoints where available | M1; B03; basic story navigation from M2 |
| M4 — Polished reader | Presentation source in progress; validation pending | Keyboard navigation, responsive layouts, accessible focus/controls, themes and useful NewsBlur search/filtering; loading/error behavior reviewed | M2/M3; prioritized backlog |
| M5 — First usable release | Planned | HTTPS deployment guide; secure session and hostile HTML checks; browser smoke tests; reproducible container build and install/upgrade notes | M4; full CI and real-server acceptance |

## Definition of done

- A working user-visible behavior satisfies the milestone's acceptance criteria.
- Relevant tests and checks pass; unavailable checks are explicitly recorded.
- Documentation describes actual commands and limitations.
- The complete request and state flow has been reviewed, including failure paths.
- Superseded logic is removed; the change does not reimplement NewsBlur services.

See [blockers](blockers.md) for evidence and unblocking actions, and
[backlog](backlog.md) for smaller work items. Update these documents when the
corresponding work lands; do not leave completed work permanently listed as next.

M1 evidence and remaining acceptance checks: [NewsBlur contract discovery](newsblur-contract.md).

The 2026-11-13 source pass adds the login/session flow and the first reading UI.
Test execution is deferred for this larger implementation batch; no milestone
is newly complete. See [development status](development.md#verification-status-and-next-pass).

The [Go RSS reuse review](open-source-reuse.md) records imported reading-time
and keyboard code, pinned revisions, and license packaging. Behavioral/browser
validation remains pending; no milestone is newly complete.

Further reuse adds Shiori/Memos-derived appearance controls and linked-reading
presentation, plus candidate NewsBlur briefing/related-story read adapters. Summary
generation remains owned by NewsBlur; installed contracts and behavioral validation
remain open. No milestone is newly complete.
