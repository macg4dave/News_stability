# Release acceptance

Local checks use synthetic data only. Passing them does not establish the
installed NewsBlur version, browser compatibility, or human accessibility.
Record the release revision, date, operator, environment, and evidence for each
installed check below. Keep credentials and private stories out of this document.

## Local verification

Desktop UI follow-up, 13 November 2026: mobile-specific presentation and test
sizes removed by product decision. 59 synthetic browser tests, 9 shipped-container
tests, and the static security check pass. The 36-image gallery now uses 1024px
and 1440px desktop windows. Search/filter changes are recorded in the
[UI roadmap](ui-roadmap.md). These results do not repeat the broader Go, licensing,
or installed-account checks described in the earlier run below.

Latest local run: **13 November 2026, working-tree build** on Windows with
Docker Linux containers. Go formatting/vet/tests/build and Linux race tests
passed; **57 Chromium tests**, one static security test and **four isolated
integration tests** passed. The 36-image gallery was generated and all three
desktop layouts were visually inspected in light/dark/paper, with phone article
samples also reviewed. All local documentation links resolve.

The default preview was rebuilt and both services report healthy at
`http://localhost:8080`. All **21 packaged app license files** and the public
notice bundle match the source; the served preview bundle matches too. No
installed-account checks were performed. CI now includes the visual gallery
artifact and packaging audit; the remote CI run itself is not claimed here.
The latest image/dot update adds confirmed filled/hollow indicators, relative
NewsBlur proxy/thumbnail handling, safe fallback candidates and lazy/relative HTML
images. Go fixtures check authentication, upstream cookies, raster types, byte
limits, redirect rejection, signed path validation and sanitized presentation.

Follow [the testing rules](ai/testing.md). Run Go formatting, vet, tests and build,
the Linux race-test image, Chromium tests, Python security tests, Compose config
and the isolated integration suite. Use a distinct integration project name
when the preview is running. Check notices with:

```sh
go mod download all
python scripts/update_notices.py --check
npm run review:ui
python scripts/check_packaged_notices.py
```

The visual command writes `.local/ui-review/index.html`, a manifest, and 36
screenshots: three layouts, three themes, two desktop window sizes, collection/open article.
It uses synthetic API fixtures, blocks external traffic, checks horizontal
overflow and browser exceptions, and leaves the preview/account untouched.
Review images visually; screenshots alone do not prove accessibility.

Check `/third-party-notices.txt` against the generated source bundle. Inspect
both built images without the development bind mount: the web image must contain
the public bundle and the Go image must contain the full license directory and
manifest. Select an explicit first-party license before public distribution;
third-party notices do not license the rest of this project.
The packaging command expects the default Compose image names after a build;
use `--app-image` and `--web-image` for other tags. It runs isolated containers
without network access or development mounts and compares every manifest file.

## Installed-server gate — open

Use a dedicated NewsBlur acceptance account with invented feeds/stories, not
an ordinary account. The operator supplies or authorizes that environment.

- Record the installed NewsBlur version/revision and intended browser versions.
- Verify login/logout/expiry and source scopes: folders, feed, saved, briefing,
  unread filtering, and search. Account-limited/unsupported capabilities must
  explain their state. Briefing generation remains NewsBlur's responsibility.
- In all layouts, load several batches through the last story. Check overlap,
  empty/hidden batches, long feeds, offline/resume and a failed continuation.
  Watch responsiveness and memory; there is no DOM virtualization or offline DB.
- Open and return from stories. List expands in place; Cards/Magazine focus the
  article. Selection, filters, focus and position must survive. Read writes and
  saved metadata must match NewsBlur, including failure and session expiry. The current UI uses
  automatic read writes when scrolling past seen stories or to an article's end;
  read/save buttons are removed. Confirm that unseen stories, opening/navigation,
  hidden tabs and offline browsing do not write, and failures pause until Refresh.
- Check lead/inline pictures, signed replacements, expired URLs, blocked hosts,
  and Pictures hidden. HTTP-only images without a secure replacement remain
  unavailable. Normal external image requests follow browser cookie settings.
  Verify the installed `/imageproxy` route and signing format, List thumbnails,
  full-image layout changes and fallbacks. The relay supports PNG/JPEG/GIF/WebP/AVIF;
  active SVG and unexpected responses are rejected. Confirm private-CA handling
  in Go, no upstream cookies in responses and no image requests when hidden.
- Verify full text against supported publishers and unavailable/paywalled
  examples. A failure keeps the feed content and original link. Record extraction
  limitations; the reader cannot supply text NewsBlur cannot extract.
- Verify timestamp instants against the installed server and browser timezone,
  including midnight/DST. Unknown legacy dates must not gain an assumed timezone.

## Human and deployment gate — open

- Complete keyboard-only and screen-reader review of navigation, date headings,
  status announcements, inline expansion/collapse, article controls and dialogs.
  Check focus visibility, 200% zoom/text, 320 CSS-pixel reflow and reduced motion.
- Review representative content in intended desktop browsers, including
  large text, CJK, right-to-left titles/body, missing metadata and failed pictures.
- Exercise the actual HTTPS ingress and private CA configuration. Confirm the
  correct public origin, Secure/HttpOnly session cookie, CSRF/origin rejection,
  no credential leakage and sign-out cleanup across tabs/session expiry.
- Retain previous image IDs and configuration securely. Upgrade to the candidate,
  verify health/sign-in/reading, then restore the previous images/configuration
  and verify recovery. Go sessions are in memory: restart requires sign-in.
  Never place secrets in the evidence record or remove NewsBlur data for rollback.

Release status remains **not approved** until these gates have recorded evidence.
