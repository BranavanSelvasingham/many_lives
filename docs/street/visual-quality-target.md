# South Quay Visual Quality Target

This document is the finite visual convergence contract for the Many Lives
street app. The runtime operating manual remains authoritative for product and
release behavior. The orchestration compass remains authoritative for
prioritization. This ledger answers a narrower question: what visual evidence
must exist before South Quay can be called a coherent target-quality city?

Do not treat the rows below as permanent issue identifiers. Reviews may add,
split, merge, or retire rows when current product evidence warrants it. Do not
mark a row complete because code changed, a worker finished, or screenshot
files exist.

## Status

- `OPEN`: current evidence shows a material gap.
- `IN_PROGRESS`: one owner has an isolated implementation scope.
- `CANDIDATE`: implementation and focused validation passed, but the intended
  commit has not completed release and production evidence.
- `VERIFIED`: the same deployed commit passed the required visual evidence and
  affected protected behavior.
- `REGRESSED`: a previously verified surface fails current evidence.
- `BLOCKED`: verification cannot proceed because of an explicit product,
  tooling, permission, or external-service blocker.

## Target-State Definition

South Quay reaches the visual target state only when all active rows are
`VERIFIED` on the same deployed commit and:

1. No high- or medium-severity visual finding remains open.
2. Every named landmark and interior is identifiable before reading its label.
3. Exterior composition remains coherent at every pan limit without pale void
   slabs, stale event art, synthetic tiling, or unexplained empty regions.
4. Route starts, mids, arrivals, portals, actors, labels, and destination art
   tell one continuous spatial story.
5. Desktop, compact/tall Codex, tablet, phone, and high-DPR views preserve a
   map-first composition without HUD, rail, dock, label, or actor collisions.
6. Cue layers are restrained and state-backed; the scene dramatizes the active
   situation instead of delegating the experience to rail text.
7. A fresh three-to-five-minute production run remains zero-click, legible,
   paced, state-derived, and free of visible browser errors.

## Convergence Matrix

| ID | Surface | Current status | Target evidence |
| --- | --- | --- | --- |
| `VQ-01` | Core exterior landmarks: Morrow House, Kettle & Lamp, Quay Square | `CANDIDATE` | Desktop, tablet, phone, and high-DPR screenshots show distinct silhouettes, materials, entrances, and props before labels. |
| `VQ-02` | Secondary exterior landmarks: Mercer Repairs, Morrow Yard, Pilgrim Slip | `VERIFIED` | Idle, route-mid, and arrival screenshots show authored identity and endpoint alignment equal to the core landmarks. |
| `VQ-03` | Morrow House interior | `VERIFIED` | Desktop and phone screenshots show a readable boarding-house composition, secondary title treatment, clearly framed Rowan and relevant Mara, and unobscured portal/action areas. |
| `VQ-04` | Kettle & Lamp and Mercer Repairs interiors | `VERIFIED` | Desktop and phone screenshots show materially distinct tea-house and workshop identities before labels; focused checks fail if their authored signatures disappear. |
| `VQ-05` | North/west/east fringes and open lots | `VERIFIED` | All-direction pan screenshots show intentional edge composition, grounded materials, and no pale void slabs, empty green rectangles, black voids, or abrupt unfinished boundaries. |
| `VQ-06` | Waterfront and quay edge | `VERIFIED` | Desktop, compact, phone, and route screenshots show a coherent waterline, dock activity, edge traversal, and no stale or disconnected props. |
| `VQ-07` | Responsive composition and map primacy | `CANDIDATE` | `390x844`, tablet, compact/tall Codex, and DPR 2 screenshots pass collapsed/expanded context and every pan direction without overlap or clipping. |
| `VQ-08` | Labels, cues, and scene-to-rail balance | `VERIFIED` | Idle, conversation, route, action, and consequence screenshots show labels as secondary, no stacked identity/cue treatment, and no repeated rail copy compensating for weak scene communication. |
| `VQ-09` | Route and transition continuity | `CANDIDATE` | Start/mid/arrival and interior/exterior evidence shows continuous navigation, explicit transitions, attached labels, and visually correct endpoints. |
| `VQ-10` | Visually assertive regression coverage | `VERIFIED` | Deliberately degraded fixtures or region assertions prove the suite fails on landmark loss, interior identity loss, major composition drift, overlap, cue noise, and route-label detachment. |
| `VQ-11` | Opening identity and simulation premise | `VERIFIED` | Desktop and phone opening evidence identifies Many Lives, explains the living-world agent loop without a click gate, preserves saved-run choices, and carries a restrained product signal into live play. |

`CANDIDATE` rows must be rechecked against the next intended release commit.
They are not grandfathered into `VERIFIED`.

### Verified Production Evidence

- `VQ-08` was verified on production commit
  `c478726cf8f46ffd06eaf467f14ceade68df84b4` against baseline
  `de0b9fa33805fa1b356cc16ea0394e72bc908d9f`. The deployed visual smoke
  passed ten desktop, tablet, phone, compact/tall Codex, and high-DPR viewport
  profiles plus landmark-loss, overlay-intersection, cue-noise, and
  route-label-detachment assertions. Matched desktop, mobile, and compact
  comparisons show the map retaining visual priority while the oversized
  observation framing and persistent Rowan marker recede, the living-world
  identity becomes explicit, and the current objective remains legible without
  stacked cue treatment. Exact-SHA CI/deploy, production health, saved/fresh
  autoplay smoke, and a real accepted OpenAI planner trace passed. Comparisons
  were shown from `/tmp/manylives-c478726-vq08-comparisons`; deployed captures
  were inspected at `/tmp/manylives-c478726-live-visual`. GitHub Actions run:
  `30758595050`.
- `VQ-03` was verified on production commit
  `5cc9108ccfe88a028cb80e0a0c3c4424bc9fb6c6` against baseline
  `da5d68ff6269fb7bf70ab3674c320b784530c8aa`. Matched desktop and phone
  comparisons show a woven reception zone, guest cubbies and key storage, a
  clear entry runner, and a distinct guest-room corridor while Rowan, Mara,
  the exit, title, and live rail remain unobscured. Exact-SHA CI/deploy, the
  production visual smoke, saved-run prompts, and a three-minute zero-click
  watch run passed; the run produced durable leaking-pump memory and continued
  into a state-derived Kettle & Lamp objective on Day 2. Comparisons were shown
  from `/tmp/manylives-5cc9108-live-comparisons`; deployed captures were
  inspected at `/tmp/manylives-5cc9108-live-review`. GitHub Actions run:
  `30746811458`.
- `VQ-05` was verified on production commit
  `fb5671b94b4058ffdd01e74f43a37b82277d0d88` against baseline
  `dd03d2ced869496144e07ff88d74de25aeb355f4`. The release added the north
  service threshold, varied facade rhythm, and grounded west working approach;
  broader high-DPR checks fail the prior washed slabs and pass the release.
  Exact-SHA CI/deploy, the 14-step live harness with a successful OpenAI planner
  trace, and the deployed visual smoke all passed. Matched north, west, and
  mobile comparisons were shown from `/tmp/manylives-fb5671b-comparisons`;
  deployed captures were inspected at `/tmp/manylives-fb5671b-live-visual`.
  GitHub Actions run: `30734488488`.
- `VQ-06` was verified on production commit
  `b9c82b3472fa9fc447fe5fc7dee9bc0695ebccd1` against baseline
  `b7dd868d64c6633b9c08152697a3d62b8681fa1d`. Exact-SHA CI/deploy, the live
  fresh/saved/autoplay smoke, and the production visual smoke passed. Matched
  phone and tall high-DPR east/south channel comparisons showed three distinct
  quay bays, varied timber and stone materials, ladders, mooring hardware,
  cargo props, and a buoy without regressing map primacy or overlay spacing.
  The comparison packet was shown from
  `/tmp/manylives-vq06-b9c82b3-comparisons`; the full deployed capture set was
  inspected at `/tmp/manylives-b9c82b3-live-visual`. GitHub Actions run:
  `30706967230`.
- `VQ-11` was verified on production commit
  `5a16faff2478f9a5398c161f85eb939a92ce4938` against baseline
  `afffdd36a4303adccab1ae10ed7b8b3feb331ef5`. Exact-SHA CI/deploy, the live
  fresh/saved/new/autoplay smoke, a real accepted OpenAI planner trace, and the
  deployed visual smoke passed. Matched desktop and phone comparisons showed
  the Many Lives identity, living-world agent premise, full-frame opening
  composition, preserved saved-run choices, and the restrained live rail mark.
  The comparison packet was shown from
  `/tmp/manylives-opening-5a16faf-comparisons`; deployed captures were inspected
  at `/tmp/manylives-opening-5a16faf-live-visual-retry`. GitHub Actions run:
  `30728148534`.

## Required Evidence Packet

For a visual release, preserve or link an evidence directory containing:

- `opening-desktop.png`
- `opening-phone.png`
- `core-landmarks-desktop.png`
- `secondary-landmarks-desktop.png`
- `morrow-house-interior-desktop.png`
- `morrow-house-interior-phone.png`
- `tea-house-interior-desktop.png`
- `tea-house-interior-phone.png`
- `repair-stall-interior-desktop.png`
- `repair-stall-interior-phone.png`
- `waterfront-desktop.png`
- `fringe-north.png`
- `fringe-west.png`
- `fringe-east.png`
- representative route-start, route-mid, and arrival screenshots
- expanded and collapsed context screenshots for phone, tablet, compact/tall
  Codex, and high-DPR states
- console/page-health output
- exact commit, validation commands, and live URL

Equivalent harness filenames are acceptable when the report maps them to these
surfaces explicitly.

## Major Production Push Presentation

A production push is visually major when it changes any convergence-matrix
row, landmark or interior rendering, scene composition, palette/material
language, cue/label treatment, camera framing, responsive layout, or visually
assertive regression coverage.

Every major visual production push must show the user what changed:

1. Capture the affected surface on the last verified production commit before
   implementation or preserve equivalent exact-baseline evidence.
2. After deployment, capture the same surface from the exact new production
   commit.
3. Match viewport, DPR, camera position, game state or deterministic seed,
   selected panel, and expanded/collapsed rail state closely enough for direct
   comparison.
4. Select two to four representative comparisons that demonstrate the main
   improvement and the most relevant responsive/protected-strength state.
5. Prefer labeled side-by-side `Before <short SHA>` / `After <short SHA>`
   comparisons. Separate matched images are acceptable when composition tools
   are unavailable.
6. Show the comparison images in the production notification using the
   available image or browser-artifact surface. Include exact artifact paths
   and a concise description of the visible delta.
7. If matched baseline evidence or image display is unavailable, report that
   visibility gap explicitly. Do not substitute unmatched screenshots or claim
   the visual delta is verified.

A major visual row remains `CANDIDATE` until the exact deployed result has been
inspected and its comparison set has been shown.

## Scheduled-Loop Contract

The scheduled orchestration loop must:

1. Read this ledger after the runtime operating manual and orchestration
   compass.
2. Carry every non-verified row and fresh evidence-backed finding forward
   across heartbeats.
3. Update status only from evidence on an exact worktree or deployed commit.
4. Select functional, pacing, agency, navigation, or release regressions ahead
   of visual work when they materially block the experience.
5. Otherwise select the highest-impact `OPEN` visual row with no viable owner.
6. Prefer one bounded implementation owner with explicit files and evidence
   gates.
7. Continue useful independent review while that owner works, then wait once
   for a likely short-lived worker rather than ending the scheduled turn
   immediately after delegation.
8. When the worker completes in the same turn, review the full diff, inspect
   screenshots, run required regressions, consolidate intended files, and
   continue through commit, push, exact-SHA CI/deploy, and live smoke.
9. Leave work uncommitted only when a named gate fails, a collision exists, or
   the remaining action requires unavailable approval, credentials, service
   recovery, or lawful tool access.
10. After a release is verified, reassess this matrix and start the next row
    only when the release lane is clear.
11. For every major visual production push, complete the presentation contract
    above before reporting the affected visual rows as `VERIFIED`.
