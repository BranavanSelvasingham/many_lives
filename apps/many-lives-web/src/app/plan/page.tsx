import type { Metadata } from "next";
import Link from "next/link";

import styles from "./plan.module.css";

const commandStatement =
  "Advance Many Lives one verifiable step toward a seeded living-world simulation: authored data seeds the city, objective predicates define desired outcomes, the world exposes legal current-state actions, Rowan's planner chooses among those actions through a visible LLM/planner reasoning callback with next uncertainty, the simulator validates consequences, Rowan carries the validated task forward without watch-mode approval clicks, the visual map renders only legal routed movement, and independent NPCs, jobs, problems, and city events continue evolving whether Rowan acts on them or not.";

const authorityChain = [
  "Seed data creates the initial world: map, places, NPCs, jobs, problems, events, schedules, memories, and objective definitions.",
  "Time advances the world: NPCs move, jobs open or close, problems escalate or resolve, city events start and end.",
  "Objectives define desired-state predicates: outcomes, blockers, evidence, urgency, and completion checks.",
  "The simulator exposes legal actions from current state.",
  "Rowan's planner chooses from legal actions using current world pressure, objective predicates, memory, location, energy, money, conversations, jobs, problems, and schedules.",
  "The planner or LLM returns a player-facing decision artifact: situation summary, current objective and constraints, options considered, selected action, rejected-action reasons, concise rationale, and trace-backed next uncertainty or next check when the trace can truthfully support one.",
  "The simulator validates and applies the chosen action.",
  "The renderer projects the validated state through the visual map; movement follows legal routed paths.",
  "Browser probes and tests expose the chain so it can be audited.",
];

const obligations = [
  {
    evidence: "Source audit and sim tests",
    pass: "Completion comes from predicate outcomes, blockers, evidence, and urgency; trail state is explanatory only.",
    title: "Objectives Are Desired Outcomes",
  },
  {
    evidence: "Planner trace and sim tests",
    pass: "The selected action appears in the current legal action surface or as a validated legal move.",
    title: "Rowan Chooses Legal Actions",
  },
  {
    evidence: "Poisoned route and stale trail regressions",
    pass: "Wrong, stale, impossible, or lower-priority route hints cannot control the chosen action.",
    title: "Seeded Hints Cannot Override Live State",
  },
  {
    evidence: "Rail/notebook UI, planner trace, and browser artifacts",
    pass: "Before or during each meaningful autonomous action, the player sees Rowan's current objective, relevant constraints, considered options or rejected reasons, selected action, concise rationale, and trace-backed next uncertainty without raw prompts, hidden chain-of-thought, or backend-shaped internals.",
    title: "Rowan's Reasoning Is Visible",
  },
  {
    evidence: "Time-advance tests and browser probe world pressure",
    pass: "NPC schedules, job windows, problems, and city events mutate while Rowan does unrelated work or waits.",
    title: "The World Changes Without Rowan",
  },
  {
    evidence: "Browser route diagnostics and screenshots",
    pass: "Rowan and sampled NPC paths follow projected walkable graph routes or approved same-tile approach points.",
    title: "Movement Reflects The Map",
  },
  {
    evidence: "Browser probe and regression artifacts",
    pass: "Probe exposes predicates, planner trace, visible decision artifact, route legality, NPC diagnostics, and world pressure.",
    title: "The Loop Is Auditable",
  },
];

const executionLoop = [
  "Orient: read the required docs, check git status, and identify the touched authority layer.",
  "Plan: name the exact authority gap and the regression that would fail if scripted routing returns.",
  "Expose: show the player-facing reasoning callback for Rowan's next meaningful action with trace-backed next uncertainty or next check before or while watch mode carries it out.",
  "Act: make the narrowest change while keeping seeded content as data and simulator validation authoritative.",
  "Verify: run the narrowest sufficient commands, broadening to the full harness for gameplay, routing, or sim changes.",
  "Inspect: review browser output or screenshots for visual and gameplay claims.",
  "Repair: fix failures and rerun the relevant checks.",
  "Report: summarize behavior, evidence, and remaining hardcoded-control risk.",
];

const priorityPath = [
  "Objective predicates: every objective has desired state, blockers, urgency, evidence, and completion evaluators.",
  "Legal action planner: Rowan ranks legal current-state actions and emits a trace with considered, selected, and rejected options.",
  "Reasoning callback: Rowan's next decision appears as a readable planner/LLM-backed rationale with objective, constraints, options, rejected reasons, selected action, and next uncertainty, with model output kept advisory until simulator validation.",
  "Short-horizon follow-through: Rowan can form a small plan and state what he will check next, but every step is still validated one action at a time by the simulator.",
  "Independent world pressure: NPC schedules, job windows, problem escalation, and city events keep evolving while Rowan waits or does unrelated work.",
  "Spatial authority: Rowan and NPC rendering route through the same projected walkable map graph.",
  "Adversarial regression coverage: stale hints, poisoned trails, blocked routes, impossible anchors, missed jobs, and ignored problems fail loudly.",
  "Player readability and delight: the UI explains why Rowan moved or waited without turning the game into a debug dashboard.",
];

const acceptanceCriteria = [
  "A poisoned objective trail cannot make Rowan follow the wrong route or skip live objective state.",
  "An objective can complete from desired-state predicates even when route hints are absent, stale, or wrong.",
  "Rowan's selected action is traceable to current legal actions, current world pressure, and objective predicates.",
  "Rowan's selected action is accompanied by a user-visible decision artifact with objective, constraints, options, rejected reasons, concise rationale, chosen next action, and trace-backed next uncertainty.",
  "Time advancement mutates NPC locations, job availability, city events, and at least one problem independently of Rowan's route.",
  "Browser diagnostics expose objective predicates, planner trace, visible decision artifact, world pressure, Rowan route legality, and NPC route legality.",
  "Rowan and sampled NPCs render on legal routed paths through the projected walkable map.",
  "A fresh autoplay run reads as Rowan finding his way in a living city, not replaying a fixed route.",
  "Observe/autoplay mode carries the run without visible progression/action-button clicks.",
];

const turnPlanShape = [
  {
    body: "Name the exact place where seeded content, objective trails, authored anchors, or UI playback still has more authority than the simulator and planner.",
    title: "Authority gap",
  },
  {
    body: "State whether Rowan's next meaningful action has a player-facing callback with objective, constraints, legal current-state actions, selected and rejected options, rationale, trace-backed next uncertainty or next check, simulator validation, and short-horizon follow-through.",
    title: "Reasoning visibility",
  },
  {
    body: "List only the files that prove or change that layer. Start with the operating manual, then objective, planner, world evolution, routing, probe, or test files as needed.",
    title: "Files to inspect",
  },
  {
    body: "Add or name the poisoned case that would fail if route-following returns: stale objective trail, impossible hint, blocked route, missed job window, ignored problem, or unsnapped anchor.",
    title: "Adversarial proof",
  },
  {
    body: "Run the narrowest sufficient commands and inspect browser/screenshot evidence or probe artifacts before claiming gameplay, map, or living-world behavior.",
    title: "Validation evidence",
  },
];

const validationCommands = [
  "corepack pnpm lint",
  "corepack pnpm --filter @many-lives/many-lives-web build",
  "corepack pnpm visual:game",
  "corepack pnpm test",
];

export const metadata: Metadata = {
  description:
    "The Many Lives living-world simulation plan, authority chain, acceptance criteria, and verification loop.",
  title: "Many Lives /plan",
};

export default function PlanPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <nav aria-label="Plan navigation" className={styles.nav}>
            <Link href="/?new=1">Fresh autoplay run</Link>
            <Link href="/">Street app</Link>
            <a href="/sim/health">Sim health</a>
          </nav>
          <p className={styles.kicker}>Many Lives /plan</p>
          <h1>Living-world simulation authority plan</h1>
          <p className={styles.lede}>
            The root problem is authority. Authored content must seed the world,
            but it must not drive Rowan like a fixed path. Rowan should be an
            embodied agent making state-grounded choices in a city that keeps
            changing without him.
          </p>
        </header>

        <section className={styles.commandPanel} aria-labelledby="command-title">
          <div>
            <p className={styles.kicker}>Command statement</p>
            <h2 id="command-title">Use this when work starts on this path.</h2>
          </div>
          <p>{commandStatement}</p>
        </section>

        <section className={styles.section} aria-labelledby="authority-title">
          <div className={styles.sectionHeader}>
            <p className={styles.kicker}>Do not invert this</p>
            <h2 id="authority-title">Authority Chain</h2>
          </div>
          <ol className={styles.authorityList}>
            {authorityChain.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="obligations-title">
          <div className={styles.sectionHeader}>
            <p className={styles.kicker}>Evidence ledger</p>
            <h2 id="obligations-title">Obligations</h2>
          </div>
          <div className={styles.obligationGrid}>
            {obligations.map((obligation) => (
              <article className={styles.obligation} key={obligation.title}>
                <h3>{obligation.title}</h3>
                <dl>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{obligation.evidence}</dd>
                  </div>
                  <div>
                    <dt>Pass condition</dt>
                    <dd>{obligation.pass}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.twoColumn}>
          <section className={styles.section} aria-labelledby="loop-title">
            <div className={styles.sectionHeader}>
              <p className={styles.kicker}>How to execute</p>
              <h2 id="loop-title">Goal Loop</h2>
            </div>
            <ol className={styles.compactList}>
              {executionLoop.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>

          <section className={styles.section} aria-labelledby="priority-title">
            <div className={styles.sectionHeader}>
              <p className={styles.kicker}>Build order</p>
              <h2 id="priority-title">Priority Path</h2>
            </div>
            <ol className={styles.compactList}>
              {priorityPath.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        </div>

        <section className={styles.section} aria-labelledby="acceptance-title">
          <div className={styles.sectionHeader}>
            <p className={styles.kicker}>Definition of reached</p>
            <h2 id="acceptance-title">Acceptance Criteria</h2>
          </div>
          <ul className={styles.checkList}>
            {acceptanceCriteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="turn-plan-title">
          <div className={styles.sectionHeader}>
            <p className={styles.kicker}>Next build loop</p>
            <h2 id="turn-plan-title">Every `/plan` Response Must Include</h2>
          </div>
          <div className={styles.turnPlanGrid}>
            {turnPlanShape.map((item) => (
              <article className={styles.turnPlanItem} key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="validation-title">
          <div className={styles.sectionHeader}>
            <p className={styles.kicker}>Required checks</p>
            <h2 id="validation-title">Validation</h2>
          </div>
          <div className={styles.commandGrid}>
            {validationCommands.map((command) => (
              <code key={command}>{command}</code>
            ))}
          </div>
          <p className={styles.note}>
            For visual or gameplay changes, inspect generated screenshots or
            browser output before reporting success.
          </p>
        </section>
      </div>
    </main>
  );
}
