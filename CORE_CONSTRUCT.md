# Many Lives Core Construct

This is a living design document. It should stay lightweight, current, and close to the actual build.

When implementation details drift, this document is the reference point for what the game is trying to be.

## Current Direction

Many Lives is now centered on a single embodied character in one living city.

The game starts small and concrete:

- find your way around
- find work
- find people
- find somewhere safe to return to
- find a problem worth solving

The older multi-self version is not the current foundation.

It may return later, but only after the single-character city simulation is genuinely fun on its own.

## Core Fantasy

The core fantasy is:

**Find your way in a living city.**

The player should not begin as someone important.

They should begin as someone new, uncertain, and limited:

- they do not know the streets yet
- they do not know who matters
- they do not yet have stable work
- they do not know which local problems are real
- the city does not care about them yet

The early emotional arc is orientation, not dominance.

Importance should emerge later from:

- reliability
- local knowledge
- remembered actions
- trust
- reputation
- solving real problems for real people

## Core Systems

The game currently has 4 primary systems.

### 1. World

The world is a living city presented as a top-down 2D space.

The visual target is:

- readable like an older game
- systemic like a modern sim
- spatially legible
- grounded enough that place matters

The world should contain:

- neighborhoods
- streets and interiors
- homes, shops, job sites, and public places
- NPCs with schedules
- local institutions and factions
- jobs
- shortages
- rumors
- recurring problems
- world states that change with time

The world must keep moving even when the player does nothing.

That movement should be tangible and local:

- a shop closes
- a shift starts
- a person leaves for work
- a rumor reaches a district
- a gate opens or locks
- someone else solves a problem first

The world should not feel like a static quest board.

### 2. Character

The player controls one character directly.

The character needs a simple, grounded state:

- location
- money
- energy
- inventory
- known places
- known people
- skills or capabilities
- current obligations
- reputation

The character should feel limited at first.

The player is not shaping a dashboard policy system first.

The player is moving a person through streets, doors, work, and social situations.

### 3. Memory

Memory is what gives the character and the city continuity.

The player character should remember:

- where places are
- who said what
- what jobs paid well
- who can be trusted
- what went wrong
- what was promised
- what is still unresolved

The world should remember too.

NPCs, groups, and places should remember:

- whether you showed up
- whether you were useful
- whether you caused trouble
- whether you solved something
- whether you can be relied on

Memory should unlock future play.

It should change:

- dialogue
- prices
- access
- jobs offered
- trust
- who asks for help
- which problems become visible

### 4. Embodiment

Embodiment means the player is in the city, not above it.

This is critical.

The game should be about physically being somewhere:

- walking to a place
- arriving too early or too late
- seeing who is there
- noticing what changed
- choosing whether to enter, wait, leave, or talk

Distance and time should matter.

Knowledge should often come from presence, not from abstract menus.

If a job, problem, or person matters, the player should usually have to go there.

## Clean Loop

The canonical game loop is:

1. Wake up or step into the city.
2. Move through the map.
3. Notice places, people, work, and trouble.
4. Choose where to go and what to do.
5. Spend time, money, and energy.
6. The world advances.
7. Memory and reputation update.
8. New jobs, relationships, and problems become available.

This loop should work before any larger narrative layer is added.

## Early-Game Priorities

The first playable version should emphasize:

- movement that feels good enough to explore with
- a small but believable district
- a few NPCs with routines
- simple jobs
- simple needs
- a few small problems that can be solved in different ways
- clear consequences for lateness, helpfulness, and curiosity

At the beginning, the player should be asking:

- Where can I sleep?
- Who is hiring?
- What is this neighborhood like?
- Who seems trustworthy?
- What happened here?
- Is there a better use of my time today?

Not:

- How do I optimize a complex meta-system?
- Which grand strategy path should I take?
- How do I coordinate multiple selves?

## Design Consequences

These should stay true as the game evolves:

- start grounded, not grandiose
- one body in one place is enough for now
- movement through the city is core gameplay, not decoration
- early problems should be local and understandable
- the world should reveal itself through presence
- memory should matter quickly
- trust and familiarity should be valuable rewards
- larger stakes should emerge from repeated local play

## Canonical Domain Shape

At a minimum, the simulation should converge on these canonical concepts:

- `WorldState`
- `CityMap`
- `LocationState`
- `CharacterState`
- `NpcState`
- `MemoryState`
- `ReputationState`
- `ScheduleState`
- `JobState`
- `ProblemState`
- `InteractionState`
- `SimulationTick`

## Working Rule

When making architecture or content decisions, prefer the option that makes the game more like:

- a living top-down city sim
- one character finding their footing
- local work, local people, local problems
- remembered consequences
- knowledge earned by going places

And less like:

- a dashboard-first strategy game
- multi-agent coordination too early
- a task manager
- a static quest list
- a game that starts abstract before it becomes human

## Update Rule

Update this document whenever one of these changes:

- what the world fundamentally simulates
- what the player character fundamentally is
- what memory fundamentally does
- what the map and embodiment layer fundamentally require
- what the canonical loop is
