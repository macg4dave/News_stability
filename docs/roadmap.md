# Roadmap

Status reflects delivered behavior and evidence. Local implementation and
synthetic verification are recorded separately from installed-server acceptance.

| Milestone | Status | Deliverable and exit criteria | Remaining gate |
| --- | --- | --- | --- |
| M0 ? Foundation | Complete | Go layout, focused AI rules, debugger smoke check, Nginx/Go services, health, native/race/proxy checks and CI | Editor launch is a developer setup check; B04 |
| M1 ? NewsBlur contract and session | Implemented and locally verified; preview sign-in confirmed | Login/logout, absolute expiry, rotation, CSRF/Origin protection, private certificate trust, no browser credential storage | Installed version and final HTTPS/upstream session acceptance; B02 |
| M2 ? Core reading | Implemented and locally verified | Nested folders/counts, pagination including hidden pages, sanitized article view, explicit read/unread and save/unsave, preserved context on failure | Installed-account reading and action acceptance; B02 |
| M3 ? Daily Briefing | Reader locally verified; installed feature confirmed by user | NewsBlur summaries, source links, preview/disabled/empty/unsupported/error views | Verify reader output against installation; explicit generation-progress contract remains B03 |
| M4 ? Polished reader | Implemented with Chromium smoke coverage | Keyboard navigation, responsive layouts, focus/dialog controls, themes/fonts, NewsBlur feed search/unread filtering and saved reading | Human accessibility/contrast and intended-browser acceptance |
| M5 ? First usable release | Release tooling and guides delivered; acceptance open | HTTPS/deployment/recovery guide, secure-session/hostile-HTML tests, browser smoke tests, locked dependencies and pinned base digests | Full CI execution, installed acceptance and operator HTTPS/upgrade/rollback exercise |

## Delivered in the 2026-11-13 closure pass

- Added explicit read/unread and save/unsave actions. State changes only after
  NewsBlur confirms success; failures preserve the article and are never retried
  automatically. Refresh reloads authoritative story state and feed counts.
- Added NewsBlur-backed feed search, unread filtering across pagination, and a
  saved-stories view. No reader search index, story database, or generation service.
- Verified synthetic TLS login, invalid login, session/token rotation, logout,
  CSRF/Origin rejection, HTTPS cookie policy, absolute expiry, concurrent login,
  sanitized feed/briefing output, hidden-page continuation and rejected writes.
- Added ten Chromium browser smoke tests covering reading/actions, pagination,
  failure context, filtering, expiry cleanup, appearance persistence, keyboard
  guards, mobile layout, related stories, refresh and collapsed folders.
- Added authentication burst protection, browser checks in CI, pinned container
  base digests, and [deployment/recovery](deployment.md) guidance. Package installs
  inside container builds still use Alpine repositories; bit-for-bit reproducibility
  is not claimed.
- Preserved [third-party notices](../THIRD_PARTY_NOTICES.md) and license packaging.
  Browser tooling is development-only; the frontend still has no bundling step.

The user confirmed preview sign-in and that installed Daily Briefing works using
local AI, which can take longer to generate. The exact installed version is not
known. The reader displays NewsBlur output and allows manual refresh; an empty
response is not evidence that generation is in progress.

## Remaining closure work

Use the [installed acceptance checklist](acceptance.md), with a dedicated account
and synthetic content. Record the deployed NewsBlur version/image, verify reading
and explicit actions, confirm the reader's briefing output, and exercise final
HTTPS/session/deployment behavior. Human accessibility and intended-browser review
remain release checks. These gates cannot be replaced by mock success or marked
complete from a report that the server runs ?latest?.

See [blockers](blockers.md), [backlog](backlog.md),
[contract evidence](newsblur-contract.md), and [verification status](development.md#verification-status-and-next-pass).

## Definition of done

- User-visible behavior satisfies the milestone's acceptance criteria.
- Relevant checks pass; unavailable or unperformed checks are explicit.
- Documentation describes actual commands and limitations.
- Complete request/state flows and failure paths have been reviewed.
- Superseded paths are removed; NewsBlur remains the source of truth.
