# Many Lives

Many Lives is a text-forward prototype for an asynchronous life-management sim. You manage multiple semi-autonomous characters through an inbox, step in on high-pressure decisions, and shape long-term behavior through standing policies.

This first vertical slice includes:

- A deterministic simulation server in Node.js + TypeScript.
- A Next.js web client focused on inbox triage, character oversight, policy editing, and world pacing.
- A mock AI provider that generates summaries, escalation copy, and suggested actions without requiring any API keys.
- A local mock fallback so the UI remains playable even when the backend is offline.

## Prototype Pillars

- The inbox is the main place where the player pays attention.
- The simulation is authoritative.
- AI is optional and currently mocked so the game is playable offline.
- Policies shape how often characters escalate issues.
- The prototype emphasizes readable UI and simulation structure over art polish.

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
2. Use Corepack or a local `pnpm` install.
3. Install dependencies from the repo root:

```bash
corepack pnpm install
```

## Run The Web Client

From the repo root:

```bash
corepack pnpm dev:web
```

The web app starts on `http://127.0.0.1:3001`.

## Run The Server

From the repo root:

```bash
corepack pnpm dev:server
```

The Fastify server starts on `http://127.0.0.1:3000` by default.

Helpful endpoints:

- `GET /health`
- `POST /game/new`
- `GET /game/:id/state`
- `POST /game/:id/tick`
- `POST /game/:id/command`
- `POST /game/:id/policy`

## Run Both Together

From the repo root:

```bash
corepack pnpm dev
```

This runs:

- the web client on `http://127.0.0.1:3001`
- the sim server on `http://127.0.0.1:3000`

## Mock Mode

The web client is usable even if the sim server is unavailable.

- UI requests go through the Next.js `/sim/*` proxy.
- If the backend cannot be reached, the client falls back to seeded local Many Lives state.
- Mock mode still supports the playable loop: new game, inbox decisions, snooze, delegate, policy edits, and ticking time forward.

## Backend Mode

When the sim server is available, the web client uses the real game endpoints and treats the simulation as authoritative.

The main UI loop is:

- Left: character cards with stress and obligation snapshots.
- Center: inbox cards with inline actions and filters.
- Right: selected message detail or selected character policy editing.
- Bottom: time, risks, obligations, and tick controls.

Main UI files live in:

- [apps/many-lives-web/src/app/page.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/app/page.tsx)
- [apps/many-lives-web/src/components/layout/AppShell.tsx](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/layout/AppShell.tsx)
- [apps/many-lives-web/src/components/characters](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/characters)
- [apps/many-lives-web/src/components/inbox](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/inbox)
- [apps/many-lives-web/src/components/policies](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/policies)
- [apps/many-lives-web/src/components/timeline](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/components/timeline)
- [apps/many-lives-web/src/lib](/Users/branavan/GitHub/many_lives/apps/many-lives-web/src/lib)

## Run Tests

From the repo root:

```bash
corepack pnpm test
```

## Useful Scripts

- `corepack pnpm dev`
- `corepack pnpm dev:server`
- `corepack pnpm dev:web`
- `corepack pnpm test`
- `corepack pnpm lint`
- `corepack pnpm format`

## Notes

- The simulation advances in 30-minute steps.
- New games seed three playable characters: Jordan, Maya, and Leo.
- The OpenAI integration file is a stubbed adapter so the repo stays runnable without secrets.
- The old Godot client scaffold is legacy and no longer part of the main workflow.
- Future work is marked with targeted `TODO` comments in the code where the next extension is obvious.
