# Many Lives: First Morning Fun Plan

## Purpose

Use this plan to steer Many Lives toward a more fun, visually appealing first 3 to 5 minutes without abandoning the current core construct.

The important decision:

**Many Lives is the main container.** Do not spin up a separate DioramaBench app right now. Make Many Lives feel like a charming living miniature city first, and let the agent-evaluation / benchmark ideas become the hidden spine later.

## North Star

**A tiny living city where Rowan learns the streets, people, work, trust, and consequences by physically being there.**

The player should feel:

- "I want to watch this little place keep moving."
- "Rowan seems like a person in a town, not a task runner."
- "I can understand what he thinks, where he is going, and why."
- "I can watch Rowan reason through the next decision, then carry it out."
- "The city has small surprises worth noticing."

## Public Pitch

**Many Lives:** a charming top-down city sim where an AI character finds his footing in a living neighborhood, remembers what happens, and becomes known through local work, choices, and relationships.

## Hidden Technical Wedge

Under the fun surface, Many Lives can become an inspectable human-agent collaboration environment:

- memory and stale belief tracking;
- grounded report-back;
- interruption and correction;
- agent intention visibility;
- LLM/planner reasoning callbacks that explain options and selected actions;
- world-state evidence;
- trust and reputation effects.

Do not lead with the benchmark. Lead with the living city.

## First Slice

Build a delightful **South Quay first morning** vertical slice.

The slice starts with Rowan at Morrow House and ends when he has learned whether Kettle & Lamp has lunch work.

### Goal Loop Objective

Help Rowan turn Mara's local lead into grounded knowledge by physically moving through South Quay, finding Ada at Kettle & Lamp, asking directly about lunch work, and recording what changed because he was there.

Good objective text:

> Verify Mara's lead by walking to Kettle & Lamp, asking Ada about lunch work, and recording what Rowan learns.

The loop is complete when Rowan has reached Kettle & Lamp, spoken to Ada, learned whether lunch work is available, created a field note with evidence, and opened at least one next action from that knowledge.

The loop should also expose Rowan's reasoning at each meaningful decision. A
viewer should see the current objective, the important constraints, the options
Rowan is considering, the selected next action, and why the validated action is
worth doing now.

### Core Beat

1. Rowan starts at Morrow House.
2. Mara gives him a clear local lead: talk to Ada at Kettle & Lamp.
3. Rowan walks through South Quay.
4. The city shows 2-3 small ambient events while he moves.
5. Rowan reaches Kettle & Lamp and asks about lunch work.
6. Ada gives him a concrete answer.
7. Rowan records a small field note: what he learned, who helped, and what he should do next.

## Make It Fun

### Visual Joy

Add delight through small, legible city behaviors:

- cafe awning lights or warm window flicker;
- dock cart or crate movement;
- ferry bell, gull-shadow, or water shimmer;
- shop opening state;
- one tiny passerby routine;
- Rowan turning toward landmarks before walking;
- conversation bubbles that feel like overheard town life.

The point is not more UI. The point is a town that feels like it is quietly alive.

### Rowan's Notebook

Clicking Rowan should reveal a compact notebook-style panel:

- current belief: "Mara says Ada may need lunch help."
- current plan: "Walk to Kettle & Lamp."
- confidence: "Unconfirmed."
- remembered clue: "Morrow House is safe to return to."
- next uncertainty: "Does Ada actually need help today?"

This makes the agent legible without making the app feel like a dashboard.

### Rowan's Reasoning Callback

Before a meaningful autonomous action, the rail or notebook should show a
compact decision callback:

- objective: "Verify Mara's lead before lunch gets busy."
- known facts: "Mara trusts Ada's read of the room. Rowan has enough energy to walk."
- options: "Ask more at Morrow House, walk to Kettle & Lamp, or wait."
- choice: "Walk to Kettle & Lamp."
- rejected: "Waiting risks missing the lunch window."

This should be a concise game-facing rationale generated from the planner/LLM
callback and simulator validation. It should not expose raw prompts, hidden
chain-of-thought, or backend diagnostic fields.

### Field Note Ending

At the end of the first beat, show a stamped or notebook-like summary:

- Learned: "Ada needs one extra pair of hands before lunch."
- Evidence: "Asked Ada at Kettle & Lamp at 11:20."
- Next: "Return after checking the dock board, or start the lunch shift now."
- Memory created: "Ada remembers Rowan asked directly."

This is the fun version of grounded report-back.

## Implementation Order

### Step 1: Make The Route Feel Alive

Goal: Rowan walking from Morrow House to Kettle & Lamp should be readable and pleasant to watch.

Work:

- ensure the camera frames Rowan and destination clearly;
- make Rowan's objective visible in plain language;
- add a small route/intent cue before movement;
- avoid the rail covering the important map moment.

Validation:

- run a fresh `/?new=1&autoplay=1`;
- watch the first minute;
- inspect desktop screenshot;
- confirm a new viewer understands where Rowan is going and why.

### Step 2: Add Three Ambient City Events

Goal: South Quay should feel alive before the user touches anything.

Work:

- one cafe event;
- one dock event;
- one passerby or town-square event.

Keep them tiny. They should support the first route, not distract from it.

Validation:

- visual smoke screenshot should show at least one recognizable event state;
- autoplay should still feel grounded, not scripted.

### Step 3: Add Rowan's Notebook

Goal: expose Rowan's belief and plan as a charming artifact.

Work:

- notebook opens from Rowan or the Mind tab;
- show belief, plan, confidence, and next uncertainty;
- update after Mara's lead and after Ada's answer.

Validation:

- user can answer: "What does Rowan think is true right now?"
- no raw debug labels or backend-shaped terms appear in the notebook.

### Step 4: Show Rowan's Decision Callback

Goal: make the player able to watch Rowan decide what to do next.

Work:

- show a compact reasoning callback before meaningful actions;
- include objective, constraints, considered options, selected action, and a
  short rationale;
- make the callback update as Rowan learns new facts;
- keep autoplay/observe moving without requiring a next-action click.

Validation:

- user can answer: "Why did Rowan choose that next action?"
- observe/autoplay has zero visible progression/action clicks;
- the rationale is grounded in current legal actions and simulator validation.

### Step 5: Add The Field Note

Goal: end the first beat with a satisfying artifact.

Work:

- after Ada answers, create a field note / journal entry;
- include learned fact, evidence, next step, and memory consequence;
- make it visually distinct from ordinary chat.

Validation:

- user can verify the note against what happened on screen;
- note feels like Rowan's lived memory, not a system summary.

## Non-Goals

Do not do these in the first pass:

- do not add multi-agent orchestration;
- do not build a separate benchmark UI;
- do not add Vision Pro or 3D;
- do not add long procedural generation;
- do not make the rail more complex;
- do not turn notebook state into a developer trace panel.

## Success Criteria

The first morning slice is working when:

- the first 3 minutes are understandable without explanation;
- Rowan has a visible reason to move;
- Rowan's reasoning for the next action is visible and grounded;
- observe/autoplay carries Rowan forward without requiring action-button clicks;
- the town does at least 2 charming things on its own;
- clicking Rowan answers what he believes and plans;
- the ending field note feels earned;
- a viewer says, "I want to see what happens next."

## Validation Commands

For visual/gameplay changes:

```bash
corepack pnpm visual:game
```

For TypeScript or route changes:

```bash
corepack pnpm lint
```

For broader gameplay or sim behavior changes:

```bash
corepack pnpm test
```

Also inspect screenshots or the browser manually. A passing command is not enough for vibe work.

## Prompt For A New Codex Chat

Use this prompt in a fresh Codex thread inside the `many_lives` repo:

```text
Read AGENTS.md, CORE_CONSTRUCT.md, docs/street/runtime-operating-manual.md, and docs/street/first-morning-fun-plan.md.

Goal: make the current Many Lives street app more fun and visually appealing by implementing the first small step of the South Quay first morning slice.

Do not create a separate DioramaBench app. Many Lives is the container. The benchmark/eval ideas are hidden spine only.

Start with Step 1 from first-morning-fun-plan.md: make Rowan's route from Morrow House to Kettle & Lamp feel alive, legible, and pleasant to watch. Keep the change narrow. Preserve the current core construct: one embodied character finding his way in a living city.

After implementation, validate with the narrowest sufficient checks, including browser/screenshot inspection for visual work.
```
