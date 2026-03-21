# Architecture

## Simulation Core

The simulation server owns the authoritative world state. Each tick advances time by 30 minutes through a staged loop:

1. world pressure advances
2. characters perceive part of that change
3. characters act through current commitments
4. outcomes resolve
5. memory updates
6. attention routing decides what reaches the player

The current commitment layer still uses tasks, travel, and obligations, but those now sit inside a broader model that also tracks city structure, rival movement, character memory, and attention decisions.

## Web Client Shell

The client is a desktop-first Next.js dashboard. It keeps the attention model explicit:

- left rail for who is under pressure
- center panel for what needs attention now
- right panel for decisions and policy tuning
- bottom strip for time, risk, and pacing controls

The web client can talk to the live sim server or fall back to local mock state when the backend is unavailable.

## World, Memory, And Attention

The world model now carries:

- city districts, factions, rivals, clocks, and openings
- richer character identity and standing instincts
- memory state per character
- relationship state
- an attention log alongside inbox items

Events are still the raw outputs of simulation, but inbox messages are now only one possible attention outcome. The attention resolver can classify events as silent, ambient, digest, message, or interrupt based on stakes, reversibility, coherence threat, rival pressure, and character policy.

## State Boundaries

Server state lives in the sim service and is fetched through TanStack Query in the web app. Local UI state is intentionally small and only tracks ephemeral interface concerns such as selected character, selected message, active inbox tab, and temporary rule or override drafts. This keeps the browser client flexible without duplicating the whole simulation model.

## AI Abstraction Layer

AI sits behind a provider interface with four jobs: summarize state, classify escalation, generate inbox copy, and propose next actions. The current mock provider is deterministic and requires no API key. The OpenAI provider file is intentionally a stub adapter so a real integration can be added later without changing the sim engine or route contracts.
