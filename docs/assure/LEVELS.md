# Object, PR and documentation lineage

Levels describe extraction granularity, not proof strength. Level 1 remains in
[lineage.json](lineage.json). Level 2 is a separate [object/PR graph](objects.json);
level 3 is a separate [documentation graph](documents.json). Their shared
[contract](detail-types.mjs) and [JSON Schema](detail-schema.json) validate types,
endpoints, ownership and source locations across the three files.

## Level 2: objects and pull requests

The extractor parses tracked regular JavaScript/MJS files and executable inline
HTML scripts with the existing ESLint/parse5 parsers. Named/anonymous functions,
classes, methods and control-flow blocks become objects. Function bodies belong
to their function rather than becoming duplicate block nodes. Literal data,
TypeScript, CSS, shell and other languages remain file artifacts. No analyzed
module is imported or executed.

Each object carries its complete-file UTF-16 range, lines, AST selector, extractor
version and SHA-256 of the selected text encoded as UTF-8. Named objects use
qualified names and duplicate ordinals; anonymous objects/blocks include a content
digest. These are checkout identities, not promises of rename stability. The
replay command reparses the tracked sources, finds the identity again and checks
selector, range and content. Drift fails explicitly; it never silently moves an
old claim onto changed code.

`calls` means a direct identifier call resolved to a function/class binding by
ESLint's lexical scope manager. `imports_binding` adds a literal local import to
a directly declared export. These are static target references, not runtime
execution evidence. `references_binding` records lexical reads of extracted
functions/classes as callbacks, aliases or values. Dynamic/member calls, re-export chains and external-package
calls have no guessed target; member/dynamic and external-import calls are counted
in `exclusions`. Unresolved local imported calls remain visible individually.

[pull-requests.json](pull-requests.json) retains public GitHub PR metadata, exact
body text, state, head/base commits and complete paginated changed-file lists.
`refresh-prs` is an explicit read-only network operation using authenticated `gh`;
normal generation/checking/viewing is offline. The snapshot is deliberately not
refreshed by CI. It represents the records present when last refreshed; a later
PR or edited description requires a deliberate refresh and review. PR state is
observed metadata, never release approval. No review comments, CI logs or paid
providers are fetched.

Each PR body has an introduction and addressable heading sections with exact
ranges and hashes. `changes_file` comes from GitHub's changed-file list; it does
not attribute a whole PR to every object inside a file. `mentions_file` records
explicit body references. `mentions_object` requires an exact code-span name
and an explicitly cited file in the same section/item; ambiguous names are gaps.
`references_item` records explicit TODO annotations in PR sections. TODO/DONE,
insight and deviation object mentions use the same constrained rule. Such edges
record what was described, not that the description is correct or complete.

## Level 3: project documentation

Markdown ATX/setext headings, hierarchy, duplicate anchors and fenced blocks are
replayable nodes. `locates_item` connects the narrowest section to the original
TODO/DONE/rationale nodes using their recorded locations. Inline and
full/collapsed reference-style links connect sections to files, local heading
anchors, retained PRs and HTTP(S) documentation URLs. External URLs are indexed
without fetching their contents. Definitions and example code fences do not
become asserted dependencies. Unsupported schemes and missing anchors are gaps.

Heading slugs use the extractor's documented lowercase/punctuation-stripping
algorithm. They cover common GitHub headings but do not claim full CommonMark or
GitHub rendering parity: custom HTML anchors, shortcut reference links, generated
anchors and embedded-language dependencies remain outside scope. PR source ranges
are the authoritative section locator; the browser opens the PR and shows its
retained section text because GitHub does not provide immutable body revisions.

## Rebuild, replay and browse

```bash
just assure-prs                   # explicitly refresh GitHub metadata
just assure-build                 # rebuild all three levels after staging paths
just assure                       # offline integrity and freshness, all levels
just assure-browser               # http://127.0.0.1:8788
node utils/assure-detail.mjs replay 'EXACT_OBJECT_OR_SECTION_ID'
```

Copy an exact ID from the browser, which supports search, level/type/relation
filters, incoming/outgoing traversal, bounded depth, a clickable directed graph,
keyboard-accessible relation lists, history/deep links, and source inspection.
Search lists the first 100 matches; neighborhoods show at most 70 nodes and say
when truncated. Filters apply to traversal as well as display, with the selected
root retained. Disable containment to avoid walking through a large log/file.
Evidence details preserve relation direction, original text and resolution rule.
Source inspection verifies the stored content hash and refuses drift.

The read-only server binds to loopback, validates Host, serves a fixed asset map,
and accepts source requests only by existing graph IDs. It never serves arbitrary
repository paths, `.env`, an AI API or a writable endpoint. Source/PR text is
rendered with `textContent`. All scripts/data are local, with no CDN, telemetry,
provider or model download. Cytoscape's canvas positioning requires inline style
attributes in this utility's CSP; the fixed container rule comes from local CSS instead of injected stylesheet text.
Script policy remains self-only. The chess
application and its stricter policy are unchanged.

## Browser foundation comparison

Reviewed against the projects' own documentation and licences on 25 October 2026.

| Base project | Relevant fit | Decision |
| --- | --- | --- |
| [Cytoscape.js](https://js.cytoscape.org/) | Browser/headless graph model, built-in traversal/layouts and interactive canvas; no external runtime dependencies; [MIT](https://github.com/cytoscape/cytoscape.js/blob/v3.34.4/LICENSE). | Selected: one exact development dependency, `cytoscape` 3.34.4, locked with registry integrity. Existing npm installation supplies the local ESM asset. It is not shipped in the chess app. |
| [Graphology](https://graphology.github.io/) with [Sigma.js](https://www.sigmajs.org/get-started/quickstart/) | Flexible graph model/algorithms plus WebGL rendering, useful for larger global networks. Graphology is [MIT](https://github.com/graphology/graphology/blob/master/LICENSE.txt); Sigma's [MIT licence](https://github.com/jacomyal/sigma.js/blob/main/LICENSE.txt) is compatible too. | Appropriate alternative if full-network exploration becomes necessary; two components and coordinate/layout integration add little to this bounded-neighborhood browser today. |

The small index/search/traversal adapter stays independent of the renderer, so
JSON graphs and their types remain usable with either foundation. The utility is
GPL-3.0-or-later like this repository; Cytoscape retains its bundled MIT notice
and [upstream licence](https://github.com/cytoscape/cytoscape.js/blob/v3.34.4/LICENSE). No vendored
minified library or new application runtime dependency is committed.
