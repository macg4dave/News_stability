# NewsBlur contract discovery

M1 discovery started on 2026-11-12. This is an evidence log, not a completed
authentication contract. No authenticated requests or state changes were made.

## Installed server observations

- The confirmed origin is `https://news101.lan`. Anonymous HTTP requests to `/`,
  `/api/`, and `/api/login` returned Nginx 404 pages; HTTP is not the API origin.
- HTTPS certificate verification failed in the native Windows client with
  `SEC_E_UNTRUSTED_ROOT`. One-off anonymous diagnostics bypassed verification;
  this does not establish a trusted application connection.
- Anonymous HTTPS `GET /` returned 200 and the NewsBlur welcome page.
- The landing response issued a CSRF cookie with `Path=/` and `SameSite=Lax`.
  Neither Secure nor HttpOnly appeared on that cookie. This observation says
  nothing about authenticated session-cookie flags or CSRF enforcement.
- Installed public JavaScript at
  `/media/js/newsblur/common/assetmodel.js` calls `GET /briefing/stories` with
  a page parameter and `POST /briefing/generate`. These are discovery leads;
  briefing availability, response shapes, and generation permissions remain unknown.
- No installed version or commit has been established. Obtain the deployed image
  tag/digest or source commit from the server operator rather than infer a version
  from marketing text or asset names.

Do not save raw landing HTML, cookie values, or authenticated payloads as fixtures.

## Candidate endpoint inventory

The [public API documentation](https://www.newsblur.com/api), reviewed on
2026-11-12, supplies these candidates. Each still needs installed-server acceptance.

| Reader operation | Candidate upstream request | Contract to verify |
| --- | --- | --- |
| Login | `POST /api/login` | Form encoding, success/failure shape, session cookie, CSRF |
| Logout | `POST /api/logout` | Invalidation, cookie clearing, repeated logout |
| Navigation | `GET /reader/feeds` | Nested folders, feed IDs, three unread counts, empty account |
| Stories | `GET /reader/feed/:id` | Pagination, story identity, HTML, read/saved flags |
| Read | `POST /reader/mark_story_hashes_as_read` | Required fields, batch response, failure behavior |
| Unread | `POST /reader/mark_story_hash_as_unread` | Required fields and failure behavior |
| Save / unsave | `POST /reader/mark_story_hash_as_starred`, `POST /reader/mark_story_hash_as_unstarred` | Required fields and failure behavior |
| Briefing | `GET /briefing/stories` (installed asset) | Pending, empty, unsupported, failed, and ready responses |

## Remaining acceptance work

1. Establish certificate trust on the host and in the reader container. The
   passthrough has now been removed; the Go client always verifies TLS and
   supports `NEWSBLUR_CA_FILE`. No trusted LAN CA has yet been supplied.
2. Record the installed version and inspect its route definitions, including
   briefing settings, without invoking generation or changing preferences.
3. Use a dedicated test account with synthetic subscriptions, outside routine
   tests. Keep credentials outside Git and command-line arguments.
4. Verify valid/invalid login, session expiry, logout, missing/invalid CSRF tokens,
   trusted origins, redirects, and Secure/HttpOnly/SameSite cookie behavior through
   the final reader origin. Do not infer CSRF policy from GET responses.
5. Capture only allowlisted response fields and replace all user identifiers,
   feed URLs, stories, and tokens with synthetic values before committing fixtures.
   Record endpoint, method, status, content type, installed version, and scenario.
6. Build isolated transport/session tests from those contracts, then repeat the
   acceptance flow against the test account. Mock success alone does not close M1.

The temporary `/newsblur/` passthrough is now removed. Login UI, reader sessions,
and reading adapters exist in source; their combined tests and installed-server
acceptance remain pending. See [session design](sessions.md).

## Go transport and reader integration

`internal/newsblur` now implements candidate login/logout calls. The candidate
application result (`code: 1` for success) is based on the
[upstream API implementation](https://github.com/samuelclay/NewsBlur/blob/master/apps/api/views.py),
reviewed on 2026-11-12; this is not proof of the installed server's contract.
Synthetic responses are defined inline in the transport tests, with no captured
user data. Installed public login JavaScript did not establish the API contract.

Each client owns one cookie jar and must be scoped to one reader session. It
uses a 15-second total timeout, a 16 KiB encoded form limit, and a 1 MiB response
limit. Only configured HTTPS origins are accepted. Normal certificate validation
stays enabled; no insecure TLS option is exposed. All redirects are returned as
status errors. Login/logout writes are not retried, and upstream bodies, URLs,
and credentials are excluded from error messages. Context errors remain inspectable.

Native tests cover encoded credentials, cookie retention/clearing and isolation,
rejected login, HTTP failures, malformed/oversized responses, request limits,
redirect rejection, cancellation, timeouts, and rejection of an untrusted CA.
The reader process now uses a fresh upstream jar per login attempt, bootstraps
CSRF cookies from `/`, and sends upstream Origin/Referer/CSRF headers on writes.
The candidate adapters accept the documented feed/folder and story-page shapes;
no private response fixtures have been captured. These implementation choices
still need installed-server acceptance, including token rotation and session policy.

The source pass on 2026-11-13 adds reader sessions, login/logout, feed/story routes,
a maintained HTML sanitizer, and the first responsive reader UI. Go build and
JavaScript syntax checks pass. Test execution for this larger slice is deferred;
the earlier transport tests do not establish correctness of the integrated flow.

## Briefing and linked-story source follow-up

Upstream source at commit `9aae0792a92e9ba6a329e41ee80db8dae246631e` was inspected
on 2026-11-13. `apps/briefing/views.py` returns `briefings` with `summary_story`
and `curated_stories`, plus `enabled`, `is_preview`, and `has_next_page` flags.
`apps/clustering/models.py` attaches `cluster_stories` metadata where available.
This is upstream evidence, not installed-version or account acceptance.

Candidate Go adapters now expose read-only `/api/briefing?page=1` and
`/api/stories/{hash}`. The latter uses `/reader/river_stories?h=...` and requires
the returned hash to match. Every response uses the common sanitized article
presenter. Related metadata is capped at 50 members; explicit hyperlinks at 100.
The reader never follows those URLs on the server. No source story database,
local clustering, summary generation, or briefing preference writes are added.

HTTP 404/405 briefing routes map to unsupported; disabled/empty responses are
presented explicitly. No pending-generation state is inferred from an empty
response. Login/session, briefing shape/availability, clustered-story permissions,
and browser behavior still need the deferred acceptance/test pass.
