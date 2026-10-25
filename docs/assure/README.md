# Assurance lineage

The [typed graph](lineage.json) connects tracked file artifacts, every numbered
[TODO item](../TODO.md), every [DONE entry](../DONE.md), and its individual
insights and deviations. Start with the [generated report](REPORT.md) for the
type diagram, inventory, TODO/DONE indexes and gaps. The [JSON Schema](schema.json)
describes the data; [types.mjs](types.mjs) defines relation direction and validates
shapes, endpoints, ownership and planning hierarchy offline.

```bash
just assure-build                 # refresh the three generated artifacts
just assure                       # validate integrity and exact freshness
just assure-query 11.3.9           # TODO, linked DONE entries and nearby rationale
just assure-query site/src/coach/prompt.js
# Equivalently, with site dependencies installed:
node utils/assure.mjs build
node utils/assure.mjs check
node utils/assure.mjs query todo:11.3.9
```

Each edge retains its file and line range, original reference syntax, and
resolution method. File IDs are `file:REPO_PATH`, TODO IDs are `todo:NUMBER`,
milestones are `milestone:NUMBER`, and DONE IDs use their dated heading slug.
Note IDs combine their DONE identity, type and content digest, so adding an
unrelated entry or shifting lines does not rename them. Editing a note creates
a new content identity. Git retains earlier snapshots; this first graph is a
current-checkout reference graph, not a history of file revisions.

| Relation | From → to | Meaning |
| --- | --- | --- |
| `part_of` | TODO → parent TODO or milestone | Numeric planning hierarchy |
| `recorded_in` | Item/note → file | Where the item is written |
| `references_todo` | DONE → TODO/milestone | Identifier in its TODO annotation, including partial/open context |
| `has_insight` | DONE → insight | A paragraph or bullet under Insights |
| `has_deviation` | DONE → deviation | A paragraph or bullet under Deviations |
| `has_reflection` | DONE → combined reflection | A combined insight/deviation heading, kept without guessing categories |
| `mentions` | File/item/note → file | A resolvable Markdown code-span reference |
| `links_to` | File/item/note → file | A local Markdown hyperlink |
| `imports` | File → file | Literal local JS import, export-from, import expression or require |

TODO status comes only from its checkbox. A DONE annotation can discuss work
still open: for example, the release preparation entry references open TODO
11.6, and completed provider work can reference missing recorded fixtures in
2.15. Edges do not establish implementation, test success, compliance, acceptance
or completion. Insights and deviations keep their original text and context.

The inventory includes only tracked/staged Git paths, including tests, data,
documentation and configuration. Only regular Markdown, JS/MJS and HTML files
are scanned; symlinks and submodules are inventoried without following them.
JavaScript and inline HTML scripts are parsed with the existing ESLint and
parse5 dependencies; source modules are never imported or executed. Package
imports, dynamic nonliteral expressions and generated dist assets are outside
the extracted dependency graph. Functions/classes, runtime call graphs, glob
expansion and HTML/link-anchor validation are future scope.

Markdown links resolve relative to their document. Code-span paths can resolve
as repository/site paths or a unique suffix; this resolution is recorded, and
ambiguous short names stay unresolved. Renamed/missing historical paths,
directory references, unknown TODO identifiers and parse failures remain in
`unresolved`; the report makes them visible. No semantic rename or ownership
mapping is inferred. Numeric TODO ranges and abbreviated sibling lists are
expanded explicitly; unsupported ranges remain visible.

The query returns a two-hop, bidirectional neighborhood, capped at 150 nodes
with an explicit `truncated` flag. It omits containment/hierarchy edges during
traversal to avoid expanding the whole log through its containing file. The
stored graph retains those edges. Use its exact node IDs for DONE/note queries.

When updating artifacts, TODO or DONE, stage new/deleted files, run
`just assure-build`, then stage `lineage.json`, `schema.json` and `REPORT.md`.
Generation is deterministic: there is no timestamp, absolute checkout path or
self-referential HEAD hash. The inventory digest and scanned-input digests make
stale output detectable. The generated outputs are excluded from input scanning
to avoid recursive hashes. `just check` and CI check exact freshness without
rewriting output. Existing unresolved references are data to review, not a
claim that all historical references have been repaired.

The schema uses [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-core).
The offline checker implements only the schema vocabulary used by this contract,
plus graph-specific integrity rules; it is not a general JSON Schema validator.
