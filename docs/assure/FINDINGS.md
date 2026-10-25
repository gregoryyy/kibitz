# Assurance findings

Generated offline from typed, confidence-weighted links. These are recorded deviations, extraction gaps and review candidates; they are not inferred compliance or confirmed defects.

| Rule | Count |
| --- | ---: |
| implements_unassessed | 211 |
| missing_done_reference | 22 |
| possible_deviation_impact | 6 |
| recorded_deviation | 221 |
| unresolved_reference | 3006 |
| verifies_unassessed | 211 |

Confidence threshold: 0.8; dependency depth: 2; per-deviation impact limit: 100; truncated contexts: 0.

See [README](README.md) for weights, inference rules, exclusions and maintenance. The complete findings and supporting typed paths are in [findings.json](findings.json) and the browser.

## First findings by rule

### implements_unassessed

- candidate; 1.00; `todo:11.3.11`: No explicit implements assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:11.4`: No explicit implements assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:5.5`: No explicit implements assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:6.8`: No explicit implements assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:7.1`: No explicit implements assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:3.2`: No explicit implements assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:4.12`: No explicit implements assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:3.9.2`: No explicit implements assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.

### missing_done_reference

- gap; 1.00; `todo:4.10.5`: Checked TODO has no DONE annotation link at the selected confidence threshold.
- gap; 1.00; `todo:3.1`: Checked TODO has no DONE annotation link at the selected confidence threshold.
- gap; 1.00; `todo:10.6`: Checked TODO has no DONE annotation link at the selected confidence threshold.
- gap; 1.00; `todo:4.8.5`: Checked TODO has no DONE annotation link at the selected confidence threshold.
- gap; 1.00; `todo:4.8.4`: Checked TODO has no DONE annotation link at the selected confidence threshold.
- gap; 1.00; `todo:5.6`: Checked TODO has no DONE annotation link at the selected confidence threshold.
- gap; 1.00; `todo:3.5`: Checked TODO has no DONE annotation link at the selected confidence threshold.
- gap; 1.00; `todo:4.10.3`: Checked TODO has no DONE annotation link at the selected confidence threshold.

### possible_deviation_impact

- candidate; 0.90; `file:utils/assure-browser/serve.mjs`: Static dependency path from a recorded/proposed deviation. It identifies review scope, not an observed defect or cause.
- candidate; 0.90; `file:utils/assure-infer.mjs`: Static dependency path from a recorded/proposed deviation. It identifies review scope, not an observed defect or cause.
- candidate; 0.90; `file:utils/assure-infer.mjs`: Static dependency path from a recorded/proposed deviation. It identifies review scope, not an observed defect or cause.
- candidate; 0.90; `file:site/tests/unit/assure-confidence.test.mjs`: Static dependency path from a recorded/proposed deviation. It identifies review scope, not an observed defect or cause.
- candidate; 0.90; `file:utils/assure-browser/serve.mjs`: Static dependency path from a recorded/proposed deviation. It identifies review scope, not an observed defect or cause.
- candidate; 0.90; `file:site/tests/unit/assure-confidence.test.mjs`: Static dependency path from a recorded/proposed deviation. It identifies review scope, not an observed defect or cause.

### recorded_deviation

- recorded; 1.00; `done:2026-10-20--local-dev-server-and-justfile/deviation:8e6c9c6541026a3f`: - Local serving moved from \`python3 -m http.server\` to Node for the \`just\` recipes, in line with the Node stack. \`npm run serve\` in \`claude/\` still uses Python.
- recorded; 1.00; `done:2026-10-23--hybrid-passage-retrieval-with-explicit-board-intent/deviation:88a71296b2185261`: - This delivers bounded rank fusion and a deterministic reranker over existing chess signals, with no learned cross-encoder or calibrated semantic abstention. Material/piece-placement signatures, richer position/move motif tags and fuzzy pawn distance remain 8.1/8.2/8.5. Tutor prompts and citation validation remain 8.6. No dependency, external corp
- recorded; 1.00; `done:2026-10-24--compare-position-retrieval-with-literature-algorithms/deviation:7af3590b0745d56b`: - This is a sourced algorithm comparison and experiment design, not a reproduction of literature algorithms on Kibitz's corpus. Published metrics with different inputs, labels and denominators are not combined into a performance ranking.
- recorded; 1.00; `done:2026-10-23--research-rag-neurosymbolic-games-and-milestones-57/deviation:e8e41ab09a38d9de`: - This is documentation and selective literature review, not a runtime implementation, systematic survey or reproduction of paper benchmarks. Milestones 5–8 retain their feature status; only the research item is marked complete.
- recorded; 1.00; `done:2026-10-21--offline-mode-a-small-model-in-the-browser/deviation:24b5c0f6c3453261`: - \*\*Not in our Worker.\*\* wllama starts its own worker \(from a blob URL, allowed by \`worker-src blob:\`\), so the page-side provider doesn't need one.
- recorded; 1.00; `done:2026-10-23--repertoire-recall-with-spaced-reviews/deviation:a5cb669ea14afa07`: - Review positions individually, rather than requiring exact replay of one route: a transposed position can have several valid saved choices. The representative route retains its full FEN for move numbering and its stored reply; the schedule belongs to the position and choices.
- recorded; 1.00; `done:2026-10-23--research-rag-neurosymbolic-games-and-milestones-57/deviation:9d4525c1f1ce7c40`: - No dependencies, datasets, model weights, embedding index or engine exports were added. The audit is pinned to \`0176c62\`; the pending Primer-source PR is linked separately.
- recorded; 1.00; `done:2026-10-23--source-aware-library-records-for-rag/deviation:0a8168554f9dcba4`: - Source metadata extends the existing flat records; normalised snapshots are derived/cached rather than persisted as duplicate tables. SQLite/IndexedDB remains 7.6. This establishes the data contract without requiring that storage migration first.

### unresolved_reference

- gap; 1.00; `object:site/tests/e2e/chat.spec.mjs#program%3A%3CArrowFunctionExpression%3Adf6b514e835c%3E%3Afunction:0`: unresolved\_import\_call: ./fixtures.mjs\#expect
- gap; 1.00; `object:site/tests/e2e/chat.spec.mjs#program%3A%3CArrowFunctionExpression%3Ae634ba4a9f91%3E%3Afunction:0`: unresolved\_import\_call: ./fixtures.mjs\#expect
- gap; 1.00; `object:site/tests/e2e/operator-permissions.spec.mjs#program%3A%3CArrowFunctionExpression%3A01496ee28e9b%3E%2F%3CArrowFunctionExpression%3Afdfedf55e37a%3E%3Afunction:1`: unresolved\_import\_call: ./fixtures.mjs\#expect
- gap; 1.00; `section:.github/pull_request_template.md#checklist`: directory: site/
- gap; 1.00; `object:site/tests/e2e/pawn-distance.spec.mjs#program%3Asetup%3Afunction:0`: unresolved\_import\_call: ./fixtures.mjs\#expect
- gap; 1.00; `object:site/tests/e2e/retrieval-citations.spec.mjs#program%3A%3CArrowFunctionExpression%3A910f53aa1c66%3E%3Afunction:0`: unresolved\_import\_call: ./fixtures.mjs\#test
- gap; 1.00; `pr:28`: historical\_PR\_file\_absent: site/src/notation.js
- gap; 1.00; `section:docs/PROVIDERS.md#self-host-with-native-ollama`: missing: --library .kibitz-data/library.sqlite

### verifies_unassessed

- candidate; 1.00; `todo:11.3.11`: No explicit verifies assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:11.4`: No explicit verifies assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:5.5`: No explicit verifies assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:6.8`: No explicit verifies assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:7.1`: No explicit verifies assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:3.2`: No explicit verifies assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:4.12`: No explicit verifies assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
- candidate; 1.00; `todo:3.9.2`: No explicit verifies assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.
