# NewsBlur and reader boundaries

References: [API](https://www.newsblur.com/api),
[source](https://github.com/samuelclay/newsblur).

- Treat NewsBlur as the source of truth for subscriptions, folders, stories,
  read state, saved stories, intelligence, search, and generated briefings.
- Use existing capabilities. Do not build feed fetching, full-text extraction,
  a replacement search index, AI briefing generation, or a mirror story database.
- Verify the installed server version and endpoint behavior. The public API
  documentation may not cover every feature present in upstream source.
- Daily Briefing belongs in the reader as a view of NewsBlur's output. Check
  availability, settings, responses, and generation state before implementing it.
  Explain an unavailable feature clearly; never silently generate our own result.
- Keep origin configurable (`NEWSBLUR_ORIGIN`); never accept an arbitrary upstream
  URL from a browser request. Default is `https://news101.lan`.
- Isolate NewsBlur transport and response adaptation from HTTP handlers as those
  capabilities are implemented. Preserve upstream semantics unless a documented
  reader contract intentionally changes them.
- Verify session, CSRF, cookie, redirect, and trusted-origin behavior end to end.
  Keep authentication material out of localStorage. Do not claim the current
  development proxy is a completed authentication design.
- Story HTML is untrusted. Use a maintained sanitizer with a deliberate allowlist
  and safe link handling before rendering it. Test hostile markup.
- Keep the interface calm: clear navigation, accessible controls, keyboard support,
  loading/empty/error states, and desktop reading. Server internals do not belong
  in normal reader flows.
- Attribute NewsBlur as the source in the finished reader as required by its API
  guidelines. Check applicable terms when implementing distribution or monetization.
