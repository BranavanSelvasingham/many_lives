import type { StreetGameState } from "./types";

export type IndependentNpcActionKind = "job_closure" | "problem_resolution";

export type IndependentNpcActionRecord = {
  actionKind: IndependentNpcActionKind;
  actorConcern: string | null;
  actorMood: string | null;
  actorName: string;
  actorNpcId: string;
  afterStatus: "closed" | "resolved";
  beforeStatus: "active" | "open";
  closedAt?: string | null;
  jobId?: string;
  jobTitle?: string;
  locationId: string;
  occurredAt: string | null;
  playerFacingSummary: string;
  problemId?: string;
  problemTitle?: string;
  resolvedAt?: string | null;
  resolverConcern?: string | null;
  resolverMood?: string | null;
  resolverName?: string;
  resolverNpcId?: string;
  subjectId: string;
  subjectTitle: string;
};

export function buildIndependentNpcActionRecords(
  game: StreetGameState,
): IndependentNpcActionRecord[] {
  const npcsById = new Map(game.npcs.map((npc) => [npc.id, npc] as const));

  const problemRecords: IndependentNpcActionRecord[] = (game.problems ?? [])
    .filter((problem) => problem.status === "resolved" && problem.resolvedByNpcId)
    .flatMap((problem): IndependentNpcActionRecord[] => {
      const resolverNpcId = problem.resolvedByNpcId;
      if (!resolverNpcId) {
        return [];
      }

      const resolver = npcsById.get(resolverNpcId);
      const resolverName = resolver?.name ?? resolverNpcId ?? "A local";
      return [{
        actionKind: "problem_resolution" as const,
        actorConcern: resolver?.currentConcern ?? null,
        actorMood: resolver?.mood ?? null,
        actorName: resolverName,
        actorNpcId: resolverNpcId,
        afterStatus: "resolved" as const,
        beforeStatus: "active" as const,
        locationId: problem.locationId,
        occurredAt: problem.resolvedAt ?? null,
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
        subjectId: problem.id,
        subjectTitle: problem.title,
      }];
    });

  const jobRecords: IndependentNpcActionRecord[] = (game.jobs ?? [])
    .filter(
      (job) =>
        job.id === "job-yard-shift" &&
        job.missed &&
        Boolean(job.consequenceAppliedAt),
    )
    .map((job) => {
      const actorNpcId = job.giverNpcId || "npc-tomas";
      const actor = npcsById.get(actorNpcId);
      const actorName = actor?.name ?? "Tomas";
      return {
        actionKind: "job_closure" as const,
        actorConcern: actor?.currentConcern ?? null,
        actorMood: actor?.mood ?? null,
        actorName,
        actorNpcId,
        afterStatus: "closed" as const,
        beforeStatus: "open" as const,
        closedAt: job.consequenceAppliedAt ?? null,
        jobId: job.id,
        jobTitle: job.title,
        locationId: job.locationId,
        occurredAt: job.consequenceAppliedAt ?? null,
        playerFacingSummary: independentJobClosureSummary({
          actorName,
        }),
        resolverConcern: actor?.currentConcern ?? null,
        resolverMood: actor?.mood ?? null,
        resolverName: actorName,
        resolverNpcId: actorNpcId,
        subjectId: job.id,
        subjectTitle: job.title,
      };
    });

  return [...problemRecords, ...jobRecords].sort(
    compareIndependentNpcActionRecordsDesc,
  );
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

export function independentNpcActionRecordKey(
  action: IndependentNpcActionRecord,
) {
  return `${action.actionKind}|${action.subjectId}|${action.actorNpcId}|${
    action.occurredAt ?? "none"
  }`;
}

export function independentNpcActionBeatTitle(
  action: IndependentNpcActionRecord,
  locationName?: string,
) {
  if (action.actionKind === "job_closure") {
    return `${action.actorName} closed the yard load`;
  }

  if (action.problemId === "problem-pump") {
    return `${action.actorName} steadied Morrow House`;
  }

  if (action.problemId === "problem-cart") {
    return `${action.actorName} cleared the square`;
  }

  return locationName
    ? `${action.actorName} stepped in at ${locationName}`
    : `${action.actorName} stepped in`;
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

function independentJobClosureSummary({ actorName }: { actorName: string }) {
  return `${actorName} got the North Crane Yard load out with his own crew; Rowan gets no pay or credit from that work.`;
}

function compareIndependentNpcActionRecordsDesc(
  left: IndependentNpcActionRecord,
  right: IndependentNpcActionRecord,
) {
  const leftTime = left.occurredAt
    ? Date.parse(left.occurredAt)
    : Number.NEGATIVE_INFINITY;
  const rightTime = right.occurredAt
    ? Date.parse(right.occurredAt)
    : Number.NEGATIVE_INFINITY;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return left.subjectId.localeCompare(right.subjectId);
}

function lowercaseFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
