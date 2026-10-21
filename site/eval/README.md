# Tutor eval set

Reference positions for measuring how well a language model coaches (TODO 3.8). Each position comes with a quick question and the key points a good answer should hit. The results per provider and model are in [docs/eval/](../../docs/eval/README.md).

## How a run works

`just eval` serves the app with the chosen provider and drives it in a headless Chrome, one position after the other:

1. It loads the position into analysis, from its moves or a FEN.
2. It waits for Stockfish to analyse it.
3. It asks the coach through the position's quick-question chip.

The model therefore sees exactly the prompt a player's question produces: the position, Stockfish's lines, the motifs, the retrieved references, and the player's level (club).

Each answer is scored on up to three things, each from 0 to 1:

- **Key points:** the share of the position's key points the answer hits. A key point is one or more patterns, and all of them must match ([positions.mjs](positions.mjs)).
- **Move checks:** the app's own answer check (`checkAnswer`, TODO 3.4). The score is 1 with no wrong move and drops by a third for each wrong one.
- **Judge** (optional, `judge=<provider>`): an LLM grades accuracy, insight, clarity and fit to the level, from 1 to 5. It sees what the coach saw, the question, the answer and the key points, and the answer is marked as data, not instructions. It runs in the Node script, so API keys stay on the machine. `EVAL_JUDGE_MODEL` picks the model.

The overall score is the mean of what was measured.

## Running it

```
just eval                                      # the provider in .env, no judge
just eval anthropic judge=anthropic            # Claude, graded by Claude
ANTHROPIC_MODEL=claude-opus-5-5 EVAL_JUDGE_MODEL=claude-opus-5-5 just eval anthropic judge=anthropic
just eval browser judge=anthropic              # the in-browser model (download it with `just offline` first)
just eval browser model=qwen2.5-0.5b
just eval mock                                 # no keys; checks the pipeline
```

Each run writes `docs/eval/<provider>-<model>.md`, with every answer, the key points it hit and the judge's notes, plus a `.json` file. It also regenerates the table in `docs/eval/README.md`. Answers differ between runs, so a difference of a few points between two models means little.

## Adding a position

Add an entry to [positions.mjs](positions.mjs):
- `id` and `title`;
- `moves` or `fen`;
- `chip`, the label of a quick-question chip;
- at least two `keyPoints`.

Check the engine's view first, for example with Stockfish at depth 18, so the key points match what the engine finds. `tests/unit/eval.test.mjs` checks that every position sets up legally and that its patterns compile. `tests/e2e/eval.spec.mjs` runs every position through the app with the mock provider.
