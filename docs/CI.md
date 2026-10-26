# Local CI

`just ci` runs the CI workflow, `.github/workflows/ci.yml`, on this machine against a clean checkout of a commit. Use it before pushing, so a push starts GitHub's workflows on a branch that already passes, and in place of Actions whenever GitHub doesn't start jobs. `just ci --post` reports the result to the PR as commit statuses. The runner is a port of the local CI in propeller and lakeshore (TODO 0.18).

## Why

Between 21 and 25 October 2026, repeated pushes to a long PR stack restarted four workflows each time: CI, Container, Security baseline and CodeQL. The 25 October snapshot counted 139 CI runs and about 4,000 Linux runner-minutes, 2,900 of them Playwright (see DONE.md, 2026-10-26). Kibitz is public, so those minutes were free, and its Actions runs kept passing. The same account's private repositories, however, were refused Actions jobs from 25 October ("recent account payments have failed or your spending limit needs to be increased", lakeshore's docs/ci/README.md). A local run before each push catches failures without spending runner time. It also keeps PRs checkable if Actions stops for this repository too.

## The workflow it runs

The CI workflow stays the one definition of CI; the local run reads it from the commit.

| Job | What it checks | Local time |
| --- | --- | --- |
| `check` | `npm ci`, ESLint, `tsc`, ASVS and assurance checks, build, unit tests, `npm audit` | a few minutes |
| `e2e` | Playwright browsers, the assurance browser tests and the full e2e suite | the longest job |
| `native-macos` | Archived native OS/TLS/storage policy cases | platform-specific |
| `secrets` | gitleaks | about 40 s |

The other workflows run on GitHub only: Container (Docker image and persistence), Security baseline (ZAP and the mock staging server) and CodeQL (needs GitHub code scanning).

## How the local run works

`just ci` runs `site/scripts/ci/run.mjs`, with Node and no dependencies. `site/scripts/ci/workflow.mjs` maps the workflow to local steps. It is pure and tested in `site/tests/unit/ci-workflow.test.mjs`, which also checks that the repository's own `ci.yml` maps completely.

1. **The commit, not the working copy.** The run reads `ci.yml` as it is in the commit and runs it in a fresh worktree of that commit in the temporary directory, removed afterwards (`--keep` keeps it). Uncommitted changes can neither make it pass nor break it.
2. **Steps as written.** `run` steps execute with `bash -eo pipefail` in the declared working directory, with the workflow's, job's and step's `env`, plus `CI`, `RUNNER_TEMP`, `GITHUB_SHA`, `GITHUB_WORKSPACE` and `GITHUB_STEP_SUMMARY`. `if:` takes `success()`, `failure()` and `always()`. The job's `timeout-minutes` applies. Both jobs run `npm ci` in `site/`; the second one is skipped, since the jobs share the worktree.
3. **Actions mapped.** `actions/checkout` is the worktree. `actions/setup-node` uses this machine's Node and notes a different major version than `.nvmrc`. `gitleaks/gitleaks-action` runs the `gitleaks` binary over the history up to the commit (`brew install gitleaks`). `actions/upload-artifact` copies the files to `.ci/<run>/artifacts/`. `--with-deps` is dropped from `playwright install` outside Linux, because it installs system libraries with apt.
4. **Reduced environment.** Steps see only `PATH`, `HOME`, `USER`, `LOGNAME`, locale and `TMPDIR`, so API keys in the shell don't reach them. `.env` isn't in the worktree. `claude` and `codex` are shadowed by commands that fail: CI never calls a live model.
5. **Errors instead of drift.** An action without a local equivalent, an expression in a `run` step or its `env`, another condition, a `shell` default, services, a matrix or another unknown key stops the run before anything runs. Add the mapping in `workflow.mjs` when the workflow needs one.
6. **One run at a time.** Playwright's port is fixed, so a second run waits for the first (a lock in `.ci/`). Before starting, the run checks for 2 GB of free space.
7. **Stopping cleanly.** Each step runs in its own process group. A timeout, Ctrl-C or a kill stops the step and everything it started, removes the worktree, and sets the statuses of unfinished jobs to `error`.
8. **Output.** `.ci/<date>-<commit>/` (git-ignored) holds a log per job and `summary.md` with jobs, steps and times. On a failure, the end of the step's log is printed.

## The workflow for a PR

1. **Before pushing:** commit, then `just ci`. `just ci --job check` runs one job, for example while iterating; run all jobs before the push that asks for review.
2. **Push once the run passes.** Batch fixes, documentation and DONE.md updates into that push instead of following it with more, since each push restarts every GitHub workflow.
3. **Without Actions:** after pushing, `just ci --post`. It checks that the commit is on GitHub, sets `pending` for each job, then one commit status per job, `local / <job name>`. Run it again after every push, since a status belongs to one commit. Merge when every `local / …` status on the head commit is green, and say in the PR that CI ran locally.
4. **Dependabot PRs:** read the diff first, since local CI runs the new packages on this machine, then `just ci --post origin/<branch>`.

Commit statuses use the GitHub API, not Actions; the token stays with `gh`.

| Command | What it does |
| --- | --- |
| `just ci` | All jobs on `HEAD` |
| `just ci <rev>` | On another commit |
| `just ci --job check,secrets` | Selected jobs |
| `just ci --post` | And set the commit statuses (the commit must be pushed) |
| `just ci --keep` | Keep the worktree for inspection |

## Differences from GitHub Actions

- **Platform:** macOS on Apple Silicon instead of Ubuntu x86-64, and the machine's Node instead of the `.nvmrc` version. A failure that occurs only on Linux or Node 24 slips through until Actions runs.
- **Caches:** npm's cache and Playwright's browsers are the user's; `npm ci` still installs exactly the lock file.
- **Secret scanning:** locally gitleaks scans the whole history up to the commit; on GitHub the action scans the PR's commits.
- **Not a sandbox.** Steps run as the user, with the user's files and network. Local CI runs only our own branches and reviewed Dependabot changes. The reduced environment keeps tokens out of reach by accident, not against hostile code.
- **Statuses are self-reported.** They show that the run passed on that machine for that commit, not on an independent runner; `summary.md` and the logs are the evidence.

## Integration into secdrift

PR #154 targets the preserved security-drift branch. Its CI workflow also contains
a native-macOS job and Linux bubblewrap installation steps. The local runner keeps
those shell commands as written; it does not translate OS prerequisites or emulate
the other platform. A complete archived workflow cannot be assumed to pass on one
local machine. The base integration preserves the archive's application and
workflow files; no further test run was performed for conflict resolution.
