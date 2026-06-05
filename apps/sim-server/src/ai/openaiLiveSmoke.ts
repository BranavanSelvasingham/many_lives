import assert from "node:assert/strict";
import { loadLocalEnvFiles } from "./localEnv.js";
import { OpenAIProvider } from "./openaiProvider.js";
import type { StreetPlanningRequest } from "./provider.js";
import { seedStreetGame } from "../street-sim/seedGame.js";

loadLocalEnvFiles();

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  assert.ok(
    apiKey,
    "OPENAI_API_KEY is required. Add it to the shell env or local .env before running live:openai.",
  );

  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const provider = new OpenAIProvider({
    apiKey,
    model,
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 12_000),
  });
  const request = buildPlanningRequest();
  const result = await provider.planStreetNextAction(request);
  const plannerCall = provider
    .getCallLog()
    .find((entry) => entry.task === "planStreetNextAction");

  assert.ok(plannerCall, "OpenAI provider did not record a planner call.");
  assert.equal(
    plannerCall.status,
    "success",
    `OpenAI planner did not complete successfully: ${plannerCall.status}${plannerCall.error ? ` (${plannerCall.error})` : ""}`,
  );
  assert.ok(result, "OpenAI planner returned no usable action.");
  assert.ok(
    request.allowedActions.some((action) => action.actionId === result.actionId),
    `OpenAI planner returned an action outside the allowed action surface: ${result.actionId}`,
  );
  assert.ok(
    Number.isFinite(result.confidence) &&
      result.confidence >= 0 &&
      result.confidence <= 1,
    `OpenAI planner returned invalid confidence: ${result.confidence}`,
  );
  assert.ok(
    result.rationale.length > 8,
    "OpenAI planner rationale was too short to audit.",
  );

  process.stdout.write(
    [
      "[many-lives] OpenAI live smoke passed.",
      `model=${plannerCall.model}`,
      `task=${plannerCall.task}`,
      `status=${plannerCall.status}`,
      `durationMs=${plannerCall.durationMs}`,
      `selectedAction=${result.actionId}`,
      `confidence=${result.confidence.toFixed(2)}`,
      `rationale=${result.rationale}`,
      "",
    ].join("\n"),
  );
}

function buildPlanningRequest(): StreetPlanningRequest {
  const game = seedStreetGame(`openai-live-smoke-${Date.now()}`);
  return {
    allowedActions: [
      {
        actionId: "talk:npc-mara",
        description: "Ask Mara how tonight's room works.",
        kind: "talk",
        label: "Talk to Mara",
        npcId: "npc-mara",
        planKey: "live-smoke|talk:npc-mara|boarding-house|npc-mara",
        targetLocationId: "boarding-house",
      },
      {
        actionId: "move:tea-house",
        description: "Walk to Kettle & Lamp to ask Ada about paid lunch work.",
        kind: "move",
        label: "Head to Kettle & Lamp",
        planKey: "live-smoke|move:tea-house|tea-house",
        targetLocationId: "tea-house",
      },
      {
        actionId: "wait:15",
        description: "Wait fifteen minutes and watch the block change.",
        kind: "wait",
        label: "Wait briefly",
        planKey: "live-smoke|wait:15",
      },
    ],
    desiredOutcomes: [
      {
        id: "room-secured",
        label: "Know how to keep tonight's room at Morrow House.",
        priority: 9,
        status: "open",
        targetLocationId: "boarding-house",
      },
      {
        id: "paid-work",
        label: "Find a credible path to paid work before the lunch window closes.",
        priority: 8,
        status: "open",
        targetLocationId: "tea-house",
      },
    ],
    game,
    objective: {
      focus: "settle",
      routeKey: "first-afternoon",
      text: "Make Rowan's first afternoon count: understand the room, earn a little money, and end with a real foothold.",
    },
  };
}

void main().catch((error) => {
  process.stderr.write(
    `[many-lives] OpenAI live smoke failed: ${error.stack ?? error.message}\n`,
  );
  process.exit(1);
});
