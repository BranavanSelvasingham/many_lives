import type { StreetGameState } from "./types";

type PlaybackObjective = NonNullable<StreetGameState["player"]["objective"]>;

export type PlaybackObjectiveTrailStep = PlaybackObjective["trail"][number];

export type PlaybackTrailVisibilityPolicy = {
  id: string;
  objectivePatterns: readonly RegExp[];
  trailPatterns: readonly RegExp[];
};

export type PlaybackHomeRestLocationPolicy = {
  homeLocationIds: readonly string[];
  homeLocationNamePatterns: readonly RegExp[];
  id: string;
};

export const PLAYBACK_TRAIL_VISIBILITY_POLICIES: readonly PlaybackTrailVisibilityPolicy[] =
  [
    {
      id: "nia-block-lead-hides-morrow-standing",
      objectivePatterns: [/\bnia\b/i, /\b(block|jam|cart|square)\b/i],
      trailPatterns: [
        /\bmorrow house\b/i,
        /\b(standing|room stays mine|tonight'?s bed|settle)\b/i,
      ],
    },
  ];

export const PLAYBACK_HOME_REST_LOCATION_POLICY: PlaybackHomeRestLocationPolicy =
  {
    homeLocationIds: ["boarding-house"],
    homeLocationNamePatterns: [/morrow house|boarding house/i],
    id: "home-rest-location",
  };

export function isObjectiveTrailStepPlayerFacingForPlayback({
  objective,
  step,
}: {
  objective: PlaybackObjective | null | undefined;
  step: PlaybackObjectiveTrailStep;
}) {
  if (!objective) {
    return true;
  }

  const objectiveText = objectivePolicyText(objective);
  const trailText = trailStepPolicyText(step);

  return !PLAYBACK_TRAIL_VISIBILITY_POLICIES.some(
    (policy) =>
      matchesEveryPattern(objectiveText, policy.objectivePatterns) &&
      matchesEveryPattern(trailText, policy.trailPatterns),
  );
}

export function isPlaybackHomeRestLocation({
  locationId,
  locationName,
}: {
  locationId: string | null | undefined;
  locationName: string | null | undefined;
}) {
  return (
    Boolean(
      locationId &&
        PLAYBACK_HOME_REST_LOCATION_POLICY.homeLocationIds.includes(locationId),
    ) ||
    PLAYBACK_HOME_REST_LOCATION_POLICY.homeLocationNamePatterns.some((pattern) =>
      pattern.test(locationName ?? ""),
    )
  );
}

function objectivePolicyText(objective: PlaybackObjective) {
  return [
    objective.text,
    objective.routeKey,
    ...(objective.outcomes ?? []).flatMap((outcome) => [
      outcome.id,
      outcome.label,
      outcome.npcId,
      outcome.evidence,
      ...(outcome.blockers ?? []),
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function trailStepPolicyText(step: PlaybackObjectiveTrailStep) {
  return [step.id, step.title, step.detail, step.progress]
    .filter(Boolean)
    .join(" ");
}

function matchesEveryPattern(text: string, patterns: readonly RegExp[]) {
  return patterns.every((pattern) => pattern.test(text));
}
