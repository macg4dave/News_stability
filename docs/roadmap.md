# Roadmap

Status reflects delivered code, not aspirations. No dates are promised before
the installed NewsBlur capabilities and first reading flow are verified.
Work milestones in order; independent documentation and UI exploration can proceed
while an integration dependency is unresolved.

| Milestone | Status | Deliverable and exit criteria | Dependencies |
| --- | --- | --- | --- |
| M0 — Foundation | Complete | Go layout, focused AI rules, debugger configuration and CLI breakpoint smoke check, Nginx/Go services, health checks, native checks, Linux race tests, proxy integration, CI configuration, documentation | Editor-specific launch remains a developer setup check; see B04 |
| M1 — NewsBlur contract and session | Next | Confirm installed version and endpoints; document fixtures; login/logout, expiry and CSRF behavior tested end to end; no credentials in browser storage or logs | B02; authentication design and HTTPS/cookie checks |
| M2 — Core reading | Planned | Folders/feeds with unread counts; paginated story list; readable sanitized story view; mark read/unread and save/unsave; failures preserve user context | M1; frontend choice (P01) |
| M3 — Daily Briefing | Planned, discovery in M1 | Show NewsBlur-generated briefing and story links; handle pending, empty, unsupported, and failed states; settings use existing endpoints where available | M1; B03; basic story navigation from M2 |
| M4 — Polished reader | Planned | Keyboard navigation, responsive layouts, accessible focus/controls, themes and useful NewsBlur search/filtering; loading/error behavior reviewed | M2/M3; prioritized backlog |
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
