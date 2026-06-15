import type {
  RowanAutonomyState,
  StreetGameState,
} from "../street-sim/types.js";
import {
  buildRowanBeliefs,
  buildRowanNeeds,
  confidenceAdjective,
  confidenceLabel,
  needStatusLabel,
  selectNotebookBelief,
  selectNotebookNeed,
  uncertaintyForNeed,
} from "./rowanCognitionModel.js";
import type {
  RowanCognition,
  RowanNextMove,
} from "./rowanCognitionModel.js";
import {
  rowanNotebookClueText,
  rowanNotebookConfidenceText,
  rowanNotebookPlanText,
  rowanNotebookUncertaintyForBelief,
} from "./rowanCognitionNarratives.js";

export type {
  RowanBelief,
  RowanBeliefConfidence,
  RowanCognition,
  RowanNeed,
  RowanNeedKey,
  RowanNeedStatus,
  RowanNextMove,
} from "./rowanCognitionModel.js";

export function buildRowanCognition(world: StreetGameState): RowanCognition {
  const needs = buildRowanNeeds(world);
  const beliefs = buildRowanBeliefs(world);
  const nextMove = buildRowanNextMove(world);

  return {
    primaryNeed: needs[0],
    needs,
    beliefs,
    nextMove,
  };
}

export function buildRowanCognitionState(
  world: StreetGameState,
): NonNullable<StreetGameState["rowanCognition"]> {
  const cognition = buildRowanCognition(world);
  const primaryNeed = cognition.primaryNeed;
  const currentBelief = selectNotebookBelief(world, cognition);
  const notebookNeed =
    selectNotebookNeed(world, cognition, currentBelief) ?? primaryNeed;
  const nextMove = cognition.nextMove;
  const notebook = {
    authority: {
      beliefConfidence: currentBelief?.confidence,
      beliefId: currentBelief?.id,
      beliefSource: currentBelief?.source,
      nextMoveActionId: nextMove?.actionId,
      nextMoveNpcId: nextMove?.npcId,
      nextMoveRationale: nextMove?.rationale,
      nextMoveTargetLocationId: nextMove?.targetLocationId,
      notebookNeedKey: notebookNeed?.key,
      primaryNeedKey: primaryNeed?.key,
    },
    belief:
      currentBelief?.text ??
      primaryNeed?.reason ??
      "South Quay is still mostly unknown, and Rowan needs one reliable person to ask.",
    clue:
      rowanNotebookClueText(world, currentBelief) ??
      (currentBelief
        ? `${currentBelief.source} made this feel ${confidenceAdjective(
            currentBelief.confidence,
          )}.`
        : primaryNeed
          ? `The strongest pressure right now is ${primaryNeed.label.toLowerCase()}.`
          : "The room at Morrow House is safe for tonight, but not a future by itself."),
    confidence:
      rowanNotebookConfidenceText(world, currentBelief) ??
      (currentBelief
        ? `${confidenceLabel(currentBelief.confidence)} from ${currentBelief.source}.`
        : primaryNeed
          ? `${needStatusLabel(primaryNeed.status)}: ${primaryNeed.reason}`
          : "Unsettled."),
    plan: rowanNotebookPlanText(world, nextMove),
    title: notebookNeed?.label ?? "First page of the morning",
    uncertainty:
      rowanNotebookUncertaintyForBelief(currentBelief?.id) ??
      uncertaintyForNeed(notebookNeed?.key) ??
      notebookNeed?.reason ??
      "Who can turn tonight's room into tomorrow's foothold?",
  };

  return {
    currentBelief: currentBelief
      ? {
          confidence: currentBelief.confidence,
          id: currentBelief.id,
          locationId: currentBelief.locationId,
          npcId: currentBelief.npcId,
          source: currentBelief.source,
          text: currentBelief.text,
          topic: currentBelief.topic,
        }
      : undefined,
    nextMove: nextMove
      ? {
          actionId: nextMove.actionId,
          kind: nextMove.kind,
          npcId: nextMove.npcId,
          rationale: nextMove.rationale,
          targetLocationId: nextMove.targetLocationId,
          text: nextMove.text,
        }
      : undefined,
    notebook,
    primaryNeed: primaryNeed
      ? {
          key: primaryNeed.key,
          label: primaryNeed.label,
          reason: primaryNeed.reason,
          status: primaryNeed.status,
        }
      : undefined,
  };
}

export function buildRowanNextMoveFromAutonomy(
  autonomy?: RowanAutonomyState,
): RowanNextMove | undefined {
  if (!autonomy) {
    return undefined;
  }

  return {
    actionId: autonomy.actionId,
    effects: autonomy.effects,
    kind: autonomy.stepKind,
    layer: autonomy.layer,
    npcId: autonomy.npcId,
    rationale: autonomy.detail,
    targetLocationId: autonomy.targetLocationId,
    text: autonomy.label,
  };
}

function buildRowanNextMove(world: StreetGameState): RowanNextMove | undefined {
  return buildRowanNextMoveFromAutonomy(world.rowanAutonomy);
}
