# Many Lives

Many Lives is a web-first narrative strategy prototype set during a rare Ascension Window, a volatile period when the city is reordering itself. You manage several semi-autonomous selves through an attention dashboard: triage decisive threads, step into dangerous openings, and shape standing instincts before your lives splinter into leverage, myth, or ruin.

This vertical slice is intentionally desktop-first and mock-first. The attention feed is the heartbeat, the right panel holds the active opening or policy surface, and the bottom strip keeps city-scale pressure visible while you work.

## Core Construct

The living reference for the game's underlying simulation model is [CORE_CONSTRUCT.md](/Users/branavan/GitHub/many_lives/CORE_CONSTRUCT.md).

Use that document as the architectural anchor for changes to world simulation, character behavior, memory, attention/escalation, and the canonical game loop.

## Prototype Pillars

- Inbox triage is the primary intervention loop.
- Policies shape long-term autonomy instead of replacing moment-to-moment decisions.
- The simulation remains authoritative when the backend is available.
- Mock mode is a first-class play and demo path when the backend is unavailable.
- The UI favors cards, dashboards, and explicit actions over chat-style interaction.

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

The mock seed starts during the Ascension Window with Ivo, Sia, Ren, and Vale already in motion so the inbox loop is hot immediately.

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

## Dashboard Model

- Left rail: self triage and pressure read.
- Center panel: attention feed filters, counts, and thread cards.
- Right panel: scenario framing, selected thread detail first, otherwise self detail plus policy.
- Bottom strip: world time, Access, Momentum, Signal, Coherence, rival pressure, next opening, and tick controls.

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

Run the web lint pass:

```bash
corepack pnpm --filter @many-lives/many-lives-web lint
```

Run the sim tests:

```bash
corepack pnpm test
```

## Notes

- The simulation advances in 30-minute steps.
- The old Godot client scaffold is legacy and no longer part of the main workflow.
- OpenAI integration remains stubbed so the prototype stays runnable without secrets.
