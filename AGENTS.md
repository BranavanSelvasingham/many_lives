# Agent Instructions

Always try to validate your work and results. If you are not able to see or evaluate your own output, tell the user so they can decide whether to provide more access.

## Many Lives Street App Checklist

Before making claims or changes about the street app, read [docs/street/runtime-operating-manual.md](/Users/branavan/GitHub/many_lives/docs/street/runtime-operating-manual.md).

For reload, saved-run, autoplay, or session issues, check every state source before answering:

- URL search params: `gameId`, `autoplay`, `observe`, `new`, `newGame`, `reset`
- Browser storage: `localStorage` key `many-lives:street-game-id`
- Runtime visual override storage: `many-lives.visual-scene-runtime.*`
- Scene builder draft storage: `many-lives.visual-scene-builder.south-quay-v2`
- Server or in-process game store behind `/sim/game/*`
- Client fallback mode when the backend cannot be reached

The street game does not currently use cookies for game identity. If cookies are introduced later, update the operating manual and the visual smoke test in the same change.

## Required Validation

Use the narrowest validation that covers the change, but do validate.

- Treat every confirmed bug as a root-cause hardening task, not a local patch. A fix is not done until it covers the affected behavior across relevant screen sizes, input modes, saved/reloaded states, and runtime modes, with regression tests or smoke coverage that would fail if the bug returns.
- Run `corepack pnpm visual:game` for visual, camera, panning, reload, stored-run, autoplay, or responsive layout changes.
- Run `corepack pnpm lint` for TypeScript or route changes.
- Run `corepack pnpm --filter @many-lives/many-lives-web build` for Next.js routing, Suspense, server/client boundary, or production-readiness changes.
- Run `corepack pnpm test` before commit/push when gameplay, routes, sim behavior, or visual smoke coverage changed.
- Inspect generated screenshots or browser output for visual work. A passing command is not enough for layout or vibe changes.

## Review Bias

The target is a clean first 3 to 5 minutes: the app should load clearly, show Rowan making understandable choices, let the user pan around the city, and never make the run feel like a stale recording or a broken reload.

When reviewing Rowan autonomy, objectives, autoplay, or AI planning, explicitly audit whether objectives are desired outcomes with route hints or whether `advance_objective` is still primarily following hardcoded trail steps. Flag hardcoded route-following as the core agency gap, even if the resulting path is playable.

Also audit whether Rowan's next meaningful action has a visible decision artifact: current objective, relevant constraints, considered or rejected options, selected action, and concise rationale from the planner/LLM callback after simulator validation. Flag any meaningful autonomous action with no visible reasoning callback as an alignment gap.

For observe/autoplay, explicitly verify whether Rowan carries on with zero visible progression, reply, wait, or action-button clicks. A required next-action click in watch mode is a regression, not acceptable pacing.

When reviewing, lead with functional regressions, then visual or tone regressions, then structural cleanup. Keep unrelated refactors out of fixes unless they are needed to make the current behavior reliable.
