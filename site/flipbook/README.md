# Updating the flipbook

[tour.mjs](tour.mjs) defines the walkthrough. It follows the Opera Game, then source search, opening guides, a saved repertoire and recall, a verified lesson, spaced practice and German phone views. All screenshots come from the running app; no screenshots are edited by hand.

From `site/`, after a build:

```sh
node scripts/flipbook.mjs --ai mock --out /tmp/kibitz-flipbook-preview
node scripts/flipbook.mjs --ai anthropic --plan --env ../.env
```

`--ai mock` loads no env file, blanks provider keys and labels the output as a placeholder UI preview. It is not evidence of real coaching. `--plan` starts only the local gateway, prints the actual selected models and requested-answer count, then exits without a browser, model request or output change. `--env` selects a server-side env file for a worktree. Defaults match `just flipbook`: the repository `.env` and `docs/flipbook/`.

Paid runs require explicit approval before adding `--yes`, under [the paid-run guard](../scripts/paid.mjs). The current tour requests nine answers, including the turning-point button, summary, study plan and one player-move comment. Tool follow-ups, format fallbacks and SDK retries can add provider requests; this is not a hard billing cap. There is no judge or embedding request. The runner grants only the selected coach purpose in its fresh browser after the guard, using fixed public study material without an existing personal library/profile.

Desktop captures use a 1360 × 900 viewport, with focused repertoire/lesson/practice panels; phone captures use 390 × 844. Position steps wait for the configured Stockfish depth. Completed output includes every PNG, generated `README.md` and a `run.json` with provider/model labels, viewport/image sizes, main-board FENs and prose/check captures. Lesson/drill boards remain separate from that main-board metadata. Source/tool cards and interface controls are excluded from quoted coach prose. Recognized-token counts cover move tokens only; separate claim/citation warnings remain visible in the screenshots and are not aggregated into a quality score. These checks do not semantically verify every sentence.

Every step must succeed, including page/CSP checks, before the staged directory replaces the published flipbook. Failed rendering preserves the existing output. A failed replacement restores the previous directory. Do not edit the generated README or claim a mock/replayed answer is a fresh provider result.

`tests/unit/flipbook.test.mjs` checks request counting, text formatting and publication rollback. `tests/e2e/flipbook.spec.mjs` exercises no-call planning and the complete mock tour, verifies PNG sizes and checks the German phone flow.
