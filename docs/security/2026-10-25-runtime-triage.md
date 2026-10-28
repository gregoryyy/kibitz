# Initial runtime advisory exposure review

Reviewed 2026-10-25 for the exact image in
[the sanitized scan record](2026-10-25-image-advisories.json), implementation
`92ccc07`. Its config identifies **Linux/amd64**. This source/vendor review adds
analysis to the release packet; **all 31 raw findings and owner dispositions remain
pending**. It neither proves native call-chain absence nor accepts residual risk.

There are 25 distinct CVEs: seventeen medium and eight low. The scanner expands
two GCC source advisories across four binary packages, producing eight entries;
the complete package count is 23 medium/eight low. Keep the original package
identities and counts, rather than deduplicating the evidence or assuming four
independent exploit paths.

## Vendor status and installed versions

The official Debian tracker was checked for each CVE below and for the
[glibc](https://security-tracker.debian.org/tracker/source-package/glibc),
[gcc-14](https://security-tracker.debian.org/tracker/source-package/gcc-14) and
[zlib](https://security-tracker.debian.org/tracker/source-package/zlib) sources.
At review, Trixie retains the affected versions. Some advisories are classified
for deferred/no separate security announcement, or disputed/unimportant upstream;
those classifications are not fixes or this project's risk acceptance.

| Source | Installed runtime packages/version | Raw findings |
| --- | --- | --- |
| gcc-14 | `gcc-14-base`, `libgcc-s1`, `libgomp1`, `libstdc++6`: `14.2.0-19` | Eight medium, from two CVEs |
| glibc | `libc6`: `2.41-12+deb13u4` | Thirteen medium/eight low |
| zlib | `zlib1g`: `1:1.3.dfsg+really1.3.1-1+b1` | Two medium |

## Application observations and limits

The [supplied Compose recipe](../../compose.yaml) has a read-only root, dropped
capabilities and no-new-privileges; the [entrypoint](../../Dockerfile) starts Node
as UID/GID 1000. Actual CI checks exercise those process/private-file boundaries.
No first-party native binding or invocation of the named POSIX formatting,
word-expansion, regex, resolver-debug, iconv or compression functions was found
in `site/server/` and `site/scripts/serve.mjs`. This is a source-search observation,
not a binary symbol audit: Node/V8/OpenSSL/SQLite/SDK/native dependencies may use
underlying libraries without a JavaScript call bearing their names.

The following exposure notes are **inferences from the vendor prerequisites and
the supplied app/configuration**. They do not cover arbitrary operator endpoints,
host services, other CPU architectures, native checkout execution or changed
container privileges/mounts. No operator environment was inspected, exploit run,
provider contacted or image silently replaced.

## Medium advisories

| Advisory and vendor prerequisite | Initial review / remaining evidence |
| --- | --- |
| [CVE-2026-102010](https://security-tracker.debian.org/tracker/CVE-2026-102010): libstdc++ heap-queue `erase_if` | Native Node/dependency use is unverified; a source-package association alone does not establish the affected operation. |
| [CVE-2026-95619](https://security-tracker.debian.org/tracker/CVE-2026-95619): oversized aligned C++ allocation | Keep native allocation exposure unresolved; JavaScript-only app code does not exclude runtime C++ paths. |
| [CVE-2026-18374](https://security-tracker.debian.org/tracker/CVE-2026-18374): controlled `fopen` charset mode | No first-party mode-string interface found; native callers remain unverified. |
| [CVE-2026-19499](https://security-tracker.debian.org/tracker/CVE-2026-19499): `strfmon` padding | No first-party POSIX monetary-formatting interface found; native callers remain unverified. |
| [CVE-2026-19542](https://security-tracker.debian.org/tracker/CVE-2026-19542): sufficiently deep `tdelete` tree | App collections do not expose this native API; dependency/runtime use remains unverified. |
| [CVE-2026-5435](https://security-tracker.debian.org/tracker/CVE-2026-5435): deprecated DNS debug printing | Do not equate these debug functions with every DNS lookup; no app interface found, native use unverified. |
| [CVE-2026-6238](https://security-tracker.debian.org/tracker/CVE-2026-6238): malformed data in deprecated DNS debug printing | Same interface distinction; vendor says ordinary resolver execution does not use these functions. |
| [CVE-2026-6368](https://security-tracker.debian.org/tracker/CVE-2026-6368): appended `wordexp` results | No first-party shell word-expansion interface found; native callers remain unverified. |
| [CVE-2026-6791](https://security-tracker.debian.org/tracker/CVE-2026-6791): oversized username in `wordexp` tilde expansion | Model tools do not execute shell text; native callers remain unverified. |
| [CVE-2026-77117](https://security-tracker.debian.org/tracker/CVE-2026-77117): SHIFT_JISX0213 conversion retry | No first-party iconv interface found; confirm actual native conversion paths before excluding exposure. |
| [CVE-2026-80489](https://security-tracker.debian.org/tracker/CVE-2026-80489): EUC_JISX0213 conversion retry | Same unresolved native-conversion question, for a separate encoding. |
| [CVE-2026-8674](https://security-tracker.debian.org/tracker/CVE-2026-8674): long resolver search domain | **Deployment review needed:** provider hostnames can require resolution; host/DHCP/VPN/Docker resolver configuration may matter. No blanket unused-function exclusion. |
| [CVE-2026-86805](https://security-tracker.debian.org/tracker/CVE-2026-86805): privileged loader path/race prerequisites | Non-root/no-new-privileges reduces the supplied container's privilege path; verify binary metadata/host assumptions before a disposition. |
| [CVE-2026-89092](https://security-tracker.debian.org/tracker/CVE-2026-89092): enabled `nscd` with hostile DNS data | No `nscd` package/startup appears in the fourteen-package inventory/Node entrypoint. Host services and changed mounts are outside that observation. |
| [CVE-2026-95818](https://security-tracker.debian.org/tracker/CVE-2026-95818): privileged loader path processing | Review alongside 86805; container privileges are mitigation evidence, not a general native-host exclusion. |
| [CVE-2026-27171](https://security-tracker.debian.org/tracker/CVE-2026-27171): CRC32 combine helpers | No first-party interface found; inspect the packaged binary's linkage/native consumers before excluding it. |
| [CVE-2026-85091](https://security-tracker.debian.org/tracker/CVE-2026-85091): stalled nonblocking gzip writes | Vendor describes a later introduced feature while Debian still marks this source affected. Resolve that range/backport discrepancy with upstream/package evidence; keep the finding. |

## Low advisories

| Advisory and vendor prerequisite | Initial review / remaining evidence |
| --- | --- |
| [CVE-2010-4756](https://security-tracker.debian.org/tracker/CVE-2010-4756): expensive native glob patterns | No first-party native glob interface found; existing request bounds do not prove all native glob callers safe. |
| [CVE-2018-20796](https://security-tracker.debian.org/tracker/CVE-2018-20796): crafted POSIX regex recursion | No first-party POSIX regex binding found; app regex checks do not audit native-library regex callers. |
| [CVE-2019-9192](https://security-tracker.debian.org/tracker/CVE-2019-9192): separate crafted POSIX regex recursion | Retain separately from 20796; same native-call-chain gap. |
| [CVE-2019-1010022](https://security-tracker.debian.org/tracker/CVE-2019-1010022): stack-guard bypass after corruption | Upstream disputes security impact; no general claim that native memory corruption is impossible. |
| [CVE-2019-1010023](https://security-tracker.debian.org/tracker/CVE-2019-1010023): running `ldd` on hostile ELF input | The supplied entrypoint/tool catalogue does not offer this operation; native/operator execution paths require their own scope. |
| [CVE-2019-1010024](https://security-tracker.debian.org/tracker/CVE-2019-1010024): address-randomization bypass | Upstream disputes security impact; retain as a hardening condition, not a new standalone app exploit claim. |
| [CVE-2019-1010025](https://security-tracker.debian.org/tracker/CVE-2019-1010025): thread-heap address prediction | Same unresolved hardening/combined-exploit review; vendor dispute does not change the raw result. |
| [CVE-2026-97399](https://security-tracker.debian.org/tracker/CVE-2026-97399): Power8-specific string comparison | The published CPU prerequisite does not match this actual amd64 config. Keep the package finding and require separate evidence for another platform. |

## Follow-up and deadlines

Prioritize resolver configuration and native runtime/linkage review, then confirm
the privileged-loader, conversion, allocation and disputed-range prerequisites.
Watch stable Debian/Distroless updates for vendor fixes. Do not mix binaries from
another distribution or replace the pinned image without reviewing provenance,
licences, compatibility and fresh exact-image/test evidence.

The original project first-reported date remains 2026-10-25. Medium review is due
2026-11-01/remediation 2026-11-24; low review is due 2026-11-24/remediation
2027-01-23. An accepted exception needs the owner's explicit scope, mitigation,
revised deadline and review date under [the maintenance policy](supply-chain.md#component-maintenance-policy).
No exception is recorded here. Build stages, Actions, embedded Node/WASM internals
and model provenance retain their separate incomplete release review.
