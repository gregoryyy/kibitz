# Compiled component and package provenance evidence

This supplements [exact-image advisories](IMAGE-ADVISORIES.md) for TODO 11.6 and
the still-open ASVS 15.2.1/LLM supply-chain review. Package inventory, binary
identity, source provenance and advisory coverage establish different facts.
None is a substitute for the others or release approval.

## Packaged runtime and browser bytes

The container workflow now prepares `runtime-components.json` from the same local
image used by the browser/persistence tests and advisory scan. It records the
actual Node version, platform, CPU architecture and
[`process.versions`](https://nodejs.org/docs/latest-v24.x/api/process.html#processversions)
map, including dependency/ABI versions exposed by that executable. It also hashes
the seven distributed Stockfish/wllama JS/WASM assets and records their sizes.
Missing assets fail capture. The existing image/source/config/rootfs records bind
the separate inventory to its image.

Capture starts a network-disabled, read-only container and reads fixed public
asset names. It records neither environment variables nor diagnostic reports,
operator paths, private storage, model weights or provider responses. The explicit
JSON artifact joins the existing thirty-day inventory retention. Initial actual
Linux capture succeeds at `0936467`, but that run's browser check fails twice on
module loads aborted by Chromium with `ERR_NETWORK_CHANGED`; its advisory scan
does not run. The [corrected actual run](https://github.com/gregoryyy/kibitz/actions/runs/40169822979)
passes all four container cases and the advisory gate at source `5764f74`, merge
`07079b6`. [Retained component evidence](security/2026-10-25-compiled-components.json)
records exact image/config/report/inventory/DB identities and the captured map.
Independent review rechecks config/rootfs/source, the raw advisory gate and exact
package coverage, and compares all seven asset hashes/sizes with the tested local
build. The 23 medium/eight low findings are identical to the prior report; their
original targets and pending dispositions remain unchanged. The local
command smoke test used macOS Node and is not packaged-runtime evidence.

This version map is not a complete binary SBOM, proof of static/dynamic linkage,
compiler/source attestation or advisory scan of every embedded component. A shared
OS library and Node's version of a similarly named component can differ. The byte
hashes identify shipped assets without proving which source produced them.
The actual map includes 29 version/ABI entries, including empty optional entries.
For example, Node reports OpenSSL `3.5.9` and zlib `1.3.2.1-motley-285e94b`, while
the OS inventory separately records `libssl3t64` `3.5.7-1~deb13u3` and `zlib1g`
`1:1.3.dfsg+really1.3.1-1+b1`. Neither version list establishes native linkage.

## Pinned npm metadata

The [dated record](security/2026-10-25-package-provenance.json) retains two package
identities, lockfile SHA-256, exact SHA-512 integrities, registry URLs and replayable
public signatures/keys. Both package integrities match the repository lockfile;
all four returned registry signatures verify, and a changed signed payload fails.
Verification uses the official registry's current nonexpired keys and
[npm's documented name/version/integrity payload](https://docs.npmjs.com/about-registry-signatures/).
The keys and signatures are public verification material, not API credentials.

This checks registry signatures over `name@version:integrity`. It does not sign
`gitHead`, attest a publisher's build or independently re-download/extract the
tarball. Normal locked `npm ci` supplies its separate tarball-integrity check.
Neither pinned package advertises a provenance attestation in the inspected
version metadata. No package install script, model download or inference is run
by this review.

## Source candidates and unresolved compilation link

| Package | Observed source evidence | Limit |
| --- | --- | --- |
| wllama 3.8.1 | npm reports commit `b68fd6427063266176bb0054befe9ff70b3258f1`; official [release tag](https://github.com/ngxson/wllama/releases/tag/3.8.1) resolves to `7ed17361caf221a84aa1e80ca85a3d6324f3af85`. Both exact trees declare llama.cpp gitlink `46ca246de9bb1c35269722a6240d37d9dfd79cad`. | Tag and npm source commits differ. The shared gitlink is source-candidate evidence, not proof that the npm WASM was compiled from it. |
| Stockfish.js 19.0.1 | Official [v19.0.1 tree](https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6) resolves to `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`; package/version and delivered bytes have their own pins. | Registry metadata supplies no `gitHead` or advertised build attestation. The tag alone cannot prove corresponding binary compilation. |

wllama's [exact npm-reported source declaration](https://raw.githubusercontent.com/ngxson/wllama/b68fd6427063266176bb0054befe9ff70b3258f1/.gitmodules)
names the original llama.cpp repository. Its gitlink resolves to the exact
[upstream commit](https://github.com/ggml-org/llama.cpp/commit/46ca246de9bb1c35269722a6240d37d9dfd79cad).
These links make upstream inspection possible without guessing a current branch.
The npm-reported commit is unsigned registry metadata; the registry signature
verified above covers only the package identity/integrity payload.

## Browser-model source revisions

The two catalogue GGUF downloads now select full official Qwen commits. On
2026-10-25, exact-revision API metadata and raw Git LFS pointer text matched the
existing file sizes and SHA-256 pins. The pointer text also reproduces the Git
blob IDs reported by those exact trees. The
[retained record](security/2026-10-25-browser-models.json) contains the pointers,
revision URLs and hashes of the observed model-card/licence metadata:

| Model | Official repository revision | Existing weights |
| --- | --- | --- |
| Qwen2.5 1.5B Instruct Q4_K_M | [`91cad51170dc346986eccefdc2dd33a9da36ead9`](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/91cad51170dc346986eccefdc2dd33a9da36ead9) | 1,117,320,736 bytes; unchanged SHA-256 |
| Qwen2.5 0.5B Instruct Q4_K_M | [`9217f5db79a29953eb74d5343926648285ec7e67`](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/9217f5db79a29953eb74d5343926648285ec7e67) | 491,400,032 bytes; unchanged SHA-256 |

Hugging Face [documents selecting a full commit](https://huggingface.co/docs/huggingface_hub/guides/download#from-specific-version)
for a particular file revision. The runtime download still verifies the complete
weight response independently. This review fetched only small metadata, licence,
model-card and pointer text; it did not download or independently rehash weights.
API responses include mutable service metadata even at a fixed repository
revision; their recorded response hashes identify this observation, not an
immutable API representation. Offline tests replay the retained pointers and
check catalogue agreement. The actual-CLI regression intercepts every fetch with
tiny synthetic bytes while preserving the production source locators.

The model cards declare the respective Qwen instruct base models and Apache-2.0
licences. Those are publisher statements, not independent training/quantization
lineage, signed build attestations, model-safety or chess-quality evidence. A
revision pin does not promise permanent hosting. The
[upgrade procedure](OFFLINE.md#model-weight-downloads) keeps source, bytes,
licence and compatibility review together; cloud/Ollama/Chrome identities and
TODO 11.3.3 remain open.

## Release follow-up

The [dated Action record](security/2026-10-25-action-advisories.json) independently
resolves all six direct wrapper pins to their official version tags, including
CodeQL's annotated tag. A paginated
[official advisory API query](https://docs.github.com/en/rest/security-advisories/global-advisories#list-global-security-advisories)
returns no matching reviewed, non-withdrawn advisories for those six exact
versions. It excludes unreviewed reports/malware and does not establish complete
coverage, review wrapper code, or inventory bundled dependencies, downloaded tools,
runner runtimes or hosted-platform changes. No pin, token, repository setting or
alert disposition was changed by this read-only review.

Review actual Linux version/hash output against the image and package pins before
using it. Check vendor advisories for those component versions and assess bundled
build flags/backports/call paths; broad package matching alone cannot establish
native reachability. Obtain reliable build/source linkage where absent or record
the remaining gap explicitly. Build stages, GitHub Actions and browser/model
runtime changes retain their separate advisory/age and licence review.

The [release packet](RELEASE-REVIEW.md) keeps ASVS 15.2.1 and TODO 11.3.3 open.
Mutable cloud IDs, Ollama tags, Chrome-managed updates and model-training provenance
are not fixed by these package or byte records. No release, finding suppression,
owner exception, provider test or teaching-quality claim follows from this work.
