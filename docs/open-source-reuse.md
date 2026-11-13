# Go RSS project reuse review

Reviewed on 2026-11-13 using the public GitHub repositories and their license
files. NewsBlur remains the source of truth for fetching, subscriptions, stored
stories, read state, and briefing generation. Reuse is limited to presentation
and supporting code.

| Project | Inspected revision | License | Decision |
| --- | --- | --- | --- |
| [Miniflux](https://github.com/miniflux/v2) | `fb043227ef6ad98569c848e8cdade0d237dab87e` | Apache-2.0 | Adapted Go reading-time estimation and JavaScript shortcut dispatch |
| [Fusion](https://github.com/0x2E/fusion) | `c31ade09b481fa877633899e8cf5d4c86a72c4f9` | MIT | Adapted typing-target guard for shortcuts; no React/router/backend import |
| [gofeed](https://github.com/mmcdole/gofeed) | `6014e99c09f70ccc83bccf7ea4ee772fb1bc7061` | MIT | Reviewed feed-parser scope; not imported because NewsBlur already parses feeds |
| [gorss](https://github.com/Lallassu/gorss) | `7d015be25ad1a8eebeb1f436b8d826e88f7081b3` | MIT | Reviewed keyboard-driven reading and configurable themes; no terminal/SQLite code imported |
| [Shiori](https://github.com/go-shiori/shiori) | `aebb4021a56048eed4c8feb325399be5f46e5470` | MIT | Adapted explicit/system theme application and local appearance preferences |
| [Memos](https://github.com/usememos/memos) | `30f8bad87d586228381c54beea686162cd8c5265` | MIT | Adapted paper palette and outgoing/backlink relation buckets; no note backend |

## Implemented reuse

### Reading-time estimates

[Miniflux source](https://github.com/miniflux/v2/blob/fb043227ef6ad98569c848e8cdade0d237dab87e/internal/reader/readingtime/readingtime.go)
uses word counts for most text and character counts when a letter sample is
predominantly Chinese/Japanese/Korean. The adapted
`internal/article/readingtime.go` estimates the sanitized content actually shown,
using 200 words or 500 CJK characters per minute. Empty content has no estimate.
The sample now includes its hundredth letter. Local HTML tokenization decodes
entities, separates block boundaries, and preserves words across inline markup.

The reader API adds `reading_minutes`; story rows and article metadata display
an approximate reading duration. This does not fetch or extract article text,
change reading state, or claim a precise full-article duration for partial feeds.

### Keyboard reading

[Miniflux's dispatcher](https://github.com/miniflux/v2/blob/fb043227ef6ad98569c848e8cdade0d237dab87e/internal/ui/static/js/keyboard_handler.js)
is adapted into `web/keyboard.js`. It adds modular event listeners and a 1.2-second
prefix window. [Fusion's typing-target helper](https://github.com/0x2E/fusion/blob/c31ade09b481fa877633899e8cf5d4c86a72c4f9/frontend/src/hooks/use-keyboard.ts)
protects form fields, editable content, and explicitly excluded controls. Local
additions also ignore composition, repeated keys, open dialogs, selected text,
and Control/Alt/Meta combinations. Unknown keys keep their browser behavior.

The reader registers j/k for next/previous story within the current page, v for
the original link, g then f/s for feed/story focus, and ? for a native help dialog.
Navigation does not mark stories read. Native arrow keys and browser shortcuts
are retained. Keyboard support does not depend on React, a terminal toolkit, or
a feed-reader backend.

## Further reading features

[Shiori's theme controller](https://github.com/go-shiori/shiori/blob/aebb4021a56048eed4c8feb325399be5f46e5470/webapp/src/composables/useTheme.ts)
provides explicit/system theme handling. `web/appearance.js` adapts that to a
small native module with validated background, font, and text-size preferences.
Only display preferences use localStorage; account/story data remains transient.
System mode follows CSS media queries, and unavailable storage leaves controls
usable for the current tab. The reader does not copy the upstream placeholder
contrast-validation function or claim an accessibility audit.

[Memos' paper palette](https://github.com/usememos/memos/blob/30f8bad87d586228381c54beea686162cd8c5265/web/src/themes/paper.css)
supplies warm background/text colors mapped to reader tokens in `web/themes.css`.
The [reference/backlink buckets](https://github.com/usememos/memos/blob/30f8bad87d586228381c54beea686162cd8c5265/web/src/components/MemoMetadata/Relation/relationHelpers.ts)
are adapted into `web/relations.js`. Relationships are actual hyperlinks among
loaded stories, not locally inferred topic similarity or a second story database.
NewsBlur-provided `cluster_stories` are shown separately as related coverage.

The GitHub Readeck repository redirects readers to Codeberg; no Readeck source
or assets were imported in this review.

For summaries, original Go adapters use NewsBlur's existing briefing read API.
[Upstream briefing views](https://github.com/samuelclay/NewsBlur/blob/9aae0792a92e9ba6a329e41ee80db8dae246631e/apps/briefing/views.py)
return summary stories and curated source stories. Those are sanitized through
the same article presenter as feed stories. The reader exposes no AI generation
or briefing settings writes. Missing endpoints, disabled/empty briefing states,
and failures are visible. Empty responses are not presumed to mean generation
is pending; the inspected API has no explicit generation-progress field.

`/reader/river_stories?h=...` resolves NewsBlur-supplied story references through
a fixed upstream endpoint. Browser requests cannot select an arbitrary URL.
Source and related-story navigation retain the current feed/briefing page.
Installed-server briefing/cluster contracts and browser behavior remain unverified.

## License handling

The imported portions retain copyright and SPDX headers, exact upstream
revisions, and prominent modification notices. The Apache-2.0 and MIT texts are
included in full. The inspected Miniflux tree has no NOTICE file. Combined
keyboard source carries both component attributions. No upstream artwork,
logos, backend, or database code is copied.

[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) and `licenses/manifest.json`
record imported source and existing dependency notices. The public footer links
the full generated notices, and the Go runtime image includes the same license
texts. Regenerate after dependency/notice changes with
`go mod download all` followed by `python scripts/update_notices.py`.

This implementation pass retains the requested deferred-test workflow. Build,
syntax, configuration, and notice-consistency checks are separate from the still
pending behavioral/browser test pass. No new milestone is marked complete.

