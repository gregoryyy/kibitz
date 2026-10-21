## What and why

<!-- What changes, and which TODO item it covers (e.g. TODO 2.3). -->

## Checklist

- [ ] Tests: `node:test` for logic, Playwright for UI; a bug fix comes with a regression test that fails on the old code
- [ ] `npm run check` and `npm test` pass in `site/`, and `npm run test:e2e` if the page changed
- [ ] TODO.md item ticked and a DONE.md entry added (implementation notes, deviations, insights)
- [ ] New dependencies are GPL-3.0 compatible and earn their place

## Security impact

<!-- None, or what changes for the threat model. Tick what applies. -->

- [ ] No API keys in the browser, the repo, logs or prompts
- [ ] Untrusted text (model output, PGN, library text, user notes) is never rendered as HTML and reaches prompts only through `quote()`
- [ ] Moves and squares from untrusted sources are checked with chess.js before they are shown
- [ ] Async engine, coach and review work checks it still belongs to the current game
- [ ] Release PR only: OWASP Top 10, OWASP LLM Top 10 and ASVS results recorded (TODO 11)
