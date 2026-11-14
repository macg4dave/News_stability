# Release acceptance

Local checks use synthetic data only. Passing them does not establish the
installed NewsBlur version, browser compatibility, or human accessibility.
Record the release revision, date, operator, environment, and evidence for each
installed check below. Keep credentials and private stories out of this document.

## Local verification

All feeds default and sidebar resizing, 14 November 2026: the complete `npm test`
gate passed Go formatting/vet/tests/build, Linux race checks, notices/static
security, 92 browser checks and 10 shipped-container checks. Fresh sign-in and
page reopen select All feeds; refresh and interrupted same-account resume retain
their current scope. Browser fixtures record startup river reads separately and
wait for explicit collection transitions before interacting with their stories.

New cases cover dragging and keyboard adjustment, remembered width after reload,
viewport bounds, reset, unavailable storage, aligned reading area and no read
writes from resizing. The shipped path verifies automatic All feeds selection and
keyboard resizing/reset under the actual CSP with no policy violations. The
36-image gallery was regenerated. Static changes are live through the preview
mount; no server restart or real account access was needed.


Independent sidebar scrolling, 14 November 2026: the complete `npm test` gate
passed Go formatting/vet/tests/build, Linux race checks, notices/static security,
89 browser checks and 10 shipped-container checks. New synthetic cases exercise
80 subscriptions in Cards, Magazine and List: the sidebar stays fixed during
main-page scrolling and at article end, its wheel scrolling leaves the main
position unchanged, edge scrolling does not chain into the page, and sidebar
wheel/keyboard gestures do not mark stories read. The existing read tests now
explicitly place the pointer over the main reading area when scrolling it.

The sidebar is keyboard-focusable, fills the viewport, and keeps its control row
visible. The reading grid and footer reserve its width. Static updates are live
through the preview mount; no server restart or real account access was needed.


Floating page tools, 14 November 2026: the full `npm test` gate passed Go
formatting/vet/tests/build, Linux race checks, notices/static security, 86 browser
checks and 10 shipped-container checks. New cases cover the transparent fixed
top-right group, header control clearance, click/keyboard return in Cards,
Magazine and List, keeping the current article open, no accidental read writes,
and normal/reduced-motion scrolling. The existing preview serves the static
changes immediately; no server restart or real account access was needed.


Space and consistency review, 14 November 2026: the full `npm test` gate passed
Go formatting/vet/tests/build, Linux race checks, notices/static security,
82 browser checks and 10 shipped-container checks. New geometry cases cover
1024/1440/1920/2560px: full collection width, adaptive card columns with 20rem
minimums, 1.25rem gaps, no horizontal overflow and no read writes from layout
changes. A wide-article check verifies lead-photo/text flow and return controls
below the floated photograph. The real shipped path checks 2560px collection
geometry and actual image decoding without additional logins.

The gallery now contains 36 images across four desktop widths, including portrait,
text-only and later-photo Magazine cases. Wide newspaper and article views were
visually inspected. Collections no longer use the 90rem cap; collection/article
padding shares the same gutter. Training follows article text, and source status
shares a compact row with the original link. Changes are live through the preview
mount without a server restart. Natural whitespace remains for short feeds and
uneven source content; synthetic checks do not replace installed-feed acceptance.


Bottom-of-story return, 14 November 2026: the full `npm test` gate passed Go
formatting/vet/tests/build, Linux race checks, notices/static security, 77 browser
checks and 10 shipped-container checks. Browser cases cover Cards, Magazine and
List returning from a long article's bottom, restoring headline focus/visibility,
collapsing List and avoiding accidental read writes. The shipped path verifies
the double-chevron control and inline collapse/focus at both desktop widths.
The 18-image gallery was regenerated. Static assets are live through the preview
mount; no server restart or real account access was needed.


Remember login, 13 November 2026: the complete `npm test` gate passed Go
formatting/vet/tests/build, Linux race checks, notices/static security, 74 browser
checks and 10 shipped-container checks. Synthetic TLS HTTP tests cover omitted,
false, true and invalid remember flags, cookie policy, session/CSRF rotation,
matching 30-day expiry, eight-hour defaults and restoring only persistent cookies.
Browser clock tests cover long-session timer overflow and eventual expiry. The
shipped path checks persistent and browser-session cookies and authenticates a
fresh browser context using only the remembered cookie, without another login.

The preview was rebuilt, both services are healthy, and a clean browser sees the
unchecked Remember me control without JavaScript errors. All 21 packaged app
licence files and the notice bundle match source. Passwords remain unsaved by the
reader. Remembering is limited by NewsBlur expiry and the in-memory reader store:
restarting the reader still requires signing in again. Installed-server acceptance
remains separate from these synthetic checks.


Full-width/sidebar update, 13 November 2026: Go formatting/vet/tests/build,
Linux race tests, notices and static security passed. All 71 synthetic browser
checks passed, including full reading-column geometry at 1440/1920px, sidebar
control access, navigation and session-expiry clearing. All 10 shipped-container
checks passed separately after updating the logout API check to reuse the CSRF
token from its existing login response, avoiding an extra rate-limited session
request. The UI no longer exposes logout or a username.

The 18-image gallery was regenerated and the full-width article reviewed. Static
assets update through the existing preview mount; no server restart was needed.
The sidebar remains available and List keeps its inline article expansion.


Editorial refinement, 13 November 2026: `npm test` passed Go formatting, vet,
tests/build, Linux race tests, notice checks, static security, 69 browser tests
and 10 shipped-container tests. Added checks cover substantial image selection,
tiny-image treatment, ordered briefs, sentence endings and restoring supplied
copy in Cards, source captions/credits, and body font preferences. Real PNGs now
use photograph-sized fixtures, and the shipped path verifies figure captions and
credits after sanitization. The hidden-photo fixture now correctly expects the
new brief treatment for its short introductions.

The 18-image Warm paper gallery was regenerated and desktop collection/article
views inspected. The preview was rebuilt and both services are healthy. Built
images retain all 21 app licence files and the public notice bundle. No new
third-party dependency/assets or real account data were used. Composition remains
heuristic; image dimensions cannot identify a large logo or supply missing credit.


Newspaper/Warm paper follow-up, 13 November 2026: Warm paper is the only active
palette, including initial paint and system dark mode. Other palettes are archived
outside the served website. The original native composer uses consecutive story
groups, photo orientation, measured text weight, balanced headlines, and native
paragraph columns. Source/DOM order and the common reading action model remain.
See [research and licence findings](newspaper-research.md) and the [UI roadmap](ui-roadmap.md).

The final `npm test` gate passed Go formatting/vet/tests/build, Linux race tests,
licence/notice checks, static security, 65 Chromium browser checks and 10 shipped
container checks. The latter include actual portrait PNG decoding through the
image relay, composition geometry, and picture toggles without CSP violations.
The 18-image Warm paper gallery was regenerated and reviewed at both desktop
widths. All accounts, story text, and photographs used for checks were synthetic.
No real account data was used. The local preview was rebuilt; both services are
healthy at `http://localhost:8080`. Packaging checks verified all 21 app licence
files and the public notice bundle against source. Installed version compatibility, human accessibility and
production deployment acceptance remain open below. Historical verification
counts in earlier roadmap entries describe those earlier builds.

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

The visual command writes `.local/ui-review/index.html`, a manifest, and 18
screenshots in Warm paper: three reading layouts at two desktop widths with
collection/open article, plus portrait, text-only and later-photo newspaper cases.
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
- Verify login/expiry, the logout API, and source scopes: all feeds, nested folders, individual
  feeds, briefing, and All/Unread/Focus filtering. Account-limited/unsupported capabilities must
  explain their state. Briefing generation remains NewsBlur's responsibility.
- In all layouts, load several batches through the last story. Check overlap,
  empty/hidden batches, long feeds, offline/resume and a failed continuation.
  Watch responsiveness and memory; there is no DOM virtualization or offline DB.
- Open and return from stories. List expands in place; Cards/Magazine focus the
  article. Selection, filters, focus and position must survive. Read writes and
  classifier feedback must match NewsBlur, including failure and session expiry. The current UI uses
  automatic read writes when scrolling past seen stories or to an article's end;
  explicit read buttons and saving are absent. Confirm that unseen stories, opening/navigation,
  hidden tabs and offline browsing do not write, and failures pause until Refresh.
- Verify `/reader/river_stories` with POST feed lists, unread filters, pagination,
  hidden batches and account limits. Record the installed response fields for
  `score`/`intelligence`, `story_tags` and hidden-story counts. Empty folders must
  stay empty and a renamed/reordered folder must offer refresh rather than read
  an unrelated collection.
- In a dedicated synthetic account, like/dislike/clear a headline, author and
  topic using `/classifier/save` (success code 0). Verify the matching feed's
  classifier and refreshed Focus results in NewsBlur. Do not use a real account
  as a test fixture. Training highlights only represent this session's confirmed
  choices; full existing-classifier presentation is not yet implemented.
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
- Inspect newspaper reading order and `display: contents` list semantics in the
  intended browsers and assistive technology. Check portrait/landscape pictures,
  thin/long text, native columns, image failure/hiding, day boundaries, and
  preserving the visible story when images decode or the window changes size.
- Exercise the actual HTTPS ingress and private CA configuration. Confirm the
  correct public origin, Secure/HttpOnly session cookie, CSRF/origin rejection,
  no credential leakage and session-expiry cleanup across tabs.
- Retain previous image IDs and configuration securely. Upgrade to the candidate,
  verify health/sign-in/reading, then restore the previous images/configuration
  and verify recovery. Go sessions are in memory: restart requires sign-in.
  Never place secrets in the evidence record or remove NewsBlur data for rollback.

Release status remains **not approved** until these gates have recorded evidence.
