# Versioning and releases

TODO 12.1 establishes a version policy and a user-facing
[changelog](../CHANGELOG.md). Kibitz follows
[Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
The package and both root entries in `site/package-lock.json` currently agree on
`0.1.0`. This is a development baseline; there are no release tags at the time
this policy is introduced. This documentation does not publish a release.
The [dated local release review packet](RELEASE-REVIEW.md) collects prerequisite
evidence and outstanding dispositions; it is not release approval.

The compatibility scope is the documented CLI/configuration behavior, gateway
and optional library HTTP contracts, versioned data exports and persisted data
lifecycle, and documented offline update behavior. Internal module organization,
DOM selectors and retrieval heuristics can evolve; record user-visible effects
and ranking/quality changes without promising stable internal implementation.
Stored schema and source-revision identifiers remain independently versioned.
A package version bump alone does not migrate data or make old cached models compatible.

Before 1.0, interfaces are under development. This project still uses patch bumps
for compatible fixes and minor bumps for features or incompatible changes. Describe
every breaking change explicitly, including affected storage/export/API versions,
backup/migration steps and recovery limits. For example, a compatible fix after
`0.1.0` is `0.1.1`; an incompatible next development interface is `0.2.0`.
Use a new major version for incompatible public-contract changes once 1.0 is adopted;
compatible features increment minor and compatible fixes increment patch.
Prerelease identifiers such as `0.2.0-rc.1` mark candidates. Build metadata can
identify a build but does not establish release precedence or compatibility.
Never replace the source or assets behind an existing release tag.

Ordinary feature/fix PRs add concise, user-relevant entries under **Unreleased**
when behavior changes. Group entries as Added, Changed, Fixed, Removed or Security
when useful. Describe the effect and material limitation; keep test logs and
implementation detail in DONE. A source reorganization or documentation correction
does not require inventing a release number. Keep all package/lock versions aligned.

Prepare a release in its own branch and PR:

1. Choose the candidate version and exact source scope. Ensure prerequisites are
   merged through their PRs. Keep the root user guide/changelog consistent with
   the actual candidate rather than planned work.
2. In `site/`, update package and lockfile metadata with
   `npm version VERSION --no-git-tag-version --ignore-scripts`. Substitute the
   reviewed version; inspect the resulting manifest/lock diff. Keep `private: true`
   unless a separately reviewed distribution change requires otherwise.
3. Move the relevant Unreleased entries into a dated version section, leave a new
   Unreleased section, and link the version/tag comparison. Document data/export,
   cookie, model and offline-cache compatibility or migration requirements.
   Back up affected local data before an incompatible migration; preserve unknown
   data rather than silently deleting it.
4. Run lint/JSDoc, build, full unit and browser suites for the candidate. Run and
   record [automated security evidence](SECURITY-SCANS.md),
   [OWASP Top 10](OWASP-TOP10.md), [LLM](OWASP-LLM.md) and [ASVS](ASVS.md) reviews.
   Include exact run/commit identities, unresolved controls/findings and explicit
   owner disposition of deviations. An open high finding blocks release. Retain
   artifacts before their thirty-day expiry; a prior feature's green check is
   not release-commit evidence.
5. Review third-party maintenance deadlines, licences/notices, required source
   availability, packaged components, platform support and documentation. Confirm
   the release's actual deployment/security scope. Confirm the merged container
   and user/provider/Ollama guides match that candidate.
6. Merge only through the approved release PR with passing CI. After explicit
   release authorization, tag its exact merged commit as `vVERSION` and publish
   reviewed release notes/assets. Do not retag a different commit or publish from
   an unmerged feature branch. Correct a released defect with a new version.

Creating this policy completes TODO 12.1. Packaging TODO 12.2 and guides in 12.4
have their separate evidence; the actual release gate in 11.6 still requires
candidate verification and a release decision. Feature and milestone PRs do not
authorize automatic merges or publishing.
