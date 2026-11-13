# AI contributor entry point

News Stability is a reader for an existing NewsBlur server at `https://news101.lan`.
Go is the server language. NewsBlur owns feeds, stories, read state, intelligence,
and briefing generation. Keep this application focused on reading and presentation.

Read the relevant focused rules before changing code; links are instructions,
not optional background. Tool-specific instruction files point here to avoid drift.

| When | Required rules |
| --- | --- |
| Every task | [Workflow](docs/ai/workflow.md), [design](docs/ai/design.md) |
| Go changes | [Go](docs/ai/go.md), [testing](docs/ai/testing.md) |
| API, auth, UI content, or proxy changes | [NewsBlur integration](docs/ai/newsblur.md), [testing](docs/ai/testing.md) |
| Debugging or operational changes | [Debugging](docs/debugging.md) |

Start with [architecture](docs/architecture.md) and [roadmap](docs/roadmap.md).
Update the roadmap, blockers, or backlog when evidence changes their status.
Report what changed, checks performed, and remaining limitations.
