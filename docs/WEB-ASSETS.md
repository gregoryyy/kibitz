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

The isolated raw ZAP rerun and its exact source/report identities must be recorded before TODO 11.5.1 is marked complete. Earlier reports remain historical evidence, including their lower-severity findings. Release approval, local HTTP/account deviations, mutable model identities and unrestricted chess-claim verification remain separate.
