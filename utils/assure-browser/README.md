# Assurance browser

From the repository root, install the existing site project with `just install`,
then run `just assure-browser` (or `node utils/assure-browser/serve.mjs`). Open the
printed loopback URL. An optional `--port 0` chooses a free port. The browser
reads the three retained graphs in `docs/assure/`; no build or network access is
needed after installation.

See [levels, semantics, replay and foundation comparison](../../docs/assure/levels.md).
Search by file, symbol, TODO number, PR number or rationale text. Select a result,
then follow graph nodes or the relation list. Direction, relation and containment
filters control the walk; Back and copied URL fragments preserve navigation.
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
explained in the [assurance README](../../docs/assure/readme.md). Use the minimum
confidence selector for graph walks and the findings panel for review leads.
