# Street Runtime Operating Manual

This is the working contract for the current Many Lives street micro-app. Use it before changing or reviewing reload behavior, autoplay, visual layout, conversations, saved runs, or deployment readiness.

The goal is a solid 3 to 5 minute first-run experience: Rowan arrives in South Quay, finds a real lead, moves through a readable city, talks in plain English, and reaches a natural stopping point without the app feeling scripted, stale, or broken.

## Runtime Surfaces

- Web app: [PhaserStreetGameApp.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/street/PhaserStreetGameApp.tsx) is the main runtime host. It wires React state, Phaser rendering, overlay HTML, query params, storage, input handling, autoplay, playback, and camera behavior.
- Overlay HTML: [streetOverlayHtml.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/street/streetOverlayHtml.ts) renders the main right rail, loading state, saved-run prompt, controls, panels, and action buttons.
- Overlay CSS: [streetOverlayStyles.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/streetOverlayStyles.ts) owns the responsive shell, compact phone rail, action cards, and visual affordances.
- Camera: [runtimeCamera.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/runtimeCamera.ts) and [runtimeViewport.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/runtimeViewport.ts) own map framing, panning, viewport mode, and zoom constraints.
- Visual scene source: [southQuayV2Document.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/visual-scene-documents/southQuayV2Document.ts) and [visualScenes.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/visualScenes.ts) define the authored map and runtime scene override hooks.
- Sim routes: [apps/many-lives-web/src/app/sim](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/app/sim) proxies or hosts `/sim/game/*` routes for the browser app.
- Sim engine: [apps/sim-server/src](/Users/branavan/GitHub/many_lives/apps/sim-server/src) owns the authoritative game rules when the server path is active.
- Visual smoke: [scripts/visual-game-smoke.mjs](/Users/branavan/GitHub/many_lives/scripts/visual-game-smoke.mjs) is the mandatory browser-level QA for playfield, rail, panning, responsive layout, ambient character scale, autoplay, and stored-run behavior.

## Game Identity And Reload Contract

State can come from the URL, browser storage, the server store, or local fallback. Check all of them before making claims about reload behavior.

Priority order on app load:

1. Fresh-run params win: `?new=1`, `?newGame=1`, or `?reset=1` force a new game when their value is `1`, `true`, `yes`, or `on`.
2. Explicit `?gameId=<id>` loads that exact game. With `autoplay=1` or `observe=1`, the URL remains bound to that game for watch and review links. In normal interactive mode, the app may hide the `gameId` after it opens the run.
3. If there is no explicit `gameId` and no fresh-run param, the app reads `localStorage["many-lives:street-game-id"]`.
4. If that stored id exists, the app must show the saved-run choice prompt. It must not silently resume a completed run and make the root URL look finished.
5. If the user chooses Continue Saved Run, open the stored id.
6. If the user chooses Start New Run, create a new game, remember the new id, and leave the old completed run behind.
7. If there is no usable URL id or stored id, create a fresh game.

The street game does not currently use cookies for game identity. The important browser key is:

```text
many-lives:street-game-id
```

Other localStorage keys are for visual editing, not player session identity:

```text
many-lives.visual-scene-runtime.<sceneId>
many-lives.visual-scene-runtime-version.<sceneId>
many-lives.visual-scene-builder.south-quay-v2
```

Reload expectations:

- Reloading a URL with `gameId` should reopen that game, even if it is complete.
- Opening `/` with a stored id should show the saved-run choice.
- Opening `/` with no stored id should create a new game.
- Opening `/?new=1` should create a new game and update stored id.
- A completed stored game should never silently appear as the default root page.

## Autoplay And Agency Contract

Autoplay is a watch mode for Rowan's current autonomy policy. It should feel like observing a small living city, not replaying a canned path.

- `?autoplay=1` lets Rowan continue through available goals and actions without manual clicks.
- Autoplay does not choose which game to load; URL and storage rules still decide that.
- Rowan's behavior should come from current sim state, available actions, objectives, conversations, and local policy helpers. It should not depend on a fixed prerecorded movement list.
- Objectives describe desired outcomes. They may provide progress scaffolding and route hints, but they must not be the primary source of Rowan's next move. Rowan's next move should come from the current world state and legal action surface, with deterministic validation and fallback.
- Rowan's next meaningful action should be explained by a visible decision artifact: current objective, relevant constraints, options considered or rejected, selected action, concise rationale, and trace-backed next uncertainty from the planner/LLM callback.
- The planner/LLM callback is advisory until the simulator validates the selected action. Do not expose raw hidden chain-of-thought, system prompts, or backend-shaped debug state as player UI.
- The rail and playback beats explain what Rowan is doing. They are not the source of truth.
- In `?autoplay=1` or `observe=1`, Rowan must not wait for the viewer to click a progression, reply, wait, or action button. Showing a required next-action button in watch mode is a bug unless it is clearly outside observe/autoplay mode.
- The map must support user panning while autoplay runs, so the viewer can look around without fighting camera snaps.
- Ambient citizens should move at believable human scale and speed. They are part of the "living city" read, not tiny decorative markers.

When autoplay feels wrong, inspect both:

- Game state and available actions from `/sim/game/<id>/state`.
- UI playback state in [rowanPlayback.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/rowanPlayback.ts) and [rowanAutonomy.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/rowanAutonomy.ts).

## Living-World Agency Audit

Use this audit whenever reviewing Rowan autonomy, objectives, autoplay, AI planning, or the first 3 to 5 minutes. This is the check that should flag the difference between a seeded living world and a hardcoded route.

For planning work on this axis, use [docs/street/living-world-simulation-plan.md](/Users/branavan/GitHub/many_lives/docs/street/living-world-simulation-plan.md) as the source contract and the web app's `/plan` route as the visible project `/plan`. They define the authority chain, acceptance criteria, evidence ledger, and required validation loop for moving from authored-route playback toward a living-world agent loop.

- Seeded data may define places, NPCs, jobs, problems, schedules, world events, memories, and objective outcomes.
- Objective trails may show progress and provide hints, but a review must flag any implementation where `advance_objective` primarily follows the next trail step instead of evaluating current state and legal actions.
- Objective completion should be evaluated from `player.objective.outcomes`: desired-state predicates with status, evidence, blockers, and urgency. `trail.done` is explanatory scaffolding only and must not be the authoritative completion mechanism.
- Route-specific hints, opening lines, rationale copy, semantic location hints, and special conversation exceptions belong in the objective scaffold layer, not scattered through planner control flow. If a review finds inline `routeKey` branches in the engine that steer choices instead of reading scaffold data, flag that as an agency hardening gap.
- Rowan's decision loop should consider current location, time, money, energy, memory, active conversations, known places, known people, jobs, problems, city events, commitments, and available actions.
- NPCs, jobs, problems, and city events should keep evolving as time advances whether Rowan acts on them or not.
- AI planning may choose only from validated allowed actions. The simulator remains authoritative for movement, time, consequences, and state mutation.
- The UI or browser artifacts should expose Rowan's decision rationale as a summarized callback: what he knows, what he is trying to do, what options were available, why one was chosen, what was rejected, and what uncertainty Rowan expects to check next. Reviews should flag any meaningful autonomous action that lacks this evidence.
- Reviews must report whether observe/autoplay is truly zero-click for the scenario under test. A visible required action button in watch mode is a first-order autoplay regression, not a minor UI preference.
- If a change only makes a scripted path more polished, call that out explicitly. Do not describe it as AI-driven or living-world behavior unless Rowan can choose among state-derived legal actions and the world can change independently.

## Conversation And Tone Contract

For now, conversation should be plain English.

- Avoid stylized labor-poetry, cryptic maxims, and lines that dodge the user's actual question.
- NPC answers should respond directly to Rowan's last line and the current objective.
- Prompt/context work must verify what the model or deterministic fallback receives: current location, NPC identity, NPC profile, objective, recent conversation history, known job/problem state, and available actions.
- If custom text input is reintroduced, treat all user text as untrusted. Limit length, sanitize output rendering, and keep it out of system-level prompt instructions.

## Visual And Layout Contract

The right rail should help the player understand the run without covering the whole city.

- Visual, camera, panning, and responsive bugs must be fixed as permanent cross-viewport issues. Do not stop at the viewport where the bug was reported; cover desktop, compact desktop, tablet, Codex browser, tall screenshot, and phone-like sizes as relevant, then add or extend regression coverage so the same failure cannot silently return.
- Desktop should show a readable map with a right-side rail that avoids hiding important map items.
- Tablet and narrow desktop widths should preserve the map as the primary surface while keeping actions reachable.
- Phone layouts may collapse the rail, but the first screen must still communicate who Rowan is, what is happening now, and how to continue watching or acting.
- Map panning should work by drag, touch, and scroll-like gestures where supported.
- On compact/tall Codex browser viewports, the playable camera viewport must start below the top HUD. A north pan is not fixed if the map still renders behind the day/time/energy pill.
- A compact north pan is not fully fixed until the northern road/fringe visibly clears the HUD at the pan limit. Numeric scroll movement is insufficient if the top authored content still feels clipped or pinned to the safe band.
- Compact panning must use one shared X/Y camera scroll range for both live camera updates and reset framing. Do not reintroduce axis-specific hard clamps such as compact `scrollY >= 0`.
- Compact camera offset caps must be large enough to actually reach that scroll range; a valid numeric scroll range is not enough if the gesture caps out before north clears the HUD.
- The visual smoke test must cover the Codex-sized compact viewport, the tall Codex screenshot viewport, and compact/tablet/phone breakpoint viewports. It must assert west, north, east, and south traversal with screenshots, because partial edge checks can miss direction-specific pan failures.
- Compact camera regressions must cover high-DPR browser windows as well as CSS viewport size. A fix is not complete if it only passes DPR 1 headless screenshots while the in-app browser at DPR 2 still caps north or west panning early.
- Edge affordances should indicate when there is no more map to pan in a direction.
- The map should not leave large unexplained black voids around the authored city.
- NPC objective cues should mark the NPC and route, not draw a full-location translucent footprint halo. Large low-alpha rectangles around landmarks read as render noise unless the target is the location itself.
- Landmarks should be visually identifiable before labels: cafe, boarding house, square, dock yard, and quay edge should read by shape and props.

Use [docs/street/south-quay-visual-spec.md](/Users/branavan/GitHub/many_lives/docs/street/south-quay-visual-spec.md) for map art direction.

## Security Contract

No secret should ever be exposed to the browser bundle.

- `OPENAI_API_KEY` belongs only in server-side environment settings.
- Do not use a `NEXT_PUBLIC_*` environment variable for secrets.
- `NEXT_PUBLIC_MANY_LIVES_API_URL` is allowed because it is a public endpoint base URL, not a secret.
- Mutating `/sim` routes should keep production rate limits enabled unless there is an explicit deployment reason.
- Client-rendered conversation, feed, and objective text must be escaped or rendered through React text nodes, not injected as trusted HTML.
- Stored browser state is convenience state, not trusted authority. The server or in-process sim should validate game commands.

Before pushing, run a quick secret exposure scan:

```bash
rg -n "OPENAI_API_KEY|sk-[A-Za-z0-9_-]{20,}|NEXT_PUBLIC_.*KEY|apiKey" .
```

Then inspect any matches. Some source references are expected, but real secret values are not.

## Live OpenAI Contract

The default regression harness does not spend OpenAI tokens. It uses mock or deterministic providers so CI stays stable, cheap, and reproducible.

- Do not claim live OpenAI behavior is working from `corepack pnpm test`, Rowan browser regression, or visual smoke alone.
- Run `corepack pnpm live:openai` when validating real OpenAI endpoint behavior. This command loads local `.env` files without printing secrets, calls the Responses API through `OpenAIProvider`, requires a successful `planStreetNextAction` call, and fails if the provider silently falls back or returns an action outside the allowed action surface.
- Run `corepack pnpm live:openai:rowan` when validating that Rowan's early autonomy loop is actually exercising live OpenAI planner calls during a first-run session. It fails if no planner call succeeds or if any live call falls back.
- Treat `AI_PROVIDER=openai` or `/sim/health` reporting `aiProvider: "openai"` as configuration evidence only. It is not proof that a live request was made during a given playtest.
- Keep live OpenAI smoke opt-in. Do not make it a required default CI step unless the workflow has explicit secret availability, budget approval, and failure-policy ownership.

## Mandatory Review Checklist

Use this checklist when the user asks whether the app is playable, ready, or deployable.

- Load fresh run: `/?new=1&autoplay=1`.
- Load saved prompt: open `/` after `many-lives:street-game-id` exists and confirm the choice screen appears.
- Resume saved run and confirm the game id matches storage.
- Start new from the saved-run prompt and confirm the new id differs.
- Watch autoplay for 3 to 5 minutes or until the first stopping point.
- Confirm observe/autoplay does not require visible progression, reply, wait, or action-button clicks.
- Confirm Rowan's next meaningful action has a visible decision artifact or browser artifact: objective, constraints, considered/rejected options, selected action, rationale, and trace-backed next uncertainty when available.
- Run the final player-POV browser regression: the inhabit gameplay pass must progress from a fresh browser session by visible clicks and pointer drags, not direct sim commands.
- Confirm Rowan's objective decisions come from current world state and available legal actions, not just the next hardcoded objective trail item.
- Pan to each map edge and confirm the user can tell when the edge is reached.
- Check desktop, tablet, and phone-sized layouts.
- Inspect screenshots, not only test output.
- Confirm no visible browser errors.
- Run `corepack pnpm visual:game`.
- Run `corepack pnpm lint` and `corepack pnpm --filter @many-lives/many-lives-web build` for code changes.
- Run `corepack pnpm test` before commit/push when gameplay, routes, sim behavior, or visual smoke coverage changed.

## App Harness

The app-level harness is the single release-readiness command for this street micro-app:

```bash
corepack pnpm harness
```

It runs the sim lint pass, web lint pass, sim tests, repo Node tests, web fallback test, production Next build, public secret exposure scan, Rowan sim playtest, visual game smoke, and a final browser gameplay regression. `corepack pnpm test` runs the same harness with the CI profile.

The browser regression includes a final inhabit gameplay pass. That pass opens a fresh browser session, uses visible controls, pointer drags, and normal watch-mode beats to act like a player, checks Locals/Journal/Notebook, verifies camera drag response, and reaches first-afternoon completion without direct sim commands. Use it directly with:

```bash
corepack pnpm playtest:inhabit:browser
```

Harness artifacts are written outside the repo by default:

```text
/tmp/manylives-app-harness-<timestamp>/
  logs/
  rowan-browser/
  visual-game/
  summary.json
```

For a faster structural check that skips browser and visual playtests:

```bash
corepack pnpm harness:quick
```

For a deployed smoke check, pass the live base URL:

```bash
corepack pnpm harness -- --live-url https://manylives-sim.branavan.com
```

Do not claim the app is deployment-ready from isolated commands if the harness is failing. If a narrower command is used because the change is deliberately small, say exactly which surface was not covered.

## Debug Recipes

Check the stored game id in browser context:

```js
window.localStorage.getItem("many-lives:street-game-id")
```

Clear the stored game id:

```js
window.localStorage.removeItem("many-lives:street-game-id")
```

Force a fresh autoplay run:

```text
http://127.0.0.1:3001/?new=1&autoplay=1
```

Open a specific run:

```text
http://127.0.0.1:3001/?gameId=<game-id>&autoplay=1
```

Run the browser-level visual smoke:

```bash
corepack pnpm visual:game
```

Run the full local quality gate:

```bash
corepack pnpm test
```

## Structural Debt To Keep In View

[PhaserStreetGameApp.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/street/PhaserStreetGameApp.tsx) still owns too many responsibilities. Prefer extracting stable seams when a change naturally touches them:

- Saved-run and URL state management.
- Overlay event binding.
- Autoplay/watch-mode orchestration.
- Camera and panning behavior.
- Conversation rendering and prompt preparation.
- Visual smoke probes and diagnostics.

Do not refactor this file only for neatness during a release-hardening pass. Extract when it reduces real review risk or makes a failing behavior testable.
