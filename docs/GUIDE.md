# Using Kibitz

Kibitz combines a chess engine with a language model: Stockfish calculates locally, while an optional coach explains the supplied evidence. You can play, analyse, review, study and search without a model. Start with the [illustrated flipbook](flipbook/README.md) for a nineteen-step tour, or follow the tasks below. The [Primer](primer/Primer_v01.md) explains the project's experiments with search, grounding, tool use and agents.

## Start on your own machine

Install Node 24 or newer and run these commands from the repository root:

```sh
npm --prefix site ci
npm --prefix site run build
AI_PROVIDER=mock node site/scripts/serve.mjs site/dist --api --env= --usage .kibitz-data/usage.sqlite --index _test.html
```

Open `http://127.0.0.1:8765/` in a browser with WebAssembly support. This first run uses canned coach replies, reads no `.env` file and needs no API key or model download. Stockfish still calculates real positions. Keep the terminal running; Control-C stops the server. Opening the HTML file directly from disk does not work.

For actual explanations, follow [provider setup](PROVIDERS.md). Once configured, `just serve` or `npm --prefix site run serve` builds and starts the gateway using the root `.env`. Restart after editing that file. The [Docker recipe](CONTAINER.md) is an alternative mock-default package with private persistent storage. Kibitz targets one local operator; changing its bind address does not add shared accounts or public hosting support.

Open the gear button for **Settings**. Under **General**, choose English or German and independently choose English move notation, German piece letters or figurines. Under **Player profile**, choose the explanation level and optionally save your rating estimate and learning goals. These preferences stay in this browser; the saved profile accompanies later coach questions. They do not change Stockfish's playing strength or measure your ability. See [profile details](PROFILE.md), [move notation](NOTATION.md) and [keyboard/accessibility controls](ACCESSIBILITY.md).

## Play a game

1. Select **Play** and use the **Game** tab to choose your colour, opponent strength/style, starting position and clock.
2. Choose the help level before starting. **Off**, **Flag mistakes** and **Eval + mistakes** restrict analysis while the game is running; **Full engine** permits study tools and lines. Restricted live help also hides opening/source searches and blocks the coach's engine tools.
3. Start the game. Move pieces on the board or type a legal move in the composer, such as `e4` or `play Nf3`. With the keyboard board focused, use arrows to explore, Enter/Space to select a piece and destination, and Escape to cancel.
4. When the game ends, open **Review**. Finished games against Stockfish are saved to the selected library; **Library → Save current game** also saves the displayed game explicitly.

The strength value is a configured opponent setting. Human strength calibration remains incomplete, so it is not a promise of a measured tournament rating. Engine scores are from White's point of view: positive favours White, negative favours Black. Increasing analysis depth takes more time and does not turn a bounded search into a proof.

## Analyse and ask the coach

Select **Analyse**, or open **Game → Load a position or PGN to analyse**, paste a FEN or PGN and load it. **Library → Classics** provides sourced example games. Step through the move list to inspect positions and the evaluation graph. Moving from a past position creates a scratch variation; the original game score remains available. Leaving a running game asks for confirmation and offers a return path.

Choose **Current position** above the composer for board questions, or **General chess** for a discussion without the board context. Quick question chips use the quick model; typed questions use the chat model. **Settings → Coach → How the coach works** controls whether comments are requested manually or after moves. Automatic modes can make more provider calls; start with **Only when asked** when controlling cost matters.

For a concrete comparison, ask: “Compare this candidate with the engine's best move and say when evidence is missing.” An allowed tool round runs Stockfish in the browser and returns bounded results to the coach. Expand the answer's evidence/source cards to see what was checked. A continuation should agree with captured engine evidence; recognized legal moves outside that evidence remain unverified, and red underlines identify failed token checks. A matching move or citation does not certify every sentence, strategic claim or explanation. [Design and evidence limits](AI-DESIGN.md) explain this boundary.

## Review and practise

In **Review**, choose **Run review** for engine analysis, then inspect turning points or click the graph to return to a move. **Write summary** and the study-plan action request model explanations separately. Long games, deeper analysis and tool/format follow-ups can increase time and provider usage. Stop an unwanted review before starting another game; late results are fenced to their original game/position.

**Review trends** aggregates compatible reviews of your own games in the selected library. **Practise your own mistakes** opens an independent exercise board and rechecks candidate moves with Stockfish. These are bounded training checks, not a comprehensive diagnosis of your chess. [Review records](REVIEWS.md) and [own-mistake exercises](OWN-PUZZLES.md) describe evidence and grading.

Use **Openings** to explore recorded continuations and their sample games. Counts/results describe the selected collection, not universal opening statistics. Create a repertoire for White or Black, add a PGN mainline or **Use board line**, save notes and copy it as PGN. **Review due moves** recalls your saved choices on a separate board. A recalled move is your repertoire choice, not automatically the engine's best move.

**Lessons** offers bilingual tactics, strategy, endings and sourced problems with authored hints. **Play against Stockfish** continues a lesson position as a normal game. **Spaced practice** combines due lessons, opening recalls and own-mistake exercises; follow any save/retry message before continuing. Schedules and progress stay in this browser. See [practice intervals and limits](PRACTICE.md).

## Keep games and find sources

In **Library**, import one or more PGN games or annotated studies. Keep source/author information and score rights separate from annotation rights when known. Unknown rights remain unknown; importing a document does not grant redistribution or cloud-ingestion permission. Export games with **Save .pgn**, **Copy PGN** or **Copy all as PGN**.

Library metadata filters combine player, opening/ECO, recorded year, result and theme. **Search detected patterns** instead searches computed themes and recorded move patterns; its heuristic/candidate/rules labels distinguish possible ideas from actual rule-checked facts. **Search study text → Keywords** searches comments and authored notes locally. **By meaning** and **Combined search** can use a separately configured embedding model: review the destination, grant embedding permission, then explicitly build/search. Typing or choosing a method does not itself upload the library. See [text search](TEXT-SEARCH.md), [combined search](HYBRID-SEARCH.md) and the [comparison with literature algorithms](research/position-similarity.md).

Reading suggestions and coach citations link to source occurrences. A similar pawn structure or a retrieved passage can suggest an analogy; it does not prove that a source's move works on your board. Open the source position and check the current position with Stockfish. The [retrieval benchmark](RETRIEVAL-EVAL.md) records a small development suite and known ranking limits.

Browser storage is the default. The optional [server library](../site/README.md#server-library) is a separate, explicitly selected collection, grouped by a browser cookie rather than a signed-in account. Switching storage does not automatically upload existing games or synchronize your profile, repertoire or progress. Clearing that cookie loses the route to its previous server collection.

## Privacy, backups and offline use

Keys remain on the Node server. Before any cloud or Ollama request, grant the selected provider's **coach** permission in **Settings → Coach → Provider permissions**. Embeddings have a separate permission. Questions can include the selected game, engine lines, retrieved passages and saved teaching profile. [Privacy and revocation](PRIVACY.md) explains what leaves the device and why revocation cannot recall an accepted request.

Use **Settings → General → Export or erase your data** for separate browser and server-library controls. Export before erasing and close other Kibitz tabs. Browser JSON exports preserve saved values but currently have no automatic restore/import; PGN import remains available for games. Browser clearing, another profile or another port can show a different collection. Backups, provider copies, downloaded model weights and operational usage counters have separate lifecycles. See [data formats and deletion scope](DATA.md).

For an offline app copy, choose **Settings → Offline app → Prepare or check updates**, wait for confirmation and reload once. Use the same bookmarked address/port. This saves the public app and Stockfish, not private server data or model weights. Browser-local games/lessons remain useful without the Node server; Ollama coaching still needs both Ollama and the Node gateway running. Browser coaching requires separately loaded/cached weights. Follow [offline setup and recovery](OFFLINE.md), and test an offline reload on your own device before relying on it.

## When something fails

| Symptom | Next step |
| --- | --- |
| Coach unavailable or permission required | Check the selected provider and its coach permission; for a browser model, press **Load** explicitly. Engine features remain available. |
| Authentication/model rejection | Check the server `.env`, the exact model ID and your API account's access, then restart. Use the provider console rather than posting keys/log payloads. |
| Connection succeeds but an answer fails | The test checks a small reply, not every model feature. Try a position-sized question, inspect the fixed error hint and consult [provider troubleshooting](PROVIDERS.md#troubleshooting). |
| Rate or daily budget reached | Wait for the documented reset or have the operator inspect limits. Repeated retries may consume requests; the app's usage thresholds are not hard billing caps. |
| Offline copy is stale/incomplete | Follow the remove/reprepare steps in [offline recovery](OFFLINE.md#integrity-updates-and-removal); keep exports before clearing browser storage. |
| Library/progress save fails | Keep the visible draft/game, export what you can and use the offered retry. A storage error does not mean the write succeeded. |

The [operations guide](OPERATIONS.md) provides local no-inference health checks and fixed-category logs. [Validation reports](VALIDATION.md) distinguish tests, recorded model trials and outstanding human/semantic checks.
