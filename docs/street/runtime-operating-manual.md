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
- The rail and playback beats explain what Rowan is doing. They are not the source of truth.
- The map must support user panning while autoplay runs, so the viewer can look around without fighting camera snaps.
- Ambient citizens should move at believable human scale and speed. They are part of the "living city" read, not tiny decorative markers.

When autoplay feels wrong, inspect both:

- Game state and available actions from `/sim/game/<id>/state`.
- UI playback state in [rowanPlayback.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/rowanPlayback.ts) and [rowanAutonomy.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/street/rowanAutonomy.ts).

## Conversation And Tone Contract

For now, conversation should be plain English.

- Avoid stylized labor-poetry, cryptic maxims, and lines that dodge the user's actual question.
- NPC answers should respond directly to Rowan's last line and the current objective.
- Prompt/context work must verify what the model or deterministic fallback receives: current location, NPC identity, NPC profile, objective, recent conversation history, known job/problem state, and available actions.
- If custom text input is reintroduced, treat all user text as untrusted. Limit length, sanitize output rendering, and keep it out of system-level prompt instructions.

## Visual And Layout Contract

The right rail should help the player understand the run without covering the whole city.

- Desktop should show a readable map with a right-side rail that avoids hiding important map items.
- Tablet and narrow desktop widths should preserve the map as the primary surface while keeping actions reachable.
- Phone layouts may collapse the rail, but the first screen must still communicate who Rowan is, what is happening now, and how to continue watching or acting.
- Map panning should work by drag, touch, and scroll-like gestures where supported.
- Edge affordances should indicate when there is no more map to pan in a direction.
- The map should not leave large unexplained black voids around the authored city.
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

## Mandatory Review Checklist

Use this checklist when the user asks whether the app is playable, ready, or deployable.

- Load fresh run: `/?new=1&autoplay=1`.
- Load saved prompt: open `/` after `many-lives:street-game-id` exists and confirm the choice screen appears.
- Resume saved run and confirm the game id matches storage.
- Start new from the saved-run prompt and confirm the new id differs.
- Watch autoplay for 3 to 5 minutes or until the first stopping point.
- Pan to each map edge and confirm the user can tell when the edge is reached.
- Check desktop, tablet, and phone-sized layouts.
- Inspect screenshots, not only test output.
- Confirm no visible browser errors.
- Run `corepack pnpm visual:game`.
- Run `corepack pnpm lint` and `corepack pnpm --filter @many-lives/many-lives-web build` for code changes.
- Run `corepack pnpm test` before commit/push when gameplay, routes, sim behavior, or visual smoke coverage changed.

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
