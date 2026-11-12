# Change workflow

1. Read the affected code, callers, tests, and relevant documentation first.
2. Describe the desired behavior and trace the complete flow that implements it.
3. Identify the owner of each responsibility before choosing where code belongs.
4. Make the smallest coherent change, including removing obsolete paths.
5. Run the relevant checks in [testing](testing.md); inspect the final diff.
6. Update documentation and planning status to match delivered behavior.

Do not mark planned behavior as implemented. Record blockers with evidence,
impact, and an unblocking action in [blockers](../blockers.md). Keep independent
work moving. Do not access real user data or mutate NewsBlur to make tests pass.

Never commit secrets, `.env`, cookies, or private story fixtures. Avoid logging
credentials, authorization headers, request bodies, story content, or full URLs
with query strings. Preserve unrelated user changes.

When fixing a defect, reproduce its observable behavior and check the callers
affected by the repair. Explain meaningful tradeoffs; do not hide unresolved
behavior behind a fallback that silently reports success.
