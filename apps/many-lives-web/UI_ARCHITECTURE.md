# UI Architecture

## Attention Stack

Many Lives is built around an attention stack, not a conversation log.

- The center inbox answers: what needs my attention now?
- The left rail answers: who is under pressure?
- The right panel answers: what am I deciding or tuning?
- The bottom strip answers: what is the world doing while I look away?

## Panel Responsibilities

- `AppShell` composes the desktop-first dashboard layout.
- `CharacterList` and `CharacterCard` surface quick status, urgency, and obligations for Jordan, Maya, and Leo.
- `InboxPanel` owns tabs, filtering, and the attention-feed cards.
- `MessageDetailPanel` handles high-context decisions, consequences, snoozing, delegating, and rule handoff.
- `CharacterDetailView` shows the selected life in plain language.
- `PolicyPanel` and `RuleComposer` handle standing direction and interruption-driven rule authoring.
- `TimelineStrip` and `RiskSummary` keep time, risks, and pressure visible at all times.

## Server State Vs UI State

Server state lives in TanStack Query:

- create game
- fetch game state
- tick time
- resolve inbox commands
- update policy

Local UI state lives in a tiny Zustand store:

- selected character
- selected message
- active inbox tab
- right panel mode
- override text draft
- rule composer draft

The app does not mirror the full backend world into local component state.

## Why Inbox, Policy, And Timeline Are Separate

- Inbox is short-horizon triage and intervention.
- Policy is long-horizon behavior shaping.
- Timeline is world awareness and pacing control.

Keeping these separate helps the prototype test the real game question: is managing attention across multiple semi-autonomous lives actually fun?

## Mock Fallback

The client is usable without the sim server.

- `mockData.ts` seeds a normalized Many Lives world snapshot.
- API helpers try the backend first.
- On failure, the app mutates local mock state through the same UI contract.

This keeps the prototype alive in demos, browser sharing, and UI iteration sessions where the backend is unavailable.
