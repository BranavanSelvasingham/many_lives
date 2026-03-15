# UI Architecture

## Attention Stack

Many Lives is organized around attention pressure rather than chat.

- Left rail answers: who is strained right now?
- Center panel answers: what needs a decision now?
- Right panel answers: what am I deciding or tuning?
- Bottom strip answers: what is the world doing while I look away?

## Panel Responsibilities

- `AppShell` composes the full dashboard and coordinates selection.
- `CharacterList` and `CharacterCard` provide quick triage of Jordan, Maya, and Leo.
- `InboxPanel` owns tabs, filtering, and the card-based attention feed.
- `MessageDetailPanel` is the deep decision surface with visible consequences, overrides, snooze, delegate, and rule handoff.
- `CharacterDetailView` summarizes the selected life in plain language.
- `PolicyPanel` and `RuleComposer` translate standing direction into readable policy controls.
- `TimelineStrip` and `RiskSummary` keep time, obligations, thread count, and global risk visible.

## State Model

Server state comes from TanStack Query:

- create game
- fetch game state
- tick time
- resolve commands
- update policy

Local UI state stays in a lightweight Zustand store:

- selected character
- selected message
- active inbox tab
- right panel mode
- override draft
- rule composer draft

The client does not mirror the entire backend world into local state.

## Why Inbox, Policy, And Timeline Are Separate

- Inbox is short-horizon triage.
- Policy is long-horizon behavior shaping.
- Timeline is world awareness and pacing control.

Keeping them separate makes the game about attention management instead of conversation reading.

## Mock Fallback

- The preferred path is the sim server on `http://127.0.0.1:3000`.
- The web client talks to it through the Next.js `/sim/*` proxy.
- If requests fail, `mockData.ts` supplies a seeded playable state and local mutations for ticking, message resolution, delegation, snoozing, and policy edits.
- This keeps demos and browser testing alive even when the backend is down.
