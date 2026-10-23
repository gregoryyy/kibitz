# Neurosymbolic approaches to chess and other games

Research date: **2026-10-23**. A selective review for Kibitz, with primary sources and proposed experiments. Repository observations refer to **`0176c62`**; the systems reviewed below have not been integrated or reproduced here.

## Use the term precisely

“Neurosymbolic” covers several materially different designs:

| Family | Neural part | Explicit part | Relevance here |
| --- | --- | --- | --- |
| Neural evaluation + search | Value/policy prediction. | Legal game states and search/planning. | Stockfish's internal hybrid; AlphaZero is another example. |
| Engine-grounded language | Language understanding/generation. | Rules, features, checked moves and retrieved source records. | Kibitz's present architectural family. |
| Concept-mediated explanation | Learned concept representations or probes. | Named concepts/rubrics and structured evidence. | Candidate improvement for strategic commentary. |
| Differentiable logic | Neural predicates or learned rule weights. | Logical operators/programs with defined inference. | Research option where examples and uncertainty justify learning. |
| Constrained action selection | A learned policy proposes actions. | An external rule/shield restricts choices. | Analogy for board-action validation, with limits on any formal guarantee. |

Neural search hybrids are often discussed alongside neurosymbolic systems, but do not necessarily expose logical predicates or human-readable rules. A graph is not automatically a reasoning system, and a fluent explanation is not automatically faithful to the computation that chose a move.

## Chess: the most directly useful work

### Engine-conditioned commentary

[Lee, Wu, Dinan and Lewis (2022), *Improving Chess Commentaries by Combining Language Models with Symbolic Reasoning Engines*](https://arxiv.org/abs/2212.08195), condition a language model on explicit game-state/control information and engine-derived signals. Their experiments report improved human preference over their baselines. This supports an engine-to-language interface rather than expecting a general model to discover all chess facts from notation. Their examples also expose an important limit: conditioning on correct move-quality information does not make every subsequent sentence correct.

**Kibitz implication:** make the model's evidence packet richer and easier to audit before considering model training. Include the alternatives compared, the best reply, relevant feature changes and the scope of the check. Test whether an answer stays faithful when one evidence field changes.

### Concept-guided explanations

[Kim et al. (NAACL 2025), *Bridging the Gap between Expert and Language Models: Concept-guided Chess Commentary Generation and Evaluation*](https://aclanthology.org/2025.naacl-long.481/), propose concept-guided commentary (CCC) and an expert-informed evaluation scheme (GCC-Eval). The work bridges expert representations and language through prioritised concepts. Its limitations matter: concepts draw on Stockfish 8-era evaluation ideas, proprietary LLMs constrain reproduction, and expert-rated commentary does not establish improved learning for beginners.

**Kibitz implication:** first expose concepts we can compute and verify, such as an open file or a sound fork, with precise definitions and counterexamples. Learned strategic concepts can be a separate experiment. A neural concept score and a rule-checked property should retain different provenance and confidence.

### A direct component-reuse example: Queen

[Bhaskar, Cheng and Chen (October 2026 preprint), *Language Models that Play Chess and Explain Their Moves*](https://arxiv.org/abs/2610.03695), introduce Queen: an Lc0 chess encoder connected to a language decoder and trained through search-based distillation. Its alternative seed-data pipeline uses a custom analysis tree, Stockfish neural evaluation without search, and a separate Stockfish search to judge continuations; plausible human mistakes enrich the branches. See [Appendix D](https://arxiv.org/html/2610.03695v1).

This is directly relevant to the component question, but remains a new preprint. Its playing and explanation evaluations do not establish teaching effectiveness or a drop-in evaluator export for our WASM build. Extracting representations, numerical evaluation and human-readable features are distinct interfaces.

**Kibitz implication:** consider an offline annotation-tree experiment before any runtime engine fork. Compare it with the existing whole-engine tools at equal latency and test tactical failures explicitly.

### Learning chess-language alignment

[Feng et al. (2023), *ChessGPT: Bridging Policy Learning and Language Modeling*](https://arxiv.org/abs/2306.09200), combine game and language data and introduce ChessCLIP/ChessGPT models. This is relevant to chess-aware text/position retrieval and commentary, rather than evidence that a general text embedding of FEN will work. Learned alignment can suggest examples; legal move checks and engine verification still need an explicit boundary.

**Kibitz implication:** compare a domain-aware encoder against the simpler structural-plus-text baseline in [the RAG study](rag-methods.md). Do not add a trained model just to replace exact position keys.

### Human-like errors and skill adaptation

[Tang et al. (NeurIPS 2024), *Maia-2: A Unified Model for Human-AI Alignment in Chess*](https://arxiv.org/abs/2409.20553), model human move choices conditioned on skill. Predicting what a player is likely to do differs from evaluating the best move. A likely human error may be an excellent teaching distractor, provided a separate engine checks its consequence.

**Kibitz implication:** use human-likelihood models, if added, to propose plausible alternatives or tailor exercise difficulty. Use Stockfish/tablebases for the outcome comparison. The current Elo/style configuration is not a Maia-style learned model of individual mistakes; strong opponent play and good pedagogy are different objectives.

### Concepts inside a chess network

[McGrath et al. (PNAS 2022), *Acquisition of chess knowledge in AlphaZero*](https://pmc.ncbi.nlm.nih.gov/articles/PMC9704706/), probe representations for human-understandable chess concepts and study their emergence during training. Their concept targets include Stockfish 8 evaluation features and additional concepts. The result is evidence that such information can be decoded, not that a probe explains the causal reason for every decision. Classic evaluator components used as research labels should not be confused with a supported Stockfish 19 NNUE feature API.

**Kibitz implication:** concept probes could help retrieve examples or produce hypotheses. For a pedagogical claim, compare counterfactual legal positions and checked alternatives; show disagreement between a learned probe and a rule-based definition instead of silently treating them as interchangeable.

## Search hybrids across chess, shogi, Go and Atari

### Stockfish NNUE

The [Stockfish team's NNUE introduction (2020)](https://stockfishchess.org/blog/2020/introducing-nnue-evaluation/) and [technical documentation](https://official-stockfish.github.io/docs/nnue-pytorch-wiki/docs/nnue.html) describe neural position evaluation designed for efficient incremental updates, originating in shogi. Search still explores explicit legal continuations. This gives Kibitz a neural/search hybrid inside the engine before the language model is involved.

The current app receives scores and PVs through UCI; it does not receive the network's hidden states. A large evaluation advantage need not translate into a short human explanation. Conversely, a compact material/structure explanation may describe useful board facts without reproducing the neural evaluator's actual computation.

### AlphaZero

[Silver et al. (2017 preprint), *Mastering Chess and Shogi by Self-Play with a General Reinforcement Learning Algorithm*](https://arxiv.org/abs/1712.01815), combine learned policy/value estimates with Monte Carlo tree search and supplied game rules, demonstrating the approach across chess, shogi and Go. The lesson is architectural: learned evaluation and explicit search can complement each other. This is not a lesson-generation or explanation method, and it does not expose a logic proof for each move.

**Kibitz implication:** no need to train another playing engine. Reuse a strong engine's checked alternatives and add a teaching representation above it.

### MuZero as a useful boundary case

[Schrittwieser et al. (2019 preprint/2020 Nature), *Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model*](https://arxiv.org/abs/1911.08265), learn planning-relevant dynamics, reward and policy/value predictions rather than relying on an explicitly supplied transition model inside search. This extends neural planning across board games and Atari. Its latent dynamics are not a human-readable ruleset or a guarantee of legality/correct explanation.

**Kibitz implication:** learned dynamics solve a different problem. Chess already supplies an exact legal transition function, so replacing it with an approximate world model adds uncertainty without addressing the immediate teaching need.

## Explicit neural–logical mechanisms in other games

### TextWorld: learning interpretable logical policies

[Kimura et al. (EMNLP 2021), *Neuro-Symbolic Reinforcement Learning with First-Order Logic*](https://arxiv.org/abs/2110.10963), extract logical facts from text observations and ConceptNet, then learn policies with a Logical Neural Network. Their TextWorld experiments study convergence and interpretability. Here the symbolic layer is an explicit rule representation, rather than only a search tree or a natural-language rationale.

**Transfer to chess:** a lesson policy could operate on concepts such as “weak theme”, “prerequisite mastered” and “hint already used”. Begin with an authored, inspectable policy; learning rule weights only earns its place if it improves held-out teaching outcomes. Errors in fact extraction remain errors even if later inference is logically consistent.

### DeepProbLog: neural predicates plus probabilistic rules

[Manhaeve et al. (NeurIPS 2018), *DeepProbLog: Neural Probabilistic Logic Programming*](https://arxiv.org/abs/1805.10872), integrate neural predicates with probabilistic logic and end-to-end learning. The paper's coin/urn game combines perceptual inputs, uncertain parameters and an explicit winning rule; it is a small demonstration, not a strong general game-playing agent. See the [original paper](https://proceedings.neurips.cc/paper/2018/file/dc5d637ed5e62c36ecb73b654b05ba2a-Paper.pdf).

**Transfer to chess:** useful if the inputs are uncertain, for example an OCR-derived diagram or a probabilistic learner model. Kibitz's normal FEN board is already discrete and known, so a probabilistic logic runtime is unnecessary for move legality. Uncertain inferred facts should never silently become verified board state.

### Shielding learned policies

[Alshiekh et al. (AAAI 2018), *Safe Reinforcement Learning via Shielding*](https://arxiv.org/abs/1708.08611), use a formally specified external mechanism to constrain a learning agent's actions. Guarantees depend on the formal model and specification; this is more specific than filtering malformed outputs.

**Transfer to chess:** retain a deterministic action boundary around model proposals. Check moves, source IDs, permissions and board state before acting. Kibitz's present validators are analogous in purpose, but should not be described as a formally synthesised shield or a proof of chess advice correctness. A legal move can still be a blunder, and an approved board action says nothing about whether its prose explanation is faithful.

## A practical architecture for Kibitz

Recommended evidence flow for milestones 5–8:

```text
User question + game/position + learner context
                |
        validated task / typed tools
                |
   +------------+-------------+
   |            |             |
rules/features  search     source/position retrieval
   |            |             |
   +------ bounded evidence packet ------+
                |
       level-appropriate explanation
                |
   citation / line / board-action checks
                |
       answer with inspectable evidence
```

Define the evidence packet so a small model can use it: board identity, allowed task, relevant concepts, compared candidates, reply lines, score perspective, search limits, source IDs and unresolved questions. Keep retrieved descriptions quoted. Tool access and generation/FEN guards stay under application control.

Keep four types of claims visibly distinct in stored data: rule-computed facts, finite-search assessments, authored/source statements and learned/model hypotheses. A future probe can supplement `knowledge.js` without making a learned concept silently equivalent to a verified motif.

This design supports opening explanations, graded hints and cross-game analogies while preserving the current rule that the model explains engine-backed lines. If a novel line is needed, request analysis before presenting it as advice. The model's own rationale should not be promoted into evidence for itself.

## Proposed experiments and decision criteria

| Experiment | Comparison | Evidence needed before adoption |
| --- | --- | --- |
| Structured concept packets | Existing context vs explicit concepts + alternatives + limits. | Fewer unsupported claims, equivalent/lower latency, human-rated clarity by level. |
| Counterfactual explanations | Best line alone vs checked contrast with a tempting move. | Correct refutations and better learner answers on held-out positions. |
| Skill-aware distractors | Engine-only alternatives vs human-likelihood proposals checked by engine. | Plausible errors and improved exercise calibration, without teaching false continuations. |
| Chess-aware retrieval | Structural/BM25 hybrid vs learned chess-language embeddings. | Gains by query class, especially strategic analogies, with stable precision and citations. |
| Standalone evaluator/tree | Whole-engine tool calls vs an offline evaluator-driven annotation tree. | Reproducible interface, tactical failure analysis, useful explanations at equal budget. |
| Learnt concept probes | Pure features vs probe-assisted suggestions. | Calibrated uncertainty, counterexamples and human-reviewed concept agreement. |

Start with concept packets and counterfactuals: they build on the existing tools and need no new training pipeline. Before a standalone evaluator experiment, pin the engine/build/network, inspect supported exports and account for score perspective, terminal rules and history. Static scores need a search-backed tactical check. Any feature/activation extraction requires a deliberate engine build/interface rather than an assumption about the npm package.

For evaluation, separate playing strength, move correctness, citation support, explanation faithfulness and actual learning. Use adversarial cases: a poisoned fork, a pinned attacker, the same pawn skeleton with a different tactic, a misleading retrieved annotation, a stale position and an attractive but losing human move. Have a chess-aware human review strategic explanations. Preference or LLM-judge scores can supplement those checks; neither certifies pedagogy or causality.

## What to defer

No reviewed paper establishes that Kibitz must train its own engine, deploy a graph database, expose NNUE directly or add a differentiable logic framework. The immediate gap is connecting reliable facts and sources to useful explanations, then measuring whether students learn. More ambitious mechanisms should address an observed failure in that path.
