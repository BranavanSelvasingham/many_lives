# Many Lives Core Construct

This is a living design document. It should stay lightweight, current, and close to the actual build.

When implementation details drift, this document is the reference point for what the game is trying to be.

## Core Principle

Many Lives is not fundamentally an inbox app.

It is a simulation about selves moving through living cities during periods of unstable transformation.

The inbox, notifications, and UI panels are outputs of that simulation, not the simulation itself.

## Core Systems

The game has 4 primary systems:

### 1. World

The world is encapsulated as cities.

Each city should evolve on its own, even without player input.

Cities contain:

- factions
- institutions
- patronage networks
- scenes and subcultures
- technologies and infrastructures
- myths, rumors, and reputations
- active tensions and transformations
- hidden currents that intensify, dissipate, and change who can move

The world must feel alive, partial, and ahead of the player.

Characters should not perceive the whole current directly.

Instead, they receive partial signals:

- a contact goes warm or cold
- a threshold changes
- a rumor sharpens
- a rival trace appears
- a scene starts heating
- a technical glimmer changes what seems possible

Commitments and inbox items should be derived from these signals, not from explicit authored set-pieces.

### 2. Characters

Characters are semi-autonomous agents, not just containers for tasks.

Each character needs:

- personality
- values
- ambitions
- fears
- style of action
- configurable standing instincts
- resources
- commitments
- relationships to the player, the world, and other characters

The player should be able to shape how a character behaves, but not directly author every move.

### 3. Memory

Memory is what gives continuity and identity to characters.

Characters should remember:

- what happened to them
- what they did
- who helped them
- who used them
- what they believe is true
- what they are wrong about
- what they owe
- what they resent
- what they are trying not to become

Memory should affect future interpretation, action, trust, and escalation.

### 4. Attention

Attention decides what reaches the player.

This is a first-class game system, not just UI behavior.

For any event or decision point, the system should decide whether it becomes:

- `silent`
  - handled locally, memory only
- `ambient`
  - visible in history/logs, no direct player ask
- `digest`
  - bundled into a later summary
- `message`
  - surfaced in the inbox / attention feed
- `interrupt`
  - immediate direct escalation to the player

The inbox is therefore a derived artifact of attention decisions.

## Clean Loop

The canonical game loop is:

1. The world advances.
2. Each character perceives only part of what changed.
3. That perception is filtered through personality and memory.
4. The character decides how to act.
5. The character decides whether the player needs to know.
6. The world resolves outcomes.
7. Memory updates.
8. Player-facing notifications are produced when attention rules say they should be.

## Escalation Logic

A character should not surface everything.

Escalation should consider:

- stakes
- reversibility
- confidence
- novelty
- fit with standing instincts
- threat to coherence
- relationship to the player
- whether another actor or rival network is likely to move first

Different characters should escalate differently.

Examples:

- Ivo escalates when leverage, structural access, or hidden cost is at stake.
- Sia escalates when meaning, authorship, or signal is at stake.
- Ren escalates when timing, status, or allegiance is slipping.
- Vale escalates when weak signals may become destiny.

## Design Consequences

These should stay true as the game evolves:

- The world changes independently.
- Characters are not omniscient.
- Memory meaningfully shapes future behavior.
- The player shapes personalities and thresholds more than individual micro-actions.
- The inbox is a projection of simulation state, not the source of truth.
- Notifications are characterful and strategic, not generic system alerts.

## Canonical Domain Shape

At a minimum, the simulation should converge on these canonical concepts:

- `CityState`
- `CharacterState`
- `MemoryState`
- `RelationshipState`
- `AttentionPolicy`
- `EscalationDecision`
- `PlayerNotification`
- `SimulationTick`

## Working Rule

When making architecture or content decisions, prefer the option that makes the game more like:

- a living city simulation
- semi-autonomous selves with identity
- remembered consequences
- selective, characterful escalation

And less like:

- a task manager
- a static event deck
- a pure UI shell
- a system where the inbox is the whole game

## Update Rule

Update this document whenever one of these changes:

- what the simulation fundamentally models
- what characters fundamentally are
- what memory fundamentally does
- what qualifies for escalation to the player
- what the canonical loop is
