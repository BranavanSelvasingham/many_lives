# Visual Review Method

This is the operating method for bringing Many Lives from technically correct
screens to a cohesive, legible, portfolio-ready living-world simulation. It
supplements the runtime operating manual, orchestration compass, visual quality
target, and South Quay visual specification. Those documents remain
authoritative for product behavior, priority, convergence state, and art
direction.

## Why This Exists

Pixel checks can reject blank canvases, overlap, lost landmark signatures,
detached routes, and excessive cue counts. They cannot determine whether a
composition is beautiful, whether a landmark has character, or whether the
whole product feels authored by one visual system.

The review method therefore has two independent gates:

1. **Automatic reject gate** for objectively broken evidence.
2. **Human art-direction gate** for composition, consistency, identity,
   legibility, authenticity, and motion quality.

An aesthetic score can never override an automatic failure. Automated checks
can never award aesthetic verification.

## Review Contract

The versioned shot and scoring contract is
[visual-review-contract.json](/Users/branavan/GitHub/many_lives/docs/street/visual-review-contract.json).
It defines:

- 23 deterministic review shots grouped by opening, responsive composition,
  exteriors, edges, routes, interiors, and state authenticity;
- explicit coverage of every active `VQ-01` through `VQ-12` row;
- the four representative shots used for a matched release comparison;
- required browser viewport profiles;
- weighted art-direction dimensions and minimum scores; and
- automatic reject categories.

Changing the contract is a review-policy change. Add, split, merge, or retire a
shot only when current product evidence changes what must be seen. Keep the
contract finite.

## Review Order

Review evidence in this order:

1. **Automatic failures:** missing states, page errors, blank or undersized
   screenshots, viewport gaps, stale identity, broken saved runs, route
   discontinuity, lost interior identity, overlap, clipping, or cue noise.
2. **Thumbnail composition:** scan the complete contact sheet without zooming.
   Look for weak focal order, inconsistent density, unexplained voids, one-note
   color blocks, excessive rail weight, and landmarks that disappear into the
   city.
3. **Matched comparison:** inspect the four representative baseline/candidate
   pairs. Confirm the intended delta and protected strengths using the same
   viewport, state, panel, camera, and DPR. The packet rejects dimensionally
   mismatched pairs and reports changed-pixel fraction plus mean channel delta
   as evidence-integrity diagnostics. Those values describe how much changed;
   they do not score whether the change is visually better.
4. **Full-resolution inspection:** inspect affected shots at 100 percent for
   artifacts, text bounds, material quality, character/prop collisions, stale
   cues, seams, and label attachment.
5. **Runtime motion:** watch route start/mid/arrival, transitions, direct
   interaction, consequence feedback, and the first three to five minutes.
   Static screenshots cannot score motion and pacing.
6. **Record the assessment:** score every dimension, mark every required shot,
   and record each finding with severity, exact evidence, acceptance criteria,
   and status.

## Scoring

Use a 1-5 scale:

- `1`: broken or misleading;
- `2`: materially weak;
- `3`: acceptable but visibly unfinished;
- `4`: polished and release-ready; and
- `5`: exceptional and portfolio-defining.

The weighted score must be at least `4.0`. Every dimension must meet its own
minimum, every required shot must pass, and no finding may remain open. A score
of `5` should be rare and supported by a visible, specific reason.

## Commands

`corepack pnpm visual:game` now generates the candidate review packet under the
visual evidence directory:

```text
visual-review/review-deck.png
visual-review/scorecard.json
visual-review/assessment-template.json
visual-review/review.md
```

Generate a matched packet from preserved exact-commit evidence:

```bash
corepack pnpm visual:review \
  --candidate /path/to/candidate-evidence \
  --candidate-ref <candidate-sha> \
  --baseline /path/to/baseline-evidence \
  --baseline-ref <baseline-sha> \
  --require-baseline \
  --output /path/to/review-packet
```

Complete `assessment-template.json`, then recompute the verdict:

```bash
corepack pnpm visual:review \
  --candidate /path/to/candidate-evidence \
  --candidate-ref <candidate-sha> \
  --baseline /path/to/baseline-evidence \
  --baseline-ref <baseline-sha> \
  --require-baseline \
  --assessment /path/to/completed-assessment.json \
  --output /path/to/review-packet
```

## Verdicts

- `AUTOMATED_REJECT`: at least one objective evidence gate failed.
- `HUMAN_REVIEW_REQUIRED`: automatic evidence passed but art-direction review
  is incomplete.
- `CHANGES_REQUIRED`: human review found a weak dimension or unresolved shot.
- `VERIFIED_CANDIDATE`: automatic and human gates passed. This is not yet a
  production verification.

`VERIFIED_CANDIDATE` becomes a verified visual release only after exact-SHA CI,
deployment, production health, live fresh/saved/autoplay evidence, exact
production screenshots, and the required comparison presentation pass.

## Finding Discipline

A finding must contain:

- identifier and severity;
- exact shot, viewport, state, and visible symptom;
- likely root cause and owning files;
- protected behavior that must remain intact;
- measurable acceptance criteria;
- required browser or screenshot evidence;
- validation cost and deployment risk; and
- `open`, `resolved`, or `superseded` status.

Prefer one systemic correction over several local patches. Examples include
fixing shared cue hierarchy, material tokens, prop legitimacy rules, camera
framing, or landmark rendering rather than hiding one screenshot artifact.
