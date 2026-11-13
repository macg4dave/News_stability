# Installed-server acceptance

Use a dedicated test account with synthetic subscriptions and stories. Keep its
credentials in the browser/password manager, outside Git, shell arguments, and
chat. Routine automated tests use local synthetic servers and never NewsBlur.
Do not use real account data or change real story state merely to pass tests.

Record only scenario, source/image revision, deployed NewsBlur version, status,
and pass/fail. Never attach raw API responses, cookies, or story content.

| Gate | Evidence so far | Remaining acceptance |
| --- | --- | --- |
| Installed identity | HTTPS origin and reader-local certificate trust verified | Operator records deployed NewsBlur version/image/commit; ?latest? is not an exact identity |
| Login | User confirmed preview sign-in on 2026-11-13; TLS synthetic success/failure tests pass | Dedicated-account invalid login, refresh, logout and re-login through final HTTPS origin |
| Session safety | Synthetic rotation, concurrent login, absolute expiry, CSRF/Origin and Secure cookie checks pass | Confirm installed upstream expiry/revocation and logout behavior; browser cookies on final HTTPS origin |
| Core reading | Synthetic folders, sanitized story page, hidden-page continuation and browser navigation pass | Dedicated-account folders/counts, first/next/previous page and original links |
| State writes | Synthetic allowed actions, CSRF, rejection, uncertain result and no retries pass | On synthetic stories: read/unread and save/unsave, refresh and verify in NewsBlur |
| Search and saved reading | Browser and Go tests cover encoded feed search, unread filtering, pagination and saved view | Verify installed search availability/account permissions and saved-story responses |
| Daily Briefing | Synthetic ready/disabled/empty/unsupported states, summary sanitization and source identity pass | User confirms installed Daily Briefing works with local AI; verify reader output and source links without invoking generation to make tests pass |
| Generation progress | Reviewed upstream read response has no explicit progress field | Verify installed read-only progress contract before claiming a pending state; never infer generation from emptiness |
| Presentation | Chromium desktop/mobile smoke tests cover keyboard/input guards, dialogs, appearance and failure context | Human keyboard/screen-reader review and intended browsers/themes; check real content layout without exporting it |
| Deployment | Pinned base digests, lockfiles, CI checks and HTTPS/recovery guide supplied | Operator exercises HTTPS, renewal, upgrade/rollback and final acceptance |

## Manual sequence

1. On the final HTTPS origin, verify the reader cookie has Secure, HttpOnly,
   SameSite=Strict, path `/`, and no Domain. Browser storage may contain appearance
   preferences only. Verify an invalid password fails without exposing details.
2. Sign in with the dedicated account, refresh, open nested folders, and paginate.
   An empty page containing hidden stories must still offer the next page.
3. Open a synthetic story, use each explicit reading action, refresh, and confirm
   state in NewsBlur. Selecting or moving between stories must not change state.
4. Search the selected feed, select unread, paginate, and open saved stories.
   Record account restrictions honestly; do not substitute a local search index.
5. Open Daily Briefing. Confirm supported/disabled/empty/ready behavior for that
   installation and follow an existing source story. Do not generate a briefing
   or change preferences solely to make acceptance pass.
6. Go offline during a page load; the article/page remains visible and the error
   offers a manual retry path. Expire/revoke the dedicated session upstream and
   confirm the next read clears account content and asks for sign-in.
7. Sign out. Confirm content clears, the old cookie cannot read, and refresh does
   not restore authentication. Repeat on mobile and with keyboard navigation.
8. Review visible focus, skip link, dialog focus/escape, zoom, screen-reader names,
   and light/paper/dark contrast. Confirm no horizontal overflow at small widths.
9. Exercise the deployment/rollback procedure using the intended HTTPS proxy;
   expect sign-in after restarts. Record results here or in a sanitized issue.

No milestone is complete solely because its synthetic tests pass. The roadmap
retains installed acceptance gates until the corresponding evidence is recorded.
