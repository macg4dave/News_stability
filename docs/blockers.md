# Open release gates

Updated 13 November 2026. Implementation can be reviewed locally; these gates
prevent a claim that the three-view release is ready for general deployment.

| Evidence / missing input | Impact | Unblocking action |
| --- | --- | --- |
| No installed version or dedicated synthetic-account acceptance evidence is available in this workspace. Routine tests intentionally do not access real accounts. | Installed image hosts, full text, briefing, timestamps and intelligence contracts remain unverified. | Operator provisions/authorizes a dedicated fixture account and records the installed checks in [acceptance](acceptance.md). |
| Synthetic Chromium checks and screenshots cannot establish human screen-reader acceptance or every intended browser. | Final accessibility/browser sign-off is open. | Complete the human acceptance matrix and record versions/results. |
| Local preview uses loopback HTTP; production ingress and previous deployed images/configuration are outside this workspace. | HTTPS/session, upgrade and rollback acceptance is open. | Exercise the actual target environment using the acceptance checklist. |
| No first-party project license has been selected. Existing third-party notices explicitly do not license the rest of the application. | Public distribution licensing remains open. | Owner selects a compatible first-party license before public distribution; preserve every existing third-party obligation. |

Whisper/Fluent source-candidate review is complete. Their layouts are behavior
references only; no protected code/assets were imported. There is no unresolved
Whisper-derived code in this implementation. See [reuse review](open-source-reuse.md).
