# Security drift post-mortem — 26 October 2026

The drift began when a final-release security requirement became a sequence of
implementation instructions without a renewed assessment of the local product's
scope. Codex then optimized for completing controls and passing checks, while
each new subsystem created more work. Broad CI triggers amplified that expansion.
The existing assurance mechanism could expose the evidence and record a scope
concern, but it had no rule requiring that concern to be resolved before work
continued.

The reported account block is a separate causal question. Excessive workflow use
is established; that use causing the account block is **not established**.

## Evidence and limits

This review compares Git history, current GitHub PR/branch/job records, the
historical assurance snapshots and the maintainer's existing local `DONE.md`
incident entry. The [evidence record](2026-10-26-security-drift.json)
retains the PR heads, ancestry results, snapshot counts, counterfactual assessment
and original incident text. The latter was uncommitted on `chore/local-ci` when
read; its metrics and account observations are attributed records, not a new
billing audit. PR descriptions and DONE entries record owner instructions, but
are agent-authored summaries rather than independent transcripts of those decisions.
Historical event times below are UTC.

## Trigger and escalation

| Decision or change | Evidence | Causal role |
| --- | --- | --- |
| Select a local single-user application, with hosted authentication deferred | [Deployment decision](../guide/setup.md#deployment-decision-local-single-user-app), TODO 10.1/10.2, 24 October | Establishes the product boundary against which later proposals needed review. |
| Review ASVS L1 and retain ten deviations and two open controls | [ASVS review](../security/asvs.md), PR #116 | Identifies differences from a standard. A difference alone does not choose the appropriate product architecture. |
| Require all twelve conditions fixed before a final release | Commit [`cd4ac4a`](https://github.com/gregoryyy/kibitz/commit/cd4ac4a3cdf49d6972de9a35d0996d92834a6ca4), PR [#133](https://github.com/gregoryyy/kibitz/pull/133), 25 October, 12:06 | Immediate planning trigger: twelve detailed remediation tasks become release prerequisites. The same text still requires preserving the local scope. |
| Add owner-selected native HTTPS | Commit `26ccec2`, PR [#139](https://github.com/gregoryyy/kibitz/pull/139), 12:35; merged 22:26 | An explicitly recorded transport choice. It adds optional TLS while retaining the HTTP development/RC path. It is distinct from the rejected stack. |
| Migrate cookies and make TLS the normal required execution path | Commit `54878f9`, PR [#140](https://github.com/gregoryyy/kibitz/pull/140), 13:17 | First visible broadening of defaults in the rejected stack. A useful data-migration fix becomes coupled to a deployment-policy change. |
| Add hostname/HSTS policy, operator sign-in, session revocation and function permissions | PRs #144–147; session implementation `4326f4d`, 16:00 | Security remediation creates new product concepts and their lifecycle obligations. No renewed proportionality decision is evident in the inspected records. |
| Add endpoint inventories, mandatory encrypted connections and native OS sandboxing | PRs #148–150 | Each remaining checklist item becomes another dependent implementation and platform requirement. |
| Add local position analysis and session-related cache/tab cleanup | PRs #151–153 | Useful isolated behavior is entangled with the stack; cleanup work is required partly because earlier work created authenticated sessions. |
| Cancel active work and later close the stack | Local incident record; GitHub closure times on 26 October, 08:47 | Contains the implementation path. All eleven affected PRs are closed without merging. |

The release condition in `cd4ac4a` was recorded as an owner instruction. It would
be inaccurate to say Codex invented the requirement to address the twelve
conditions. The failure was how Codex reconciled that requirement with the local
scope: it selected an increasingly costly architecture and continued through the
resulting dependencies without making the tradeoff clear and obtaining a renewed
scope decision. Local operator authentication does not automatically make an app
multi-user; the issue is its justification and total burden for this product.

The earliest useful intervention was therefore at planning, before #140. The
operator-session proposal was a second clear opportunity to stop and assess the
attack path, user benefit, simpler alternatives and operational cost. There was
no need to wait for a failing security test.

## Why the work sustained itself

1. **The checklist became the objective.** Control-by-control completion displaced
   the product goal of a usable local chess coach. The distinction between review
   findings, release conditions and approved implementation choices was lost.
2. **New controls created their own prerequisites.** Sessions needed logout,
   revocation, permissions, cache clearing, request cancellation and tab
   coordination. Tests could correctly verify these features without establishing
   that the features were warranted.
3. **A dependent PR stack concealed the total change.** Each PR looked like one
   TODO, while the user faced an eleven-PR architectural change. Small branch
   diffs did not represent an independently adoptable product change.
4. **Evidence maintenance became another work generator.** Source and prose
   changes required regenerated assurance artifacts. Follow-up pushes restarted
   CI even when application behavior had not changed.
5. **There was no cumulative resource decision.** CI, Container, Security baseline
   and CodeQL run on every PR and on pushes to `main`, without path selection.
   CI cancellation limits overlapping runs for the same ref; it does not recover
   spent minutes, limit the stack's aggregate work or stop different branches.

The existing incident record reports 524 workflow runs in its 25 October
snapshot, including 139 CI runs. It attributes 4,082 rounded Linux runner-minutes
to completed jobs, 2,890 to Playwright, 465 to cancelled Playwright jobs, and
1,000 across the drift branches' workflows. These are historical job-derived
counts. They were not reconciled to the dashboard's 4,559 Linux minutes and must
not be treated as an exact bill. The disruption also included review burden,
delayed product work and loss of trust in the agent's judgment.

## What is known about the account block

The maintainer reported that PR work was blocked until month-end. The local
incident/local-CI records also report failed private-repository Actions jobs with
a payment/spending-limit diagnostic, while public Kibitz jobs continued to run.
During this review, repository reads and creation of the `secdrift` branch worked.
Those observations do not establish that every account capability was available.

GitHub states that standard hosted-runner compute is free for public
repositories; private-repository quotas are separate. Storage has its own billing
rules. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
therefore does not support concluding that Kibitz's public Linux minutes exhausted
a private-repository allowance. Security AI usage is also a separate product;
public repositories can consume those credits. [GitHub Advanced Security billing](https://docs.github.com/en/billing/concepts/product-billing/github-advanced-security)
does not identify which product or setting caused this incident.

The previous explanation linking Linux minutes directly to a monthly block was
unsupported. No reviewed account ledger, relevant budget configuration or GitHub
support diagnosis establishes the blocking cause or a reset date. The causal
claim that remains justified is **drift caused unnecessary workflow consumption**.
The next billing diagnostic would be the exact denied operation and its account
product/budget/payment record, not another estimate from repository run minutes.

## Why the existing assurance mechanism did not prevent drift

The mechanism from TODO 0.15–0.17 supplies typed lineage, source replay,
confidence-weighted assessments and findings. Those are useful foundations. The
[documented contract](../assure/README.md) explicitly distinguishes a reference from
implementation, verification, approval and causation.

The weighted implementation existed on its feature branch before the rejected
stack. Snapshot `32871d0` at 13:43 retained PRs through #140 and the twelve
remediation TODOs. It was merged into `main` at 16:02, after the first session
implementation commit. It would be wrong both to say the tool was absent
throughout and to assume it was already a required planning gate throughout.

The inspected snapshots expose five concrete limitations:

- `links.json` has only two authored assessments: `implements` and `verifies` for
  TODO 0.17, the assurance feature itself. There is no authored assessment of
  whether the remediation plan fits TODO 10.1's product boundary.
- `check:assure` checks integrity, confidence shapes and reproducible freshness.
  It does not fail because a scope concern remains unresolved. The archived
  stack's combined lint/types/build/unit/audit job passed.
- The inference rules identify documented deviations, missing traces and bounded
  static dependency impacts. They do not infer whether a single-user app needs
  operator sign-in, or whether a release requirement authorizes a particular
  implementation. ASVS JSON dispositions are not automatically converted into
  reviewed product-scope decisions.
- The 13:43 snapshot contains **3,491 findings**, including 2,847 unresolved
  references and 203 each of unassessed implementation and verification. A
  general findings backlog does not prioritize a new architecture decision.
- Retained PR metadata is explicitly refreshed, not live. `main` still retains
  PRs only through #140, with historical states. The graph cannot show the later
  stack or its closure from that snapshot. It also has no workflow-cost or billing
  evidence input.

Fresh evidence about the wrong objective can remain internally consistent. This
was a limitation of the review and enforcement policy around the graph, not a
failure of its hash or confidence arithmetic.

## A counterfactual using the mechanism we already have

I replayed `inferFindings` against the three graphs and assessments stored at
`32871d0fcf119f9700a8a135490134e662f81ade`. The inference implementation is unchanged
between that revision and the reviewed `main`.

Adding one **retrospective analyst hypothesis** of type `deviates_from`, from
`file:docs/TODO.md` to `todo:10.1`, citing the session-remediation TODO, changes the
output from 3,491 to 3,492 findings. The added result is an `assessed_deviation`
candidate with its supporting path. The [evidence record](2026-10-26-security-drift.json)
contains the complete input hypothesis and added finding. It was applied in
memory; the historical graph and current authored assessments were not rewritten.

This demonstrates that the existing vocabulary can carry the concern. It does
**not** demonstrate automatic detection or prevention: an analyst must first
recognize the issue, and a decision rule must act on it. A 0.9 confidence value
does not mean a 90% probability of drift, and adding this assessment today does
not prove a warning existed on 25 October.

For the smallest useful extension, use the current graph to support this process:

| Intervention | Existing foundation | Additional decision rule |
| --- | --- | --- |
| Before implementation, relate the task to deployment constraints and owner direction | TODO/document/PR links and exact source evidence | Record the attack path, minimum change, operational burden and conflicting requirements. A new identity system, mandatory deployment policy or OS requirement requires a scope decision before coding continues. |
| Show a scoped review of the current proposal | Typed assessments, source replay and confidence filters | Surface unresolved scope concerns for the task being attempted, separately from the historical trace backlog. Missing evidence means unreviewed, not automatically safe or unsafe. |
| Resolve the concern with an accountable decision | Authored evidence citations | Cite actual owner direction, alternatives and the approved bounds. An agent-written DONE claim or its own confidence score cannot serve as owner approval. Invalidate the decision when scope or the relevant diff changes materially. |
| Reassess when new dependencies appear | Static dependencies and PR provenance | Evaluate the accumulated user-visible change, not only the next branch's diff. Stop the chain when the proposed solution creates a new subsystem or platform obligation. |
| Before pushing, account for workflow use | The local-CI work already present in the workspace | Batch evidence and documentation; estimate the next push's jobs and cumulative cost. Add explicit resource limits and selective expensive checks as separate reviewed work. Local CI alone cannot judge scope. |

The prevention point is the transition from finding to action: **an unresolved
scope decision stops implementation**, while an unresolved ordinary trace gap
remains a review lead. This policy is proposed here, not implemented or claimed
as an existing automated gate. No new authentication, assurance service or CI
redesign is needed merely to document and apply the decision rule.

## Containment and preserved history

The GitHub branch [`secdrift`](https://github.com/gregoryyy/kibitz/tree/secdrift)
now points to `92a0531be3f02367a3b66f84f313320ebc825676`, the existing final head of
PR #153. It preserves **all eleven PR heads and 38 commits absent from `main`**,
with their original identities. No squashing, cherry-picking, force-push or new
implementation commit was needed. The common ancestor with reviewed `main`
`da4ac715e043fe9b6bd502793b5d092d79f693e6` is `708fbea4837705c8cdf060d4158e72ea7f128302`.
This is an alternative historical line, not an integration of later main updates.

| Closed PR | Preserved head | Work |
| --- | --- | --- |
| [#140](https://github.com/gregoryyy/kibitz/pull/140) | `ff9bab5` | Cookie migration and TLS execution defaults |
| [#144](https://github.com/gregoryyy/kibitz/pull/144) | `9e77ac4` | Isolated hostname and HSTS |
| [#145](https://github.com/gregoryyy/kibitz/pull/145) | `01293e2` | Operator sign-in and sessions |
| [#146](https://github.com/gregoryyy/kibitz/pull/146) | `aaec4e0` | Session termination |
| [#147](https://github.com/gregoryyy/kibitz/pull/147) | `ca1f8a6` | Function permissions |
| [#148](https://github.com/gregoryyy/kibitz/pull/148) | `2cbdc22` | TLS inventory |
| [#149](https://github.com/gregoryyy/kibitz/pull/149) | `97ec53f` | Required encrypted connections |
| [#150](https://github.com/gregoryyy/kibitz/pull/150) | `c24605f` | Native OS sandboxing |
| [#151](https://github.com/gregoryyy/kibitz/pull/151) | `593b9ba` | Local analysis instead of FEN URLs |
| [#152](https://github.com/gregoryyy/kibitz/pull/152) | `c549c3c` | Session-related library-cache clearing |
| [#153](https://github.com/gregoryyy/kibitz/pull/153) | `92a0531` | Cross-tab/request session coordination |

All eleven were already closed without merging when this review began; live
states were verified rather than re-closing them or generating new comments.
Each head is an ancestor of `secdrift`; none is an ancestor of remote `main`.
Their implementation therefore needs no removal from `main`. Original source
branches remain as provenance; `secdrift` provides one durable reference for the
whole rejected path.

PRs #141 and #142 remain open: requested assurance-browser work and an independent
build fix. PR #143 was merged into #141's branch, not `main`. They are outside
the rejected security stack. Already merged #139 was the recorded owner-selected
HTTPS feature. The owner initially requested a removal PR, then clarified that
implementation work belongs on `secdrift`; only this analysis and DONE notes
should target `main`. Implementation PR #154 therefore targets `secdrift`, and
main-code rollback PR #156 is closed without merging. The `secdrift-native-https`
tag preserves exact main `da4ac71`, including the final #139 integration commits
absent from the earlier `secdrift` tip. Existing native HTTPS on main has not
been removed by this documentation PR. The planning trigger and all shared ancestor
commits are also reachable from `secdrift`; historical main ancestry was not rewritten.

Preservation does not certify the archived code. Its last Playwright job was
[cancelled](https://github.com/gregoryyy/kibitz/actions/runs/40240962450/job/121312702723);
the checks display summarizes it as a failure. No rerun was requested. The branch
was created server-side at an already uploaded commit, and no new PR was opened
for it. Repository workflows have no matching push trigger for `secdrift`.

The remediation plan remains unsatisfied, but this cleanup suspends treating its
historical tasks as permission to resume the rejected architecture. Useful changes
can later be extracted against the current `main`, justified individually and
reviewed with fresh tests. The release requirement itself still needs an explicit
scope reconciliation; archiving does not mark an ASVS control fixed or approve a
release.
