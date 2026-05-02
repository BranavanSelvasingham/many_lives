import type { StreetConversationContext } from "../streetDialogue.js";
import type { StreetGameState } from "../../street-sim/types.js";

export function buildPlainPlaceContext(context: StreetConversationContext) {
  return {
    city: {
      name: context.city.name,
      background: context.city.backstory,
      today: context.city.context,
    },
    district: {
      name: context.district.name,
      background: context.district.backstory,
      today: context.district.context,
    },
    here: {
      id: context.scene.locationId,
      name: context.scene.name,
      kind: context.scene.type,
      neighborhood: context.scene.neighborhood,
      whatItLooksLike: context.scene.description,
      whatUsuallyHappensHere: context.scene.context,
      background: context.scene.backstory,
    },
    nearbyPlaces: context.nearbyPlaces.map((place) => ({
      id: place.id,
      name: place.name,
      kind: place.type,
      neighborhood: place.neighborhood,
      whatUsuallyHappensThere: place.context,
    })),
    nearbyLandmarks: context.nearbyLandmarks.map((landmark) => ({
      id: landmark.id,
      label: landmark.text,
      kind: landmark.tone,
      notes: landmark.context,
    })),
    time: context.time.label,
  };
}

export function buildPlainRowanContext(context: StreetConversationContext) {
  const plan = context.rowan.objectiveState;
  const nextMove = context.rowan.cognition.nextMove;

  return {
    name: context.rowan.name,
    backstory: context.rowan.backstory,
    currentGoal: context.rowan.objective,
    currentPlan: plan
      ? {
          goal: plan.text,
          kind: plan.focus,
          progress: plan.progress?.label,
          nextSteps: plan.trail.map((step) => ({
            id: step.id,
            text: step.title,
            detail: step.detail,
            progress: step.progress,
            done: Boolean(step.done),
          })),
          recentlyFinishedSteps: plan.completedTrail.map((step) => ({
            id: step.id,
            text: step.title,
            detail: step.detail,
            progress: step.progress,
            done: Boolean(step.done),
          })),
        }
      : undefined,
    currentThought: context.rowan.currentThought,
    money: context.rowan.money,
    energy: context.rowan.energy,
    whatSeemsImportantNow: context.rowan.cognition.needs
      .slice(0, 3)
      .map((need) => ({
        need: need.label,
        status: need.status,
        why: need.reason,
      })),
    whatRowanBelieves: context.rowan.cognition.beliefs
      .slice(0, 5)
      .map((belief) => ({
        belief: belief.text,
        confidence: belief.confidence,
        from: belief.source,
      })),
    likelyNextMove: nextMove
      ? {
          what: nextMove.text,
          why: nextMove.rationale,
          kind: nextMove.kind,
          where: nextMove.targetLocationId,
          who: nextMove.npcId,
          action: nextMove.actionId,
        }
      : undefined,
    memories: context.rowan.memories.map((memory) => ({
      kind: memory.kind,
      text: memory.text,
    })),
  };
}

export function buildPlainPersonContext(context: StreetConversationContext) {
  return {
    id: context.npc.id,
    name: context.npc.name,
    role: context.npc.role,
    about: context.npc.summary,
    background: context.npc.narrative.backstory,
    whatTheyCareAbout: context.npc.narrative.objective,
    voice: context.npc.narrative.voice,
    whatIsOnTheirMind: context.npc.currentConcern,
    currentMood: context.npc.mood,
    howMuchTheyTrustRowan: context.npc.trust,
    howWillingTheyAreToTalk: context.npc.openness,
    lastThingTheySaid: context.npc.lastSpokenLine,
    whatTheyRemember: context.npc.memory,
  };
}

export function buildPlainConversationContext(context: StreetConversationContext) {
  return {
    takeawaySoFar: context.thread.decision,
    possibleNextStepForRowan: context.thread.objectiveText,
    shortSummary: context.thread.summary,
    turnsWithThisPerson: context.thread.turnCount,
    recentLines: context.recentConversation.map((line) => ({
      speaker: line.speakerName,
      text: line.text,
      time: line.time,
    })),
  };
}

export function buildPlainOpenPossibilitiesContext(game: StreetGameState) {
  return {
    knownJobs: game.jobs
      .filter((job) => job.discovered && !job.completed && !job.missed)
      .map((job) => ({
        id: job.id,
        title: job.title,
        where: job.locationId,
        accepted: job.accepted,
        startsAtHour: job.startHour,
        endsAtHour: job.endHour,
      })),
    knownProblems: game.problems
      .filter((problem) => problem.discovered && problem.status === "active")
      .map((problem) => ({
        id: problem.id,
        title: problem.title,
        where: problem.locationId,
        urgency: problem.urgency,
      })),
  };
}
