# Reader session design and current source

The source implements the following flow. New session, reading, sanitizer, and
browser behavior still need the combined test pass and installed-server acceptance.

1. `GET /api/session` creates or returns an anonymous reader session and CSRF token.
2. `POST /api/login` requires the configured reader Origin, the session cookie,
   and matching `X-CSRF-Token`. It accepts a bounded JSON username/password form.
3. A fresh NewsBlur client retrieves `/` to obtain upstream CSRF cookies, then
   submits `/api/login` with form encoding and upstream Origin/Referer/CSRF headers.
   Success requires the candidate result code and a NewsBlur session cookie.
4. Login replaces the anonymous reader ID and CSRF token. The browser receives
   only the opaque reader cookie; the upstream jar remains server-side.
5. Authenticated read routes adapt folders/feeds and story pages. Raw article HTML
   is excluded from the upstream story type's JSON and sanitized for presentation.
6. Logout removes the local session and cookie before contacting NewsBlur. An
   upstream logout failure explicitly reports local sign-out and unconfirmed
   upstream invalidation. A network failure before the browser receives that
   response is shown as an uncertain result, with no automatic retry.

## Lifetimes and cookies

Anonymous sessions expire after 15 minutes, authenticated sessions after eight
hours. These are absolute reader limits, not NewsBlur's policy. Upstream cookie
expiry or explicit authentication failures can end the session earlier. Status
does not probe NewsBlur on every request; server-side revocation is discovered on
the next upstream read. Expired entries are removed on lookup/new-session creation.

There is one in-memory store, limited to 1,024 entries. Restart signs readers out.
There is no session database or cleanup worker. Expiry/restart drops local access;
it does not promise an upstream logout request. Sessions do not slide on reads.

Cookies are HttpOnly, host-only, path `/`, and SameSite=Strict. HTTPS public origins
use Secure and `__Host-reader_session`; explicit loopback HTTP development uses
`reader_session`. The server derives this policy from `PUBLIC_ORIGIN`, not forwarded
headers. Non-loopback public origins require HTTPS. Write requests require exact
Origin and CSRF matches; cross-site fetch metadata is rejected for reads and writes.

## Trust and deployment

`NEWSBLUR_ORIGIN` accepts a fixed HTTPS origin only. Redirects are surfaced as
failures. The Go client verifies certificates and hostnames. `NEWSBLUR_CA_FILE`
can add a PEM private CA to system roots without disabling verification. No
credentials belong in configuration, Git, logs, or browser storage.

The final reader origin must terminate HTTPS before non-loopback use. Preserve
browser Origin headers through the reverse proxy. The Nginx entry point forwards
only explicit `/api/` reader routes and no longer forwards `/newsblur/` requests.
Rate limiting and deployment/session security review remain release work; this
development implementation is not ready for public exposure.

Appearance preferences alone may persist in browser localStorage. Session, CSRF,
credentials, subscriptions, and article data are never persisted there.
