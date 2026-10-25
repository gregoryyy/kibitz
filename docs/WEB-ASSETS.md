# Browser styles and bundled fonts

TODO 11.5.1 addresses the web-asset findings retained by the first [passive baseline](SECURITY-SCANS.md): broad inline-CSS authority, an external stylesheet without SRI, and inconsistent charset spelling. It preserves the original typefaces and the app's self-contained artifact body.

## Policy boundary

The [static policy](../site/server/static.mjs) parses the trusted, descriptor-read HTML with parse5. Complete active HTML/SVG script and style nodes receive separate SHA-256 hashes over browser-normalized text. Comments, raw-text lookalikes, template contents, unsupported type blocks and unfinished tags grant no hashes. Only script nodes use script-type/src semantics; CSS hashes never become script permissions.

`style-src` permits same-origin assets and the exact trusted stylesheet hashes. `style-src-attr 'none'` blocks style attributes; there is no `unsafe-inline` or `unsafe-hashes`. Authored layout choices use CSS classes. Existing JavaScript/CSSOM properties still update trusted board geometry, evaluation/progress bars and viewport variables. The browser regression verifies both blocked injection and working property updates. [CSP Level 3](https://www.w3.org/TR/CSP3/) defines these style-element/attribute boundaries.

This is policy generation for operator-owned build files, not sanitization of user HTML. Every supplied active style/script can receive authority, so the whole input must remain trusted. Imported notes, model text and PGNs continue through literal renderers and quoted prompts. Hashes allow matching bodies; they do not make a same-origin asset store safe against a malicious operator. The existing worker `blob:` and WebAssembly permissions remain necessary and independently reviewed.

Online and offline pages now both restrict fonts/styles to the same origin. The legacy offline transform still removes old Google Fonts link markup from trusted custom pages. The full local document uses canonical `<meta charset="utf-8">`, agreeing with the HTTP header. No scanner rule or path is suppressed to obtain these changes.

## Font provenance and distribution

The original normal variable fonts are bundled unchanged from the official [Google Fonts repository](https://github.com/google/fonts/tree/e7db6ca603fd4862010383ff17ffd6cc4ffac1c0), retrieved on 2026-10-25:

| Family | Local bytes | Upstream authors/licence |
| --- | ---: | --- |
| Bricolage Grotesque | 408,496 | 2022 Bricolage Grotesque Project Authors; [complete SIL OFL notice](../site/src/fonts/bricolagegrotesque-OFL.txt) |
| Instrument Sans | 194,336 | 2022 Instrument Sans Project Authors; [complete SIL OFL notice](../site/src/fonts/instrumentsans-OFL.txt) |
| JetBrains Mono | 187,208 | 2020 JetBrains Mono Project Authors; [complete SIL OFL notice](../site/src/fonts/jetbrainsmono-OFL.txt) |

The [manifest](../site/src/fonts/manifest.json) records exact upstream paths/revision, byte counts and SHA-256 for fonts and licences. [Build verification](../site/scripts/build-fonts.mjs) checks the complete selected inventory before copying; altered bytes or invalid filenames fail the build. There is no automatic fetch/update or font package dependency. Updates need a deliberate source/licence/hash review and another browser/offline check.

The build ships fonts, full licences and the manifest under `dist/fonts/`, with `font/ttf` serving. Public offline bundles hash/cache these files too, adding 790,040 font bytes plus notices/metadata. Font family names remain unchanged; browser/system fallbacks still handle unsupported glyphs or load failures. Local rendering and device rasterization can differ from Google Fonts' former browser-specific subsets. No remote font CSS or connection metadata is sent from the current page, and there is no external stylesheet SRI boundary left. The [third-party notices](../THIRD_PARTY_NOTICES.md) retain the upstream attribution rather than relicensing the fonts as GPL.

## Verification scope

Unit tests cover parsed CSS hash selection and separation, retained font/licence bytes in the built offline inventory, failed publication for corrupted assets, and negative header-policy cases. Chrome regressions cover real policy enforcement, normal module/worker execution, local font loading, German phone layout and no external requests. Existing app/offline scenarios check the broader interaction boundaries. These tests do not substitute for a passive scan or general CSS/HTML sanitizer.

The actual isolated [ZAP rerun](https://github.com/gregoryyy/kibitz/actions/runs/40158959465) at source `00e7d16`, scanned merge `9c8d684`, passes. Independently inspected raw JSON has zero high or medium findings: the CSS, external-stylesheet SRI and charset types are absent. Two informational types remain (six authored source-comment instances and three grouping-cookie responses). All seven required routes appear in fifteen visited paths; sixty passive rules remain enabled, with no pending queue or custom suppressions. The startup log verifies the literal loopback listener. [Sanitized metadata and report digest](security/2026-10-25-web-assets.json) preserve identities without cookies or response bodies. npm audit remains zero with 128 SBOM components.

This completes TODO 11.5.1. Earlier reports remain historical evidence, including their lower-severity findings. Release approval, local HTTP/account deviations, component-advisory gaps, mutable model identities and unrestricted chess-claim verification remain separate.

## Chessground 10.4.2 compatibility follow-up

The dependency update in PR #129 adds a fixed `style="color-scheme:light only"`
to every SVG overlay. The strict `style-src-attr 'none'` policy correctly blocks
those attributes; actual container runs for #130/#134 fail their CSP assertions.
The local build adaptation in `site/scripts/build.mjs` removes that one fixed
attribute declaration from the pinned bundle and keeps its appearance through
`.cg-wrap cg-container > svg` in the trusted page stylesheet. It accepts only
10.4.2 with exactly one expected declaration; an upgrade requires reviewing the
adaptation. Other upstream bundle bytes and all CSP restrictions are retained.

Playwright checks all four overlay layers, arrows, both board orientations and
light/dark themes, including actual computed styles and absence of CSP events.
The old build fails with blocked attributes and a `normal` computed scheme.
The third-party notice identifies the local modification and its reproducible
source. This compatibility fix does not close broader provenance/release gates.
