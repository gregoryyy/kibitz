# Assurance browser

From the repository root, install the existing site project with `just install`,
then run `just assure-browser` (or `node utils/assure-browser/serve.mjs`). Open the
printed loopback URL. An optional `--port 0` chooses a free port. The browser
reads the three retained graphs in `docs/assure/`; no build or network access is
needed after installation.

See [levels, semantics, replay and foundation comparison](../../docs/assure/LEVELS.md).
Search by file, symbol, TODO number, PR number or rationale text. Select a result,
then single-click graph nodes, relations, search results or findings to inspect
the element without changing the current path, root highlight, layout, zoom or
pan. Double-click to start a new path from that element. **Walk from inspected
element** offers the same action with a standard keyboard/touch button. Enter or
Space on a result inspects it; use that explicit button to navigate. Back and
copied URL fragments track path changes, not inspections. Direction, relation,
confidence and containment filters still control the current root's walk.
The default **Lineage columns** view groups the complete filtered walk into
Documents & references, Plan, PRs/progress/rationale, and Code & tests. It follows
the stable column/inspection design of Propeller's local lineage browser. Columns
are presentation roles, not inferred causality or edge direction. The selected
depth (1–3), direction, relation, level/type, containment and minimum confidence
still determine reachability; this is not an unlimited transitive closure.

Every reachable element is available: each column pages 40 compact cards, with
counts, First/Previous/Next/Last and direct page selection. **Find within this
path** searches all reachable cards, including other pages, and retains the root.
Only the inspected outline/details change on a single click; column pages,
scroll, root and URL remain stable. The inspector sits beside the columns on
wide screens and below them on narrow screens. Full labels and identities remain
in the inspector; compact cards truncate long text visually.

**Connections of path root** independently lists every matching direct relation
with its stored direction, type, confidence and evidence. Search by neighbor,
type or evidence, use the type count buttons, or page all relations in groups of
40. Expand **Confidence and evidence** on a relation for its full literal record. Parallel relation types remain separate; neighbor counts deduplicate nodes.
This list stays anchored to the reviewed root while inspecting other elements.
The optional **Local graph** retains its explicit 70-node limit and reports its
node count against the full walk. Switch back to columns to review all nodes;
no confidence, dependency or finding rule changes with the presentation.

Choose **Show captured source** to inspect verified text of an object, document
section, fenced block or PR section. Gaps are counted, not converted into claims.

```bash
cd site
npm run test:assure-browser        # focused real-browser tests, mock/offline
npm run check:assure               # offline snapshots and utility lint
```

The graph library is pinned in `site/package-lock.json` and served from installed
Cytoscape.js 3.34.4 (MIT); see [upstream licence](https://github.com/cytoscape/cytoscape.js/blob/v3.34.4/LICENSE).

Confidence-weighted types, analyst overrides and gap/deviation findings are
explained in the [assurance README](../../docs/assure/README.md). Use the minimum
confidence selector for graph walks and the findings panel for review leads.
