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
| `VQ-01` | Core exterior landmarks: Morrow House, Kettle & Lamp, Quay Square | `VERIFIED` | Desktop, tablet, phone, and high-DPR screenshots show distinct silhouettes, materials, entrances, and props before labels. |
| `VQ-02` | Secondary exterior landmarks: Mercer Repairs, Morrow Yard, Pilgrim Slip | `VERIFIED` | Idle, route-mid, and arrival screenshots show authored identity and endpoint alignment equal to the core landmarks. |
| `VQ-03` | Morrow House interior | `VERIFIED` | Desktop and phone screenshots show a readable boarding-house composition, secondary title treatment, clearly framed Rowan and relevant Mara, and unobscured portal/action areas. |
| `VQ-04` | Kettle & Lamp and Mercer Repairs interiors | `VERIFIED` | Desktop and phone screenshots show materially distinct tea-house and workshop identities before labels; focused checks fail if their authored signatures disappear. |
| `VQ-05` | North/west/east fringes and open lots | `VERIFIED` | All-direction pan screenshots show intentional edge composition, grounded materials, and no pale void slabs, empty green rectangles, black voids, or abrupt unfinished boundaries. |
| `VQ-06` | Waterfront and quay edge | `VERIFIED` | Desktop, compact, phone, and route screenshots show a coherent waterline, dock activity, edge traversal, and no stale or disconnected props. |
| `VQ-07` | Responsive composition and map primacy | `VERIFIED` | `390x844`, tablet, compact/tall Codex, and DPR 2 screenshots pass collapsed/expanded context and every pan direction without overlap or clipping. |
| `VQ-08` | Labels, cues, and scene-to-rail balance | `VERIFIED` | Idle, conversation, route, action, and consequence screenshots show crisp high-DPR canvas labels as secondary, no stacked identity/cue treatment, and no repeated rail copy compensating for weak scene communication. |
| `VQ-09` | Route and transition continuity | `VERIFIED` | Start/mid/arrival and interior/exterior evidence shows continuous navigation, explicit transitions, attached labels, and visually correct endpoints. |
| `VQ-10` | Visually assertive regression coverage | `VERIFIED` | Deliberately degraded fixtures or region assertions prove the suite fails on landmark loss, interior identity loss, major composition drift, overlap, cue noise, and route-label detachment. |
| `VQ-11` | Opening identity and simulation premise | `VERIFIED` | Desktop and phone opening evidence identifies Many Lives, explains the living-world agent loop without a click gate, preserves saved-run choices, and carries a restrained product signal into live play. |
| `VQ-12` | Exterior material depth, lighting, and palette cohesion | `VERIFIED` | Matched desktop, phone, compact-route, and high-DPR evidence separates roads, paving, facades, vegetation, and working-yard materials without flattening landmark identity or map primacy. |

`CANDIDATE` rows must be rechecked against the next intended release commit.
They are not grandfathered into `VERIFIED`.

### Current Review Finding

- `VF-19` (`MEDIUM`, `CANDIDATE`): exact-production Chrome review on
  `a9fc717591a01b00b51eda91ea56b7afcd14cc49` reached Mara with an accepted
  live dialogue response, but the visible planning artifact called the
  simulator-selected follow-up a `Live recommendation` and attributed the
  provider/model without the action-planner confidence required for that
  provenance. The dialogue provider had interpreted the exchange; the
  simulator, not the provider, selected and validated the conversation action.
  The candidate preserves the accepted live provider attempt while classifying
  the selected action as a non-advisory deterministic planner recommendation
  backed by `conversation-resolution`. A focused recurrence test, the complete
  13-stage harness, both three-to-five-minute zero-click trajectories, the
  inhabit browser regression, production build, and 22-state visual contract
  pass. Baseline failure evidence is at
  `/private/tmp/manylives-a9fc717-heartbeat-20260815-rowan`; candidate harness
  evidence is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786804235475`.
  Candidate commit `e7f78b73a513f9c62fcab19780c08ce2d6b94b78`
  passed exact-SHA CI/deploy, live health, fresh/resume/new/autoplay smoke, and
  a real accepted OpenAI planner trace. The production Chrome regression
  cleared the original Mara provenance assertion before exposing `VF-20` in
  the next state, so final production verification remains required.

- `VF-20` (`MEDIUM`, `CANDIDATE`): the exact-production Chrome validation of
  `e7f78b73a513f9c62fcab19780c08ce2d6b94b78` correctly observed a
  low-confidence OpenAI action-planner attempt fall back to a complete,
  simulator-validated deterministic recommendation at `exit-morrow-house`,
  but the browser audit rejected it because its allowed source-kind set omitted
  `deterministic-fallback`. Production API replay confirmed eight consecutive
  complete provenance states, including the rejected provider attempt and
  explicit fallback source, so this was a release-gate blind spot rather than
  missing product state. The candidate admits the already-supported fallback
  provenance and adds a source-contract regression that fails if the audit
  drops it again. Failure evidence is at
  `/private/tmp/manylives-e7f78b7-live-rowan`; live smoke is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786824861955`.
  Candidate commit `c2e0629786b0bdc6a4702eaff1effc7804fd5cf0` passed
  exact-SHA CI/deploy in GitHub Actions run `31907937843` attempt 2 after the
  first attempt was cancelled for an unchanged runner package-install stall.
  Production health, fresh/resume/new/autoplay smoke, and a real accepted
  OpenAI planner trace passed. The full production Chrome rerun cleared the
  original provenance-source assertion before exposing `VF-21`, so final
  production verification remains required.

- `VF-21` (`HIGH`, `CANDIDATE`): the exact-production Chrome review on
  deployed commit `c2e0629786b0bdc6a4702eaff1effc7804fd5cf0` reached a legal
  urgent pump tool-lead at Morrow House, then reopened the same Mara
  conversation at least eight times at the unchanged game time `13:55`. Live
  OpenAI replies and accepted conversation interpretations kept endorsing the
  pump without revealing the actionable wrench source; no Jo, Mercer Repairs,
  or wrench-source memory was written, so the deterministic planner legally
  reselected `tool:item-wrench:problem-pump:lead:npc-mara`. The zero-click run
  had no visible progression controls, reply affordances, generic carry-forward
  copy, or incomplete provenance samples, but failed its natural first-afternoon
  stop after 600 seconds with only 2/4 outcomes met. Preserve simulator
  legality, provider-attempt provenance, the broad first-afternoon objective,
  and ordinary conversation behavior. Acceptance requires a production-state
  recurrence proving that one selected tool-lead conversation either exposes
  the grounded tool source or consumes that lead, followed by a zero-click
  browser run that advances to a materially viable legal action and reaches
  the natural first-afternoon stop. Failure evidence is at
  `/private/tmp/manylives-c2e0629-live-rowan`; exact live game-state evidence is
  retained under game `game-fb0273c0-a91c-42e2-9f30-5f4407bce4cf`. The
  candidate captures the selected tool-lead before conversation provenance
  replaces it and only accepts live source guidance that will persist in
  player memory or an actionable tool-source objective. The full 13-stage
  harness passed 379 simulator tests, 135 repository tests with five intended
  skips, both zero-click browser trajectories, direct-play continuity, the
  production build, and the 22-state visual contract. The ordinary-lead run
  reached a natural 4/4 stop at `15:24` in 230.8 seconds with zero progression
  clicks. Candidate evidence is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786851420633`.
  Candidate commit `79396f85c6a0937b515a6ccd27b6df9a49aacb91` passed the
  exact-SHA build job. Its CI gameplay trajectory also reached a natural 4/4
  stop in 250.1 seconds with zero progression clicks, repeated-person cycles,
  generic carry-forward copy, or incomplete provenance before the independent
  rendered-route evidence selector exposed `VF-22`. Exact-SHA CI/deploy and
  the same production Chrome trajectory therefore remain required.

- `VF-22` (`MEDIUM`, `CANDIDATE`): the exact-SHA gameplay job for
  `79396f85c6a0937b515a6ccd27b6df9a49aacb91` recorded six legal opening-route
  probes from progress `0.007` through `0.549` plus two different archived
  screencast frames 1.34 seconds apart, but collapsed the paired proactive
  capture window to its confirmation frame and timed out waiting for two
  rendered positions. The product trajectory itself passed: the ordinary-lead
  run reached 4/4 and continued to a `16:26` Morrow Yard objective with zero
  visible progression clicks, repeated-person cycles, generic carry-forward
  copy, or incomplete provenance. The candidate promotes the candidate and
  confirmation frames independently only when both belong to one exact legal
  opening route and HUD identity, retain bounded probe timing and distinct
  sequences, and pass full-frame and distinct-pixel validation. Regression
  coverage recreates the exact sparse six-probe/two-frame cadence and rejects
  stale frames, reused sequences, and identical pixels; no timeout or product
  threshold changed. Failure evidence is at
  `/private/tmp/manylives-79396f8-ci-gameplay-failure`; GitHub Actions run is
  `31925622582`. The focused pacing file passes 66 tests with five intentional
  skips. The full 13-stage local harness also passes 379 simulator tests, 136
  repository tests with five intentional skips, both zero-click autoplay
  trajectories, direct inhabit play, the production build, and the 22-state
  visual contract. Local candidate evidence is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786854604383`.
  Exact-SHA CI/deploy and exact-production route evidence remain required.

- `VF-23` (`MEDIUM`, `CANDIDATE`): exact-SHA gameplay validation of
  `fd8461ce2e412c767a1c748d52aaae35e8583b95` cleared the original `VF-22`
  opening-route gate and completed the ordinary-lead trajectory, then exhausted
  four consequential-foothold capture attempts on the noticed-pump path. A
  slow 2.77-second screencast candidate/confirmation pair crossed the exterior
  arrival to Morrow House and interior entry state boundary, so the full-frame
  audit correctly rejected it as not bracketed by one coherent current state.
  The product state had already solved the pump, returned to Morrow House at
  3/4 outcomes with zero progression clicks, and selected the legal Take stock
  follow-up. Preserve fail-closed state/HUD/pixel validation, existing pacing
  and timeout bounds, and both first-afternoon trajectories. Acceptance
  requires an exact recurrence that obtains a truthful milestone frame across
  the observed slow transition without accepting mismatched state, stale
  frames, reused pixels, or lower evidence thresholds, followed by the full
  local harness, exact-SHA CI/deploy, and exact-production Chrome trajectory.
  Failure evidence is at
  `/private/tmp/manylives-fd8461c-ci-gameplay-failure`; GitHub Actions run is
  `31927704565`. The candidate now brackets and validates each screencast frame
  independently, retains only exact-state frames, and pairs distinct settled
  pixels from one coherent state. The recurrence covers the observed 14:11
  street/entry to 14:13 interior/Take stock transition and rejects persistent
  crossings, stale or reused sequences, and identical pixels. The focused
  pacing file passes 66 tests with five intentional skips. The full 13-stage
  local harness passed 379 simulator tests, 136 repository tests with five
  intentional skips, both zero-click trajectories, direct inhabit play, the
  production build, and the 22-state visual contract. The noticed-pump path
  crossed the exact transition with one bounded retry, captured a truthful
  consequential foothold, and completed naturally. Candidate evidence is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786857362574`.
  Candidate `5d3bdfc800bb89a26c092ff0c189bc420065ff44` passed the
  exact-SHA build and 30m39s gameplay jobs in GitHub Actions run
  `31929489181`, clearing the `VF-21`, `VF-22`, and `VF-23` product and
  rendered-evidence trajectories before the independent visual job exposed
  `VF-24`. Exact-SHA visual/deploy and exact-production Chrome evidence remain
  required.
  Implementation owner Bernoulli completed the bounded scope.

- `VF-24` (`MEDIUM`, `CANDIDATE`): the exact-SHA visual job for
  `5d3bdfc800bb89a26c092ff0c189bc420065ff44` captured a complete fresh
  autoplay frame after the live simulation legitimately advanced from 11:02,
  72 energy, and 0/4 outcomes to 11:03, 71 energy, and 2/4 outcomes during one
  repaint retry. The retry diagnostic incorrectly required immutable HUD values
  and failed before the responsive matrix, although the captured HUD remained
  ordered, legible, unclipped, and state-backed. Preserve all three-attempt,
  pixel-integrity, stale-frame, camera-range, clipping, visibility, opacity,
  and malformed-HUD gates. Acceptance requires the exact changing-HUD
  recurrence to accept only the same ordered semantic roles while still
  rejecting missing, reordered, malformed, clipped, hidden, transparent,
  camera-dragging, out-of-range, corrupt, and stale cases. Failure evidence is
  at `/private/tmp/manylives-5d3bdfc-ci-visual-failure`; GitHub Actions run is
  `31929489181`. The candidate adds seven focused recurrence and rejection
  cases, and validates every retry against one freshly inspected HUD state.
  Syntax checks, the focused 7/7 suite, the combined 35/35 visual tests, and
  the full 13-stage local harness passed, including 379 simulator tests, 136
  repository tests with five intentional skips, both zero-click trajectories,
  46 gameplay screenshots, 23 watch beats, zero progression clicks, direct
  inhabit follow-through, the production build, and all 22 visual states.
  Exact full-gate evidence is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786859655611`.
  Exact-SHA CI/deploy and exact-production evidence remain required.
  Implementation owner Gibbs completed the bounded scope.

- `VF-25` (`HIGH`, `VERIFIED`): the final exact-production Chrome gate on deployed
  commit `1d10947e864d8114d27d55cc35f7e7117faa254f` completed the ordinary-lead
  first-afternoon trajectory naturally with 65 meaningful beats, zero
  progression clicks, first decision at 1.229 seconds, first interaction at
  37.222 seconds, and the 4/4 stopping point at 233.876 seconds, but exposed a
  15.911-second wall-clock / 17.099-second app-clock product-visible gap after
  auto-continue fired `Talk to Mara`. The client truthfully remained on
  `Following Rowan: Talk to Mara...` while the command awaited live
  conversation support. Exact production state timestamps show the autonomous
  opener did not complete until approximately 15.8 seconds after the action
  fired, followed by reply and interpretation calls before the conversation
  appeared. Root cause is architectural: planner requests have a six-second
  total budget, while serial street opener, reply, and interpretation requests
  can each inherit the 25-second request timeout, so one validated command has
  no shared bound compatible with the protected 15-second visible-progress
  contract. Preserve live planner provenance, validated legal selection,
  grounded conversation policy, deterministic fallback quality, complete
  zero-click trajectories, and the 15-second product gate. Acceptance requires
  a command-scoped latency budget shared across every provider task triggered
  by one `advance_objective`, exact fake-timer coverage proving serial slow
  tasks fall back within margin while recording truthful task provenance, the
  full local harness, exact-SHA CI/deploy, and the same production Chrome
  trajectory with no product-visible gap above 15 seconds. Failure evidence is
  at `/private/tmp/manylives-1d10947-live-rowan`; the exact game state is
  retained as `game-8aaeb5b9-5a92-4af1-addb-a8f744cb24a8`. The candidate now
  assigns one absolute 12-second budget to each `advance_objective` command and
  propagates it through planner, opener, reply, interpretation, and thought
  refresh calls while retaining the planner's stricter six-second cap. The
  provider races fetch, status validation, body consumption, and output
  extraction against the remaining shared time, aborts on expiry, records
  truthful budget fallback provenance, and prevents late responses from
  changing runtime state or cached dialogue. Focused provider/engine coverage
  passes 139 tests, including serial slow calls and an immediate-header/stalled-
  body recurrence. The full 13-stage local harness passes 382 simulator tests,
  136 repository tests with five intentional skips, both zero-click browser
  trajectories, direct inhabit play, the production build, and all 22 visual
  states. The ordinary-lead path reached its first interaction in 18.524
  seconds with a maximum 10.854-second app-visible gap; the noticed-pump path
  reached its first interaction in 18.856 seconds with a maximum 9.915-second
  gap. Both stopped naturally with no visible progression controls. Candidate
  evidence is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786866194514`.
  Candidate `a269c3da8eaeea38362ad662c261344b4d1bfe53` passed build,
  visual, gameplay, and deploy jobs in GitHub Actions run `31935594919`.
  Exact-production ordinary and noticed trajectories at
  `/private/tmp/manylives-a269c3d-live-rowan` stopped naturally with zero
  progression controls and maximum app-visible gaps of 10.801 and 10.147
  seconds. The documented live harness at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786869648968`
  passed all 14 stages, including a real accepted OpenAI planner trace,
  fresh/resume/new identity smoke, the production build, 46 gameplay
  screenshots, and all 22 visual states. Production health tied the deployed
  app to `a269c3d`. Implementation owner Franklin completed the bounded scope.

- `VF-26` (`HIGH`, `CANDIDATE`): post-release exact-production regression
  hardening on `a269c3da8eaeea38362ad662c261344b4d1bfe53` exposed that the
  browser timeline attaches tea-house labels and event assertions such as
  `hold-for-shift` and `lunch-rush` to generic `advance_objective` calls. In
  game `game-eec3202f-30b2-476a-817a-3d7de4cfaf65`, the validated planner
  legally selected Jo's wrench and the active pump path at `11:28`; the gate
  then failed because the tea lunch event was not active, despite the selected
  trajectory, route, objective state, and consequence being coherent. Exact
  failure evidence is at
  `/private/tmp/manylives-a269c3d-live-rowan-release-gate`. Preserve
  zero-click autonomy, simulator legality, provider provenance, authored route
  endpoint continuity, strict visual evidence, and state-derived planner
  choice. Acceptance requires the timeline to derive semantic checkpoints from
  actual state and validate every supported first-afternoon branch, including
  tea work and pump repair, with branch-specific route, interaction,
  consequence, event, and screenshot evidence. It must reject incoherent or
  incomplete branches without forcing one hardcoded route. Focused harness
  hardening currently passes 75 tests with five intentional skips. A fresh
  exact-production run followed the legal tea-work branch through a natural
  4/4 stop before the independent pacing contract exposed `VF-27`, so the
  trajectory-aware timeline has not yet reached its full production phase.
  The complete local candidate gate at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786900821861`
  passed all 13 stages: ordinary-lead and noticed-pump trajectories, 46
  gameplay screenshots, 23 autonomous watch beats, zero progression clicks,
  route continuity, post-objective follow-through, independent NPC change,
  production build, and 22/22 required visual states. Direct inspection found
  no visual regression. Exact-SHA CI/deploy and the same exact-production
  branch-aware gate remain required.

- `VF-27` (`HIGH`, `CANDIDATE`): the fresh exact-production ordinary-lead run
  on `a269c3da8eaeea38362ad662c261344b4d1bfe53` reached a natural tea-work
  4/4 stop with zero progression clicks, but opening Mara's first conversation
  produced a 17.591-second product-visible gap against the protected 15-second
  limit. The server may legally use a shared 12-second AI budget for one
  `advance_objective` command while the web client aborts every street command
  after 8 seconds. On the observed slow live call, that mismatch forced stale
  state recovery and another autoplay dwell before retry. Preserve the shared
  server budget, strict visible-gap gate, zero-click behavior, live provenance,
  deterministic fallback, and the shorter timeout for ordinary commands.
  Acceptance requires the dedicated autonomy-request timeout to outlive the
  server budget while remaining below the visible-gap deadline, focused
  cross-layer contract coverage, the full local test/build/visual gates, and
  fresh exact-production ordinary and noticed trajectories with no visible gap
  over 15 seconds. Failure evidence is at
  `/private/tmp/manylives-a269c3d-vf26-candidate-3`; exact game state is retained
  as `game-670985c9-3f48-4e3e-a9d1-39905c77d3d6`. The candidate gives only
  `advance_objective` a 14-second client deadline; all other commands retain
  the existing 8-second limit. Focused coverage passes 75 tests with five
  intentional skips, and the complete local candidate gate passed at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786900821861`.
  Exact-SHA CI/deploy and fresh exact-production ordinary and noticed pacing
  ledgers remain required.

- `VF-28` (`MEDIUM`, `CANDIDATE`): the first complete local candidate gate at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786899678508`
  reached the completed first-afternoon state but found that the persisted
  simulator-owned lead field note still told Rowan to choose whether to take
  the cup-and-counter shift after that shift had already paid. The renderer
  correctly preserves simulator authority, so overriding this stale copy in
  the client would hide the state defect and violate the reasoning-ownership
  contract. Preserve simulator-owned field-note authority, the paid and
  completed consequence state, renderer precedence, and post-objective
  momentum. Acceptance requires the simulator to advance the persisted note's
  next step when the shift pays and when the first afternoon completes, an
  integration assertion at the completed state, the full local gate, and an
  exact-production completed-state screenshot with no stale shift choice. The
  server-owned candidate passes 196 focused authority/engine tests and the
  complete 13-stage local gate at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786900821861`.
  Exact-SHA CI/deploy and exact-production completed-state evidence remain
  required.

- `VF-16` (`MEDIUM`, `VERIFIED`): exact-production review on
  `1dce8c9a8bd55d7f7773dd23ab633876dcfc0c08` found that Kettle & Lamp
  and Mercer Repairs concentrated their identity at labels and perimeter props
  while broad uniform center floors dominated desktop and phone framing. The
  candidate adds a shared, restrained material-depth pass with warm slatted and
  woven hospitality zones plus segmented workshop plates and a bounded tread
  threshold. Exact candidate pixel checks report Kettle material coverage of
  0.875 desktop / 0.860 phone and Mercer coverage of 0.644 / 0.646, with
  internal transitions inside the authored noise bounds. The full 13-stage
  harness and 22-shot matched review passed with verdict
  `VERIFIED_CANDIDATE`. Baseline evidence is at
  `/private/tmp/manylives-1dce8c9-vf16-baseline`; candidate evidence is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786783535368/visual-game`;
  matched review is at `/private/tmp/manylives-vf16-reviewed`. Exact deployed
  commit `c5d04afe4a8939c2412bda4af74008ad47fd40ce` passed production health,
  live fresh/saved/new/autoplay smoke, accepted OpenAI planner evidence, the
  deployed visual smoke, and a 22/22 matched review. Deployed captures are at
  `/private/tmp/manylives-c5d04af-live-visual-retry`; the matched production
  packet and shown four-pair interior comparison are at
  `/private/tmp/manylives-c5d04af-live-review`. GitHub Actions run:
  `31878741279`.

- `VF-17` (`LOW`, `VERIFIED`): the same exact-production packet found
  `desktop.png` and `secondary-landmarks-desktop.png` byte-identical, so
  the 23-shot contract overstated independent visual coverage. The duplicate
  row is removed from the candidate contract; distinct Morrow Yard compact
  evidence now carries the secondary-landmark comparison while every VQ row
  remains covered. The final contract passes at 22/22 distinct required shots
  on deployed commit `c5d04afe4a8939c2412bda4af74008ad47fd40ce`.

- `VF-18` (`MEDIUM`, `VERIFIED`): exact-SHA GitHub Actions run
  `31876309438` completed the Rowan Chrome regression with 46 gameplay
  screenshots, 23 zero-click watch beats, route continuity, and durable world
  change, then blocked deployment because one valid `819x375` Morrow House PNG
  compressed to 92,186 bytes below a generic 120 KB artifact threshold.
  Direct inspection found a complete, coherent frame with entropy 5.779. The
  candidate replaces compressed byte size as the gameplay screenshot proxy
  with decoded PNG format, minimum dimensions, and entropy checks, plus
  fixtures proving that a detailed sub-100 KB frame passes while a same-size
  blank frame fails. The full 13-stage harness passes with 46 screenshots
  structurally validated and zero visible progression clicks at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786787056286`.
  Follow-up exact-SHA run `31878741279` passed build, gameplay, visual, and
  deploy with the structural artifact validator active.

- `VF-15` (`MEDIUM`, `VERIFIED`): exact-production review on
  `44adfdfa970d1310cf355b0ae01e66ec9ab87d81` found landmark, interior,
  Rowan, and NPC canvas labels visibly softer and more pixelated than the DOM
  HUD at high DPR. The clearest evidence is
  `/private/tmp/manylives-44adfdf-review-20260814-1412/interior-camera.png` and
  `/private/tmp/manylives-44adfdf-review-20260814-1412/codex-retina-tall-rail-expanded.png`.
  Rawls (`01a000a6-b5b5-7360-8d1b-fe5004799f35`) completed the shared Phaser
  label-resolution path and its regression coverage. Exact deployed commit
  `2a4d92d65c543143f82a9063bfe34eecbf546dc1` passed all ten visual
  profiles, all 23 human-review shots, and runtime density checks before and
  after high-DPR zoom without changing label bounds. Matched exterior and
  interior evidence shows cleaner text edges with no regression to label
  attachment, cue restraint, actor scale, map primacy, camera traversal, or
  fresh/saved/autoplay behavior.

### Verified Production Evidence

- `VQ-08` and `VF-15` were verified on production commit
  `2a4d92d65c543143f82a9063bfe34eecbf546dc1` against exact production
  baseline `44adfdfa970d1310cf355b0ae01e66ec9ab87d81`. Phaser label
  textures now track runtime render scale and high-DPR zoom while their source
  resolution preserves authored world-space bounds. All ten visual profiles,
  all 23 human-reviewed shots, full tests and production build, exact-SHA CI,
  deploy, production health, saved/resumed/new/fresh autoplay smoke, and a
  successful live OpenAI planner trace passed. The first CI attempt exposed one
  transient screencast frame-coherence race after successful gameplay progress;
  the exact-SHA gameplay rerun passed without weakening the gate. Baseline
  captures are at `/private/tmp/manylives-44adfdf-review-20260814-1412`;
  deployed captures are at
  `/private/tmp/manylives-2a4d92d-live-visual-20260814`; the matched review is
  at `/private/tmp/manylives-2a4d92d-live-review-verified-20260814`; shown
  comparisons are at `/private/tmp/manylives-2a4d92d-comparisons-20260814`;
  live smoke is at
  `/private/tmp/manylives-2a4d92d-live-harness-20260814/live-smoke`. GitHub
  Actions run: `31813376233`, attempt 2.

- `VQ-07` and `VQ-08` were verified on production commit
  `766ca38395600af8966acaaa7fd9c2c5e36040c2` against exact production
  baseline `c72f830bdfec06eb83346c811524930627a82570`. The collapsed compact/tall
  rail had truncated the product premise, district/status context, and current
  thought with ellipses at 662-669 CSS pixels and DPR 2. The deployed bounded
  status surface now presents complete state-backed copy while preserving map
  primacy. All 23 required shots, 10 viewport profiles, rendered overflow,
  line-clamp, DPR, HUD/dock/release intersection, all-direction pan, and
  deliberately failing fixture checks passed. The exact production human
  assessment scored 4.1/5 and returned `VERIFIED_CANDIDATE`; exact-SHA CI,
  deploy, production health, live fresh/saved/new/autoplay smoke, and live
  OpenAI planner evidence also passed. Baseline evidence is at
  `/private/tmp/manylives-c72f830-live-baseline`; deployed captures are at
  `/private/tmp/manylives-766ca38-live`; the matched review is at
  `/private/tmp/manylives-766ca38-live-review`; shown comparisons are at
  `/private/tmp/manylives-766ca38-comparisons`; live smoke is at
  `/var/folders/2r/y7bj__m15td08zdhtcz2j4t00000gn/T/manylives-app-harness-1786687068924/live-smoke`.
  GitHub Actions run: `31772672993`.

- `VQ-12` was verified on production commit
  `8c480a494cf4e2d71c273c916953f736d08578d7` against baseline
  `78a1c52c9f3f5d69c37c34b6577beeddab310989`. Matched desktop, phone, and
  compact-route comparisons show darker road structure, warmer stone and
  facades, stronger landmark contact depth, richer vegetation and working-yard
  materials, and less global wash while preserving the map-first HUD and route
  framing. Exact-SHA CI/deploy, the deployed visual smoke across desktop,
  tablet, phone, compact/tall Codex, and high-DPR profiles, saved/resumed/new
  behavior, production health, and a successful live OpenAI planner trace all
  passed. Comparisons were shown from
  `/private/tmp/manylives-vq12-8c480a4-comparisons`; deployed captures were
  inspected at `/private/tmp/manylives-8c480a4-live-visual`, and live smoke is
  at `/private/tmp/manylives-8c480a4-live-smoke`. GitHub Actions run:
  `31655510292`.
- `VQ-01` was verified on production commit
  `46fa94fb396bc9b5850212bd90f8c5b266e51bf0`. Exact-production desktop,
  tablet, phone, and high-DPR captures show Morrow House's two-storey boarding
  facade and stoop, Quay Square's fountain and planted civic geometry, and
  Kettle & Lamp's striped cafe frontage and occupied terrace as distinct
  landmarks before their labels are needed. The inspected capture set is
  `/private/tmp/manylives-46fa94f-vq07-live-visual-retry`.
- `VQ-07` was verified on production commit
  `46fa94fb396bc9b5850212bd90f8c5b266e51bf0`. The deployed visual smoke passed
  `390x844`, phone-boundary, tablet portrait, compact/tall Codex, reported and
  high-DPR Codex profiles with collapsed and expanded context plus north,
  south, east, and west panning. Inspection confirmed that the HUD, bottom
  dock, rail, actors, and landmark labels remain separated while the map stays
  primary. A clean saved-run prompt, Continue, and Start New pass protected
  session continuity. Evidence was inspected at
  `/private/tmp/manylives-46fa94f-vq07-live-visual-retry`; live fresh,
  saved/resumed, distinct-new, autoplay, console, and accepted OpenAI planner
  smoke passed at `/private/tmp/manylives-46fa94f-live-smoke-retry`. GitHub
  Actions run: `30808042072`.
- `VQ-09` was verified on production commit
  `7bc50be1491105299e1bf714457adcb9f0a07c8a`. The focused hosted Chrome
  regression completed ordinary-lead and noticed-pump trajectories with zero
  progression clicks, legal route-start and route-mid captures to Kettle &
  Lamp and Mercer Repairs, explicit exterior/interior continuity, distinct
  durable consequences, and natural first-afternoon stopping points. The
  deployed visual smoke also passed secondary-route identity, responsive,
  saved-run, panning, and interior checks. Route sequences were inspected at
  `/private/tmp/manylives-7bc50be-vq09-focused-live`; the full deployed visual
  set was inspected at `/private/tmp/manylives-7bc50be-v1-live-visual`, and
  production fresh/saved/autoplay smoke passed at
  `/private/tmp/manylives-7bc50be-live-smoke`. GitHub Actions run:
  `30787105857`.
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

Every new visual evidence directory must also contain the generated
`visual-review/review-deck.png`, `visual-review/scorecard.json`,
`visual-review/assessment-template.json`, and `visual-review/review.md` packet
defined by [visual-review-method.md](/Users/branavan/GitHub/many_lives/docs/street/visual-review-method.md).
The automatic gate must pass before screenshot existence counts as coverage.
An affected row remains `CANDIDATE` while the packet says
`HUMAN_REVIEW_REQUIRED` or `CHANGES_REQUIRED`.

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
   The standard generator writes `visual-review/comparison-deck.png` for the
   four representative contract shots when a baseline is supplied.
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
