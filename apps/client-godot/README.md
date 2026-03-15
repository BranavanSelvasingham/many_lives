# Many Lives Godot Client

This is a lightweight Godot 4 client for the Many Lives prototype. It is intentionally UI-heavy and art-light: the goal is to make inbox triage, character status, policy context, and manual ticking usable as early as possible.

The playable slice currently supports:

- Selecting characters from the left rail.
- Reviewing and resolving inbox items from the center feed.
- Editing standing policies on the right.
- Advancing time from the bottom timeline strip.

## Open In Godot

1. Open Godot 4.x.
2. Import [project.godot](/Users/branavan/GitHub/many_lives/apps/client-godot/project.godot).
3. Run the main scene.

## Backend

The client talks to the simulation server over HTTP at `http://127.0.0.1:3000` by default.

If you want to point somewhere else, set `MANY_LIVES_API_BASE_URL` before launching Godot.

If the backend is unavailable, the client automatically falls back to seeded local mock data so the UI loop is still playable.
