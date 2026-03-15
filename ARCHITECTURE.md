# Architecture

## Simulation Core

The simulation server owns the authoritative world state. Each tick advances time by 30 minutes, resolves travel and task progress, detects schedule conflicts or missed obligations, and records events. Characters carry their own energy, stress, location, active task, and policy settings so the world can evolve deterministically without any external services.

## Web Client Shell

The client is a desktop-first Next.js dashboard. It keeps the attention model explicit:

- left rail for who is under pressure
- center panel for what needs attention now
- right panel for decisions and policy tuning
- bottom strip for time, risk, and pacing controls

The web client can talk to the live sim server or fall back to local mock state when the backend is unavailable.

## Inbox And Escalation

Events are the raw outputs of simulation. An escalation resolver scores those events against character policy settings such as risk tolerance, reporting frequency, and escalation threshold. When the deterministic score crosses the threshold, the server generates an inbox message with suggested actions and response requirements. This keeps the inbox tightly tied to simulation consequences rather than freeform narration.

## State Boundaries

Server state lives in the sim service and is fetched through TanStack Query in the web app. Local UI state is intentionally small and only tracks ephemeral interface concerns such as selected character, selected message, active inbox tab, and temporary rule or override drafts. This keeps the browser client flexible without duplicating the whole simulation model.

## AI Abstraction Layer

AI sits behind a provider interface with four jobs: summarize state, classify escalation, generate inbox copy, and propose next actions. The current mock provider is deterministic and requires no API key. The OpenAI provider file is intentionally a stub adapter so a real integration can be added later without changing the sim engine or route contracts.
