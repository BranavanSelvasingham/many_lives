# Many Lives Orchestration Compass

This document turns the July 2026 whole-game review into durable orchestration
gates. It complements the runtime operating manual; it does not replace any
validation, release, or state-source requirement there.

## Objective

Deliver a beautiful, coherent living-city experience whose first three to five
minutes are clear, zero-click, human-paced, visibly reasoned, spatially legible,
and genuinely state-derived. Rowan and NPCs should act from current legal world
state rather than following a fixed route, and every release claim must be
backed by browser, simulator, screenshot, and deployment evidence appropriate
to the change.

## Compass

Prioritize work in this order unless an active release gate makes a lower item
the immediate blocker:

1. Functional continuity: no impossible objectives, incoherent routes, stale
   sessions, required watch-mode clicks, or activity without progress.
2. First-five-minute quality: quick clarity, human pacing, visible consequence,
   and a natural stopping point between three and five real minutes.
3. Agency and reasoning: desired outcomes over trail following, real legal
   alternatives, simulator validation, and honest visible planner provenance.
4. Living-world depth: schedule-aware NPC availability, independent NPC action,
   world pressure, and choices that remain feasible as time changes.
5. Beauty and legibility: authored landmark identity, restrained cue layers,
   readable routes, coherent palette/materials, and consistent interiors,
   fringes, waterfront, desktop, and mobile composition.
6. Structural leverage: one visual source of truth, diagnostic release tooling,
   and regressions that test product quality rather than file existence.

## Protected Strengths

Every delta check must ensure a fix does not regress these existing strengths:

- `S1` Observe/autoplay progresses with zero progression, reply, wait, or action
  clicks.
- `S2` The simulator owns legality; planner output remains advisory until
  validated.
- `S3` Money, energy, trust, jobs, memories, field notes, objectives, and world
  pressure persist as consequences.
- `S4` Every meaningful Rowan action has a concise visible decision artifact.
- `S5` Kettle & Lamp, Morrow House, Quay Square, and the waterfront remain
  recognizable and visually authored.
- `S6` Camera drag/touch/edge traversal and watch-mode exploration remain usable.
- `S7` Mobile remains map-first even when context is expanded.

## Finding Ledger

A finding remains `OPEN` until its pass condition has direct current-commit
evidence. A code diff, unit test, or passing PNG-file check alone is not enough.

| ID | Finding | Required evidence | Pass condition |
| --- | --- | --- | --- |
| `F1` | Temporal feasibility and Jo-style no-progress loops | Fresh five-minute observe run, `/sim/game/*` state, NPC schedule tests, objective/action trace | Unavailable people or places are not selected as immediately actionable; Rowan waits for a reasoned opening or chooses another useful legal action; no unmet objective repeats through travel/recovery cycles without new evidence or progress. |
| `F2` | First-five-minute pacing is over-compressed, then loses momentum | Wall-clock first-run timeline with screenshots/state at load, decision, movement, interaction, consequence, and stopping point | First visible decision arrives within 12 seconds; no unexplained gap exceeds 15 seconds; movement and conversation remain observable; the opening reaches a natural first-afternoon stopping point in roughly three to five real minutes rather than under two; zero clicks required. |
| `F3` | Opening agency is effectively Mara -> Ada -> cafe shift -> home | Planner trace and deterministic scenario tests across multiple viable world states/seeds | Objectives express desired outcomes; the planner sees at least two materially viable legal approaches where state permits; multiple validated opening trajectories can occur; `advance_objective` is not merely consuming the next trail item. |
| `F4` | Rowan is visually over-marked | Desktop/interior/mobile screenshots at idle, route, conversation, and action beats | Rowan uses at most one persistent identity treatment plus one contextual action/target cue; no stacked halos, labels, route marks, or reticles obscure actors, entrances, props, or destinations. |
| `F5` | The rail explains more than the scene dramatizes | First-run screenshots and DOM/text inspection on desktop and phone | The current aim, selected action, next uncertainty, and short rationale are visible without repetition; deeper evidence is progressive disclosure; the map and people remain the primary read. |
| `F6` | Visual quality and landmark consistency are uneven | Screenshot review of every landmark, interior, north/west fringe, waterfront, and route endpoint; scene warnings | Mercer Repairs, Morrow Yard, Pilgrim Slip, interiors, and fringes meet the same authored quality as the strongest landmarks; labels are secondary to shape/props; no pale void slabs, stale props, tiling seams, or synthetic noise. |
| `F7` | Declared visual plan is disconnected from runtime | Import/generation path inspection, scene validation, focused tests | `SOUTH_QUAY_VISUAL_PLAN` or its successor generates or validates the active scene; semantic asset intents replace duplicated ID-specific renderer authority; scene warnings fail validation where required. |
| `F8` | Mobile rail/dock overlap and HUD clipping | `390x844`, tablet, compact/tall Codex, and DPR 2 screenshots before/after all pan directions and expanded rail | No overlay intersections; HUD contents persist after panning; camera safe regions account for top and bottom occlusion; district context remains discoverable. |
| `F9` | Visible planner provenance can be misleading | Decision-artifact tests plus live and deterministic browser traces | Live labels show accepted live recommendation rationale; deterministic labels say deterministic; conversation actions expose validated source/alternatives where meaningful; raw hidden chain-of-thought remains private. |
| `F10` | Provider timeout can violate the visible pacing budget | Induced timeout/retry browser test and provider call log | A stalled provider cannot freeze visible progress for roughly 50 seconds; a validated fallback or explicit short planning state preserves a meaningful beat within 15 seconds. |
| `F11` | Visual regression checks are broad but not visually assertive | Regression source plus deliberately failing fixtures or image-region/golden checks | Tests fail on HUD disappearance, rail/dock overlap, cue-stack noise, landmark/fringe loss, route-label detachment, and major palette/composition drift, not merely malformed or tiny PNGs. |
| `F12` | Release confidence is red | Exact-commit local harness, GitHub Actions, deploy job, `/sim/health`, and live browser smoke | Intended changes are committed; local required gates pass; exact commit is green and deployed; fresh/saved/autoplay live smoke is healthy; screenshots and console are clean. |

## Delta Check

At every heartbeat or consolidation decision:

1. Read `docs/street/runtime-operating-manual.md`, this compass, local
   `git status`, recent commits, active agents/threads, CI/deploy state, and the
   latest relevant browser/screenshot evidence.
2. Compare the current state with the last verified commit and classify every
   touched finding as `IMPROVED`, `UNCHANGED`, `REGRESSED`, `VERIFIED`, or
   `BLOCKED`.
3. Record the evidence source, exact commit/worktree state, validation command,
   and screenshot/browser artifact for any `IMPROVED` or `VERIFIED` claim.
4. Recheck all protected strengths affected by the delta. A change that fixes a
   finding while regressing a protected strength fails.
5. Never mark a finding `VERIFIED` from implementation completion alone. Run
   its required product-level evidence on the same intended commit.
6. Treat release-tool failures separately from product failures, but do not
   bypass either. Repair diagnostics when the gate cannot reveal the cause.
7. If no release work is active, select the highest-impact open finding with no
   viable owner. Do not repeatedly select cosmetic work while `F1`, `F2`, or
   `F3` remains unowned.

## Execution Loop

1. **Orient:** Establish worktree, owner, release, live, and finding-ledger
   state before making claims or delegating.
2. **Plan:** Choose one bounded outcome, list affected finding IDs and protected
   strengths, assign file ownership, and attach validation and screenshot gates.
3. **Act:** Delegate to the smallest viable owner; keep this orchestration thread
   focused on coordination, evidence, consolidation, and release.
4. **Verify:** Run the narrowest sufficient tests plus every finding-specific
   evidence gate. Inspect screenshots for visual work and watch the full pacing
   window for first-run/autoplay work.
5. **Repair:** Fix root cause, extend the regression so the observed failure
   would recur in the test, and rerun affected protected-strength checks.
6. **Consolidate:** Review all changed files, collisions, unrelated dirt, and
   evidence before staging only intended files.
7. **Release:** Commit, push, watch the exact SHA through CI/deploy, then run
   production health and live fresh/saved/autoplay smoke.
8. **Reassess:** Update finding deltas and select the next highest-impact open
   item only after the current release state is known.

## Reporting Contract

Heartbeat reports must include active owners, affected finding IDs, delta
classification, changed files, validation results, screenshot/browser evidence,
commit/CI/deploy/live state, protected-strength regressions, and residual risk.
Use `NOTIFY` whenever a finding changes classification, an owner is created or
steered, verification fails, a release state changes, or evidence is missing.

