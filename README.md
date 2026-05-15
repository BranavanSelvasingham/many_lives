# Many Lives

Many Lives is shifting toward a simpler core: a single-character city simulation where you find your way around, find work, meet people, and solve problems in a living world.

The current repo still contains the earlier dashboard-based prototype, but the design direction has changed. The new foundation is a top-down 2D city, one embodied character, and a grounded loop built around place, time, memory, and local problems.

## Core Construct

The living reference for the game's underlying simulation model is [CORE_CONSTRUCT.md](/Users/branavan/GitHub/many_lives/CORE_CONSTRUCT.md).

Use that document as the architectural anchor for changes to world simulation, character behavior, memory, embodiment, and the canonical game loop.

For the current street micro-app runtime, saved-run behavior, autoplay/watch mode, visual QA, and deployment checks, use [docs/street/runtime-operating-manual.md](/Users/branavan/GitHub/many_lives/docs/street/runtime-operating-manual.md).

## Prototype Pillars

- One character in one city is the current gameplay foundation.
- The world should be understandable through movement and presence, not only through abstract UI.
- Memory and reputation should change future options quickly.
- The simulation remains authoritative when the backend is available.
- Mock mode stays useful while the project transitions toward the new loop.

## Repo Layout

```text
many-lives/
  apps/
    many-lives-web/
    sim-server/
  ARCHITECTURE.md
  README.md
  UI_ARCHITECTURE.md
```

## Install

1. Make sure you have Node.js 20+.
2. Enable Corepack or use a local `pnpm` install.
3. Install dependencies from the repo root:

```bash
corepack pnpm install
```

## Run

Run the web app:

```bash
corepack pnpm dev:web
```

The Next.js app starts on [http://127.0.0.1:3001](http://127.0.0.1:3001).

Run the simulation server:

```bash
corepack pnpm dev:server
```

The Fastify sim server starts on [http://127.0.0.1:3000](http://127.0.0.1:3000).

Run both together:

```bash
corepack pnpm dev
```

## Mock Mode

Mock mode is the default fallback if the backend cannot be reached.

- The client attempts the real `/game/*` flow first.
- If create, fetch, tick, resolve, delegate, snooze, or policy requests fail, the web app swaps to seeded local game state.
- The UI shows a subtle `Mock Mode` indicator so the app still feels intentional instead of broken.
- Mock state stays playable during the session: ticking time spawns follow-ups, actions resolve threads, and policy changes persist in memory.

The current mock seed still reflects the older Ascension Window dashboard slice while the project transitions toward the simpler single-character city loop.

## Backend Mode

When the sim server is available, the web client uses the real game endpoints and treats the simulation as authoritative.

For hosted environments such as Azure Web App, set `NEXT_PUBLIC_MANY_LIVES_API_URL` to the deployed sim-server base URL. If you leave it unset, the client proxy falls back to `http://127.0.0.1:3000`, which is only correct for local development.

Helpful endpoints:

- `GET /health`
- `POST /game/new`
- `GET /game/:id/state`
- `POST /game/:id/tick`
- `POST /game/:id/command`
- `POST /game/:id/policy`

The web app reaches those routes through the Next.js proxy layer in [client.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/api/client.ts) and [gameApi.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/api/gameApi.ts).

### Server-Side OpenAI Thoughts

The street slice can optionally generate richer NPC/player thought bubbles on the server with OpenAI while keeping deterministic fallback behavior.

- Set `AI_PROVIDER=openai`
- Set `OPENAI_API_KEY` in server-only environment settings
- Optionally set `OPENAI_MODEL=gpt-5-nano` (this is the intended low-cost default)

Do not expose the key through any `NEXT_PUBLIC_*` variable. For Azure, put the key and provider settings in Web App application settings so they exist only at runtime on the server.

You can confirm which provider the live app is using through `GET /sim/health`, which returns `aiProvider`.

### Production Rate Limits

The deployed Next `/sim` routes now apply production-only per-IP rate limits to mutating endpoints:

- `POST /sim/game/new`
- `POST /sim/game/:id/command`
- `POST /sim/game/:id/tick`
- `POST /sim/game/:id/policy`

Local development is unaffected. The limiter only turns on when `NODE_ENV=production` unless you explicitly disable it with `SIM_RATE_LIMIT_DISABLED=true`.

Default per-IP limits per 60-second window:

- `SIM_RATE_LIMIT_GAME_NEW_MAX=12`
- `SIM_RATE_LIMIT_COMMAND_MAX=90`
- `SIM_RATE_LIMIT_TICK_MAX=45`
- `SIM_RATE_LIMIT_POLICY_MAX=30`

Optional tuning:

- `SIM_RATE_LIMIT_WINDOW_MS`
- `SIM_RATE_LIMIT_DISABLED`

For Azure, set these as Web App application settings so they apply only on the deployed server.

## Current Prototype UI

- Left rail: self triage and pressure read.
- Center panel: attention feed filters, counts, and thread cards.
- Right panel: scenario framing, selected thread detail first, otherwise self detail plus policy.
- Bottom strip: world time, window pressure, board state, rival movement, world pulse, next thread, and tick controls.

Right-panel priority is deliberate:

1. If a message is selected, show message detail.
2. Otherwise, if a character is selected, show character detail plus policy.
3. Otherwise, default to the first urgent message, then the first character.

## Key Component Locations

- Shell and panel composition: [AppShell.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/layout/AppShell.tsx)
- Character rail and summary: [LeftRail.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/layout/LeftRail.tsx)
- Inbox triage flow: [InboxPanel.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/inbox/InboxPanel.tsx)
- Message decisions and rule training: [MessageDetailPanel.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/inbox/MessageDetailPanel.tsx)
- Character management: [CharacterDetailView.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/characters/CharacterDetailView.tsx)
- Policy editing: [PolicyPanel.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/policies/PolicyPanel.tsx)
- Control strip: [TimelineStrip.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/timeline/TimelineStrip.tsx)
- Mock seed and client-side mutations: [mockData.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/utils/mockData.ts)
- Selection and attention state: [selectionStore.ts](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib/state/selectionStore.ts)

## Validation

Run the full app harness before release or deployment work:

```bash
corepack pnpm harness
```

This runs lint, sim tests, web fallback coverage, the production web build, public secret exposure scanning, Rowan playtests, and browser visual smoke checks. It writes logs, screenshots, and a `summary.json` file to `/tmp/manylives-app-harness-<timestamp>/`.

Run the faster structural harness while iterating:

```bash
corepack pnpm harness:quick
```

Run only the web lint pass:

```bash
corepack pnpm --filter @many-lives/many-lives-web lint
```

Run the CI release gate:

```bash
corepack pnpm test
```

## Notes

- The simulation advances in 30-minute steps.
- The old Godot client scaffold is legacy and no longer part of the main workflow.
- OpenAI integration remains stubbed so the prototype stays runnable without secrets.
