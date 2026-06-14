# Many Lives /plan: Living-World Simulation

## Purpose

Use this as the project `/plan` for the current Many Lives street app.

The root problem is not that Rowan needs a prettier route or more authored beats. The root problem is authority: authored content must seed the world, but it must not drive Rowan like a fixed path. Rowan should be an embodied agent making state-grounded choices in a city that keeps changing without him.

The player-facing goal is watchable agency: a viewer can see Rowan understand
his current aim, weigh live constraints and legal options, choose a validated
action, carry it forward, and update the next uncertainty without needing to
press a progression/action/reply button for him. The loop should move briskly:
the viewer should see decisions become actions and actions become consequences,
not long static stretches of generic watch-mode copy.

## Build Goal

Convert the street app into an auditable living-world loop where seeded world state defines places, NPCs, schedules, jobs, problems, memories, and desired objective outcomes; the world exposes legal actions from current state; Rowan's planner chooses among those actions through a visible reasoning callback with next uncertainty; the simulator validates consequences; and the renderer shows Rowan carrying the resulting task forward on the same spatial model.

## Authority Chain

This is the order of authority. Do not invert it.

1. Seed data creates the initial world: map, places, NPCs, jobs, problems, events, schedules, memories, and objective definitions.
2. Time advances the world: NPCs move, jobs open or close, problems escalate or resolve, city events start and end.
3. Objectives define desired-state predicates: outcomes, blockers, evidence, urgency, and completion checks.
4. The simulator exposes legal actions from current state.
5. Rowan's planner chooses from legal actions using current world pressure, objective predicates, memory, location, energy, money, conversations, jobs, problems, and schedules.
6. The planner or LLM returns a player-facing decision artifact: situation summary, options considered, selected action, rejected-action reasons, concise rationale, and next check when the trace can truthfully support one.
7. The simulator validates and applies the chosen action.
8. The renderer projects the validated state through the visual map; movement follows legal routed paths.
9. Browser probes and tests expose the chain so it can be audited.

Objective trails, authored anchors, route hints, and UI labels are explanatory scaffolding only. They must not be the primary progress mechanism.

The decision artifact is product-facing rationale, not raw hidden model chain-of-thought. It should make Rowan's reasoning legible without exposing system prompts, backend internals, or unvalidated model authority.

## Scope

- In: Rowan autonomy, objective evaluation, legal action planning, LLM/planner reasoning callbacks, sim consequences, independent world evolution, visual route legality, browser diagnostics, and adversarial regression tests.
- Out: full procedural world generation, unsandboxed LLM authority over state mutation, new engine migration, large new content arcs, and decorative route polish that leaves control flow scripted.
- Requires approval: destructive git operations, direct pushes to `main`, production deployment changes, or any operation outside the repo's normal local validation flow.

## Required Context

Read these before making claims or changes on this path:

- `AGENTS.md`
- `CORE_CONSTRUCT.md`
- `docs/street/runtime-operating-manual.md`
- `docs/street/living-world-simulation-plan.md`

For implementation audits, inspect the relevant current files:

- `apps/sim-server/src/sim/engine.ts`
- `apps/sim-server/src/sim/objectiveState.ts`
- `apps/sim-server/src/sim/rowanLoop.ts`
- `apps/sim-server/src/street-sim/seedGame.ts`
- `apps/sim-server/src/street-sim/cityEvents.ts`
- `apps/many-lives-web/src/lib/street/navigation.ts`
- `apps/many-lives-web/src/lib/street/visualNavigation.ts`
- `apps/many-lives-web/src/lib/street/browserProbe.ts`
- `scripts/rowan-browser-regression.mjs`

## Obligation Matrix

| Obligation | Evidence | Pass condition | Fallback |
| --- | --- | --- | --- |
| Objectives are desired outcomes, not route scripts. | Source audit and sim tests. | Objective completion is based on predicate outcomes, blockers, evidence, and urgency; trail state is not authoritative. | Add adversarial stale-trail tests before changing planner behavior. |
| Rowan chooses from legal current-state actions. | Planner trace and sim tests. | The selected action appears in the current legal action surface or as a validated legal move; rejected options include reasons. | Fail closed with a blocked/idle loop step and diagnostic trace. |
| Seeded hints cannot override live state. | Poisoned route/trail regression. | Wrong, stale, impossible, or lower-priority route hints do not control the chosen action. | Remove scoring or routing code that reads trail hints as planner authority. |
| Rowan's reasoning is visible. | Rail/notebook UI, planner trace, and browser artifacts. | Before or during each meaningful autonomous action, the user can see Rowan's current objective, relevant constraints, considered options or rejected reasons, selected action, concise rationale, and trace-backed next uncertainty. | Add a structured decision artifact before adding more actions or visual polish. |
| The first run has momentum. | Browser regression artifacts, watch-mode screenshots, and playback state. | A fresh watch run quickly leaves the opening state, then keeps producing visible route, conversation, objective, memory, world-pressure, or reasoned time-advance beats while legal actions exist. | Tighten autoplay follow-through, conversation reply cadence, or wait handling before adding new content. |
| The world changes without Rowan solving everything. | Time-advance tests and browser probe `worldPressure`. | NPC schedules, job windows, problems, and city events mutate while Rowan does unrelated actions or waits. | Add deterministic passive evolution before adding more objectives. |
| Movement reflects the actual map. | Browser regression route diagnostics and screenshots. | Rowan and sampled NPC paths follow projected walkable graph routes or approved same-tile approach points. | Report dropped waypoints or blocked routes with diagnostics instead of drawing illegal shortcuts. |
| The loop is auditable in the browser. | `window.__manyLivesStreetProbe()` or browser regression artifacts. | Probe exposes objective predicates, planner considered/selected/rejected options, route legality, NPC route diagnostics, and world pressure. | Add probe fields before claiming behavior is AI-driven. |
| Visual claims are inspected, not inferred. | Screenshots from `visual:game` or browser regression artifacts. | The first route, return route, rail, map, and mobile layout look coherent in captured output. | State the visibility gap and ask for access or artifacts. |

## Execution Loop

1. Orient: read the required docs, check `git status --short`, inspect the current state sources, and identify whether the change touches objectives, planner, sim state, routing, UI, or deployment.
2. Plan: write the smallest work package that advances the authority chain. Name the exact acceptance test that would fail if scripted route-following returns.
3. Act: make the narrowest code or doc change. Keep seeded content as input data and keep simulator validation authoritative.
4. Verify: run the narrowest sufficient checks. Use `corepack pnpm lint` for TypeScript or route changes, `corepack pnpm visual:game` for visual/camera/autoplay/layout changes, `corepack pnpm --filter @many-lives/many-lives-web build` for Next.js production-boundary changes, and `corepack pnpm test` before commit or push when gameplay, routing, sim behavior, or visual smoke coverage changed.
5. Inspect: for visual or gameplay changes, open browser output or generated screenshots. A passing command is not enough for map, route, or "living city" claims.
6. Repair: if verification fails, fix the cause and rerun the relevant check. If an assumption cannot be verified, mark it as a visibility gap.
7. Report: summarize the behavior change, the evidence, and any remaining hardcoded-control risk.

## Review Alignment Delta

Every review of Rowan autonomy, objectives, autoplay, or AI planning should state
the current delta from this target:

- Can a user watch Rowan continue in observe/autoplay mode without pressing a
  progression or action button?
- Is there a visible decision artifact for the next meaningful action?
- Does that artifact show objective, constraints, options, selected action,
  rejected reasons, concise rationale, and next uncertainty when trace-backed?
- Is the selected action backed by current legal actions and simulator
  validation?
- Are LLM outputs advisory until validated, or can the model mutate state
  directly?
- Does the UI explain enough for a normal viewer without becoming a debug
  dashboard?
- Does the first run keep moving through visible decisions, actions, and
  consequences, or does it sit on repeated generic wait/carry-forward states?
- Does Rowan carry the validated plan forward, or does the run wait for the
  viewer to click the next progression/reply/action control?

If any answer is no, report it as an alignment gap with the exact missing
evidence and the smallest validation that would catch a regression.

## Priority Path

1. Objective predicates: every objective has desired state, blockers, urgency, evidence, and completion evaluators.
2. Legal action planner: Rowan ranks legal current-state actions and emits a trace with considered, selected, and rejected options.
3. Reasoning callback: Rowan's next decision appears as a readable planner/LLM-backed rationale with objective, constraints, options, rejected reasons, selected action, and next uncertainty, with model output kept advisory until simulator validation.
4. Short-horizon follow-through: Rowan can form a small plan and state what he will check next, but every step is still validated one action at a time by the simulator.
5. Independent world pressure: NPC schedules, job windows, problem escalation, and city events keep evolving while Rowan waits or does unrelated work.
6. Spatial authority: Rowan and NPC rendering route through the same projected walkable map graph.
7. Adversarial regression coverage: stale hints, poisoned trails, blocked routes, impossible anchors, missed jobs, and ignored problems fail loudly.
8. Pacing pressure: autoplay prefers validated current-state actions, direct replies, and meaningful time jumps over static idle loops, without overriding legal action authority.
9. Player readability and delight: the UI explains why Rowan moved or waited without turning the game into a debug dashboard.

## Acceptance Criteria

This path is reached only when the following are directly evidenced:

- A poisoned objective trail cannot make Rowan follow the wrong route or skip the live objective state.
- An objective can complete from desired-state predicates even if its route hints are absent, stale, or wrong.
- Rowan's selected action is traceable to current legal actions, current world pressure, and objective predicates.
- Rowan's selected action is accompanied by a user-visible decision artifact that summarizes the relevant objective, constraints, options, rejected reasons, chosen next action, and trace-backed next uncertainty.
- Time advancement mutates NPC locations, job availability, city events, and at least one problem outcome independently of Rowan's chosen route.
- Browser diagnostics expose objective predicates, planner trace, world pressure, Rowan route legality, and NPC route legality.
- Rowan and sampled NPCs render on legal routed paths through the projected walkable map.
- A fresh `/?new=1` run for the first 3 to 5 minutes reads as Rowan finding his way in a living city, not a replay of a fixed route.
- The first run keeps a visible cadence: decisions become validated actions, actions produce route, conversation, memory, objective, world-pressure, or reasoned time-advance changes, and generic carry-forward states do not repeat while legal actions are available.
- Observe/autoplay mode carries the run without visible progression/action-button clicks.

## `/plan` Command Statement

When the user asks for `/plan` in this repo, use this statement:

```text
Advance Many Lives one verifiable step toward a seeded living-world simulation: authored data seeds the city, objective predicates define desired outcomes, the world exposes legal current-state actions, Rowan's planner chooses among those actions through a visible LLM/planner reasoning callback with next uncertainty, the simulator validates consequences, Rowan carries the validated task forward at a brisk watchable pace without approval clicks, the visual map renders only legal routed movement, and independent NPCs, jobs, problems, and city events continue evolving whether Rowan acts on them or not.
```

Then produce a short turn plan with:

- the specific authority gap being addressed;
- the reasoning-visibility delta, if Rowan is deciding or planning;
- the files to inspect or change;
- the adversarial test that should fail if hardcoded route-following returns;
- the pacing evidence that should fail if watch mode stalls or repeats generic carry-forward states;
- the validation commands and screenshots/probe artifacts required before reporting success.
