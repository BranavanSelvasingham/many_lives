import type { StreetGameState } from "./types";

export type IndependentNpcActionRecord = {
  afterStatus: "resolved";
  beforeStatus: "active";
  locationId: string;
  playerFacingSummary: string;
  problemId: string;
  problemTitle: string;
  resolvedAt: string | null;
  resolverConcern: string | null;
  resolverMood: string | null;
  resolverName: string;
  resolverNpcId: string;
};

export function buildIndependentNpcActionRecords(
  game: StreetGameState,
): IndependentNpcActionRecord[] {
  const npcsById = new Map(game.npcs.map((npc) => [npc.id, npc] as const));

  return (game.problems ?? [])
    .filter((problem) => problem.status === "resolved" && problem.resolvedByNpcId)
    .map((problem) => {
      const resolverNpcId = problem.resolvedByNpcId;
      if (!resolverNpcId) {
        return null;
      }

      const resolver = npcsById.get(resolverNpcId);
      const resolverName = resolver?.name ?? resolverNpcId ?? "A local";
      return {
        afterStatus: "resolved" as const,
        beforeStatus: "active" as const,
        locationId: problem.locationId,
        playerFacingSummary: independentNpcActionSummary({
          problemId: problem.id,
          problemTitle: problem.title,
          resolverName,
        }),
        problemId: problem.id,
        problemTitle: problem.title,
        resolvedAt: problem.resolvedAt ?? null,
        resolverConcern: resolver?.currentConcern ?? null,
        resolverMood: resolver?.mood ?? null,
        resolverName,
        resolverNpcId,
      };
    })
    .filter((action): action is IndependentNpcActionRecord => Boolean(action))
    .sort(compareIndependentNpcActionRecordsDesc);
}

export function findIndependentNpcActionBySummary(
  game: StreetGameState,
  summary: string | null | undefined,
) {
  if (!summary) {
    return null;
  }

  return (
    buildIndependentNpcActionRecords(game).find(
      (action) =>
        action.playerFacingSummary === summary ||
        summary.endsWith(action.playerFacingSummary) ||
        summary.endsWith(lowercaseFirst(action.playerFacingSummary)),
    ) ?? null
  );
}

export function independentNpcActionBeatTitle(
  action: IndependentNpcActionRecord,
  locationName?: string,
) {
  if (action.problemId === "problem-pump") {
    return `${action.resolverName} steadied Morrow House`;
  }

  if (action.problemId === "problem-cart") {
    return `${action.resolverName} cleared the square`;
  }

  return locationName
    ? `${action.resolverName} stepped in at ${locationName}`
    : `${action.resolverName} stepped in`;
}

export function independentNpcActionBeatDetail(
  action: IndependentNpcActionRecord,
  locationName?: string,
) {
  if (!locationName) {
    return action.playerFacingSummary;
  }

  return `At ${locationName}, ${action.playerFacingSummary}`;
}

function independentNpcActionSummary({
  problemId,
  problemTitle,
  resolverName,
}: {
  problemId: string;
  problemTitle: string;
  resolverName: string;
}) {
  if (problemId === "problem-pump") {
    return `${resolverName} contained the ${problemTitle.toLowerCase()} before it became evening house strain.`;
  }
  if (problemId === "problem-cart") {
    return `${resolverName} cleared the ${problemTitle.toLowerCase()} before Quay Square spent the afternoon bent around it.`;
  }
  return `${resolverName} resolved the ${problemTitle.toLowerCase()} without Rowan taking the work.`;
}

function compareIndependentNpcActionRecordsDesc(
  left: IndependentNpcActionRecord,
  right: IndependentNpcActionRecord,
) {
  const leftTime = left.resolvedAt ? Date.parse(left.resolvedAt) : Number.NEGATIVE_INFINITY;
  const rightTime = right.resolvedAt
    ? Date.parse(right.resolvedAt)
    : Number.NEGATIVE_INFINITY;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return left.problemId.localeCompare(right.problemId);
}

function lowercaseFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
