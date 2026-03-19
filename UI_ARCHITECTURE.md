# UI Architecture

## Attention Stack Model

Many Lives is organized around attention pressure rather than conversation.

- Left rail answers: who is carrying unstable pressure right now?
- Center panel answers: what needs intervention, acknowledgment, or review?
- Right panel answers: what single context am I actively deciding or tuning?
- Bottom strip answers: what is the world doing while I look away?

The shell is intentionally fixed-height and desktop-first so the player reads the game like a control board instead of a scrolling document.

## Panel Responsibilities

- `AppShell` owns dashboard composition, startup, and derived right-panel priority.
- `LeftRail` presents the playable lives and a compact pressure read.
- `InboxPanel` owns the attention feed, tab counts, filtered empty states, and thread selection.
- `MessageDetailPanel` is the decision-first surface: body, consequence scan, suggested actions, secondary controls, rule training, and override send.
- `CharacterDetailView` keeps the selected life legible in plain language.
- `PolicyPanel` exposes standing direction with human-readable controls instead of backend jargon.
- `TimelineStrip` keeps pacing visible with time, urgent count, thread count, upcoming obligation, risk, and tick controls.

## Right-Panel Priority Logic

The right panel intentionally shows one context at a time.

1. If a message is selected, show `MessageDetailPanel`.
2. Else if a character is selected, show `CharacterDetailView` plus `PolicyPanel`.
3. Else default to the first urgent message, otherwise the first character.

This keeps the player focused on the current intervention surface instead of mixing unrelated contexts.

## Selection Model

Selection is local UI state in Zustand.

- Selecting a message immediately opens its detail panel.
- Selecting a character updates character focus, but does not forcibly hide an already selected message.
- Closing a message returns the right panel to character management.
- Tab changes filter the center panel without destroying the current message selection.
- Initial load chooses the first urgent message when one exists; otherwise it lands on the first character.

This makes the inbox feel like the heartbeat without making character management disappear.

## Server State vs Local UI State

TanStack Query owns world data and mutations:

- create game
- fetch state
- tick time
- resolve a thread
- snooze or delegate
- save policy

Zustand owns local UI concerns only:

- selected character
- selected message
- active inbox tab
- rule composer visibility
- override text
- rule draft text

This separation keeps the mock path and backend path aligned.

## Mock Mode Behavior

Mock mode is an official development and demo mode, not an emergency fallback.

- `gameApi.ts` attempts backend calls first.
- If requests fail, the client switches to the seeded local state from `mockData.ts`.
- The mock seed is structured to feel playable immediately, with multiple characters already under pressure.
- Mock mutations support the full local loop: resolve, snooze, delegate, tick time, and policy updates.
- Mock mode is surfaced in the UI with a visible but restrained indicator.

Because the same panel model works in both modes, design discussion can happen before deeper simulation work is finished.

## Rule Training Flow

The lightweight rule composer is intentionally small.

- It opens from the message detail view.
- It pre-fills from the current message context.
- It saves into a readable rule summary on the relevant character policy.
- It is meant to suggest the feeling of training autonomy over time, not to expose a full rule engine.

## Why This Prototype Is Web-First

This iteration is meant to answer interaction questions quickly:

- Is inbox triage readable?
- Do right-panel decisions feel fast?
- Do policies feel like life management instead of admin forms?
- Can mock mode carry demos even without a running sim?

The web client is the fastest place to answer those questions, which is why this prototype now treats the browser shell as the primary surface rather than a temporary replacement for another client.
