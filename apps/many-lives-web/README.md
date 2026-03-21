# Many Lives Web Client

Many Lives is an inbox-first narrative strategy prototype set during the Ascension Window. This package is the web client: a desktop-first Next.js dashboard for triaging selves, resolving decisive threads, editing standing instincts, and advancing the world.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- TanStack Query
- Zustand

## Run

From the monorepo root:

```bash
corepack pnpm install
corepack pnpm dev:web
```

The web app runs on `http://127.0.0.1:3001`.

If you also want the real simulation backend:

```bash
corepack pnpm dev:server
```

The sim server runs on `http://127.0.0.1:3000`.

## Mock Mode

The web client stays playable even if the backend is unavailable.

- API requests first try the sim server through the Next.js `/sim/*` proxy.
- If the backend cannot be reached, the app falls back to seeded local Many Lives mock data.
- Mock mode still supports the core loop: new game, message resolution, snooze, delegate, policy edits, and ticking time forward.
- The seeded mock state opens hot with five charged threads, visible rival pressure, and the full Ascension Window cast.

## Backend Mode

When the sim server is available, the client uses these endpoints:

- `POST /game/new`
- `GET /game/:id/state`
- `POST /game/:id/tick`
- `POST /game/:id/command`
- `POST /game/:id/policy`

## Main UI Files

- `src/app/page.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/characters/*`
- `src/components/inbox/*`
- `src/components/policies/*`
- `src/components/timeline/*`
- `src/lib/api/*`
- `src/lib/hooks/*`
- `src/lib/state/selectionStore.ts`

## Notes

- The design is intentionally dashboard-heavy and game-like, not a marketing site or chat app.
- Desktop is the main target for this prototype.
- The attention feed is the primary surface.
