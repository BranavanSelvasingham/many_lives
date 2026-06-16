import { describe, expect, it } from "vitest";
import { buildRowanVisibleDecisionArtifactFromState } from "../../many-lives-web/src/lib/street/rowanDecisionArtifact.js";

describe("Rowan visible decision artifact", () => {
  it("keeps rejected route labels out of reason-led visible options", () => {
    const rejectedYardOption = {
      actionId: "move:courtyard",
      label: "Head to Morrow Yard",
      matchedOutcomeId: "recover-first",
      planKey: "help-yard-pump",
      pressureId: "problem-pump",
      pressureKind: "problem",
      pressureLabel: "Morrow Yard pump",
      provenance: "objective-predicate" as const,
      rationale:
        "The pump matters, but Rowan needs recovery before taking on a repair.",
      reason: "Rowan needs recovery before new repair work will stick.",
      score: 4,
      status: "rejected" as const,
      targetLocationId: "courtyard",
    };
    const artifact = buildRowanVisibleDecisionArtifactFromState({
      autonomyActionId: "move:boarding-house",
      autonomyLabel: "Return to Morrow House to recover",
      autonomyReason:
        "Rowan is tired enough that recovery is the useful next move.",
      objectiveText:
        "Recover before choosing between yard work and the Morrow Yard pump.",
      planningTrace: {
        blockers: [],
        considered: [
          {
            actionId: "move:boarding-house",
            label: "Return to Morrow House",
            matchedOutcomeId: "recover-first",
            planKey: "recover-first",
            pressureId: "rest-home",
            pressureKind: "need",
            pressureLabel: "Recovery before new work",
            provenance: "legal-action" as const,
            rationale:
              "Rowan can turn the paid shift into a steadier foothold by recovering first.",
            score: 8,
            status: "selected" as const,
            targetLocationId: "boarding-house",
          },
          rejectedYardOption,
        ],
        nextSteps: [
          {
            actionId: "move:boarding-house",
            kind: "move",
            label: "Return to Morrow House",
            legal: true,
            rationale: "Rest before making the next repair or work commitment.",
            validation: "The current choices include the move back to Morrow House.",
            targetLocationId: "boarding-house",
          },
        ],
        outcomes: [
          {
            blockers: ["Rowan's energy is low after the shift."],
            evidence: "The paid shift left Rowan tired.",
            id: "recover-first",
            label: "Recover before new commitments",
            status: "blocked",
            urgency: 8,
          },
        ],
        rejected: [rejectedYardOption],
        selectedActionId: "move:boarding-house",
        selectedLabel: "Return to Morrow House",
        selectedLegalBacking: {
          actionId: "move:boarding-house",
          locationId: "boarding-house",
          source: "current-legal-action-surface",
        },
        selectedMatchedOutcomeId: "recover-first",
        selectedPlanKey: "recover-first",
        selectedPressureId: "rest-home",
        selectedPressureKind: "need",
        selectedPressureLabel: "Recovery before new work",
        selectedTargetLocationId: "boarding-house",
      },
    });

    expect(rejectedYardOption.label).toBe("Head to Morrow Yard");
    expect(artifact?.passedOver[0]).toMatch(/^Rowan needs recovery/i);
    expect(artifact?.passedOver[0]).not.toMatch(/^Head to Morrow Yard:/i);
    expect(artifact?.considered.join(" ")).not.toMatch(
      /\bHead to Morrow Yard\b/i,
    );
  });

  it("preserves route labels when no player-facing rationale exists", () => {
    const artifact = buildRowanVisibleDecisionArtifactFromState({
      autonomyActionId: "wait:steady",
      autonomyLabel: "Hold steady at Morrow House",
      autonomyReason: "Rowan has enough context to steady himself first.",
      objectiveText: "Check the yard before choosing the next job.",
      planningTrace: {
        blockers: [],
        considered: [
          {
            actionId: "wait:steady",
            label: "Hold steady at Morrow House",
            matchedOutcomeId: "steady-first",
            planKey: "steady-first",
            pressureId: "rest",
            pressureKind: "need",
            pressureLabel: "Steady first",
            provenance: "legal-action" as const,
            rationale: "Rowan has enough context to steady himself first.",
            score: 8,
            status: "selected" as const,
            targetLocationId: "boarding-house",
          },
          {
            actionId: "move:courtyard",
            label: "Head to Morrow Yard",
            matchedOutcomeId: "check-yard",
            planKey: "check-yard",
            pressureId: "yard",
            pressureKind: "objective",
            pressureLabel: "Morrow Yard",
            provenance: "legal-action" as const,
            rationale: "",
            score: 6,
            status: "rejected" as const,
            targetLocationId: "courtyard",
          },
        ],
        nextSteps: [],
        outcomes: [],
        rejected: [
          {
            actionId: "move:boarding-house",
            label: "Return to Morrow House",
            matchedOutcomeId: "check-yard",
            planKey: "rest",
            pressureId: "rest",
            pressureKind: "need",
            pressureLabel: "Rest",
            provenance: "legal-action" as const,
            rationale: "",
            score: 2,
            status: "rejected" as const,
            targetLocationId: "boarding-house",
          },
        ],
        selectedActionId: "wait:steady",
        selectedLabel: "Hold steady at Morrow House",
        selectedLegalBacking: {
          actionId: "wait:steady",
          locationId: "boarding-house",
          source: "current-legal-action-surface",
        },
        selectedMatchedOutcomeId: "steady-first",
        selectedPlanKey: "steady-first",
        selectedPressureId: "rest",
        selectedPressureKind: "need",
        selectedPressureLabel: "Steady first",
        selectedTargetLocationId: "boarding-house",
      },
    });

    expect(artifact?.considered).toContain("Head to Morrow Yard");
    expect(artifact?.passedOver).toContain("Return to Morrow House");
  });
});
