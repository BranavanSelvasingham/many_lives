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

  it("rewrites stale illegal rejection diagnostics as player-facing passed-over reasons", () => {
    const diagnosticReasons = [
      "Rejected because this route hint action is no longer legal in the current world state.",
      "Rejected because this objective action is no longer legal in the current world state.",
    ];

    for (const reason of diagnosticReasons) {
      const artifact = buildRowanVisibleDecisionArtifactFromState({
        autonomyActionId: "talk:npc-nia",
        autonomyLabel: "Ask Nia what still needs doing",
        autonomyReason:
          "Nia is the strongest confirmed lead, so Rowan should speak with her.",
        objectiveText: "Find a useful opening without chasing stale leads.",
        planningTrace: {
          blockers: [],
          considered: [
            {
              actionId: "talk:npc-nia",
              label: "Ask Nia what still needs doing",
              matchedOutcomeId: "confirm-nia-lead",
              planKey: "confirm-nia-lead",
              pressureId: "first-lead",
              pressureKind: "objective",
              pressureLabel: "Confirm the strongest lead",
              provenance: "legal-action" as const,
              rationale:
                "Nia is available now and can confirm which opening still matters.",
              score: 8,
              status: "selected" as const,
              targetLocationId: "quay",
              npcId: "npc-nia",
            },
          ],
          nextSteps: [
            {
              actionId: "talk:npc-nia",
              kind: "talk",
              label: "Ask Nia what still needs doing",
              legal: true,
              rationale: "Use the confirmed local lead before chasing another opening.",
              validation: "The current choices include speaking with Nia.",
              targetLocationId: "quay",
              npcId: "npc-nia",
            },
          ],
          outcomes: [
            {
              blockers: [],
              evidence: "Nia is nearby and available.",
              id: "confirm-nia-lead",
              label: "Confirm the strongest lead",
              status: "blocked",
              urgency: 8,
            },
          ],
          rejected: [
            {
              actionId: "move:courtyard",
              label: "Head to Morrow Yard",
              matchedOutcomeId: "stale-yard-lead",
              planKey: "stale-yard-lead",
              pressureId: "yard",
              pressureKind: "objective",
              pressureLabel: "Old yard lead",
              provenance: "route-scaffold" as const,
              rationale: "The old yard lead was checked against the choices.",
              reason,
              score: 0,
              status: "rejected" as const,
              targetLocationId: "courtyard",
            },
          ],
          selectedActionId: "talk:npc-nia",
          selectedLabel: "Ask Nia what still needs doing",
          selectedLegalBacking: {
            actionId: "talk:npc-nia",
            locationId: "quay",
            source: "current-legal-action-surface",
          },
          selectedMatchedOutcomeId: "confirm-nia-lead",
          selectedPlanKey: "confirm-nia-lead",
          selectedPressureId: "first-lead",
          selectedPressureKind: "objective",
          selectedPressureLabel: "Confirm the strongest lead",
          selectedTargetLocationId: "quay",
        },
      });

      expect(artifact?.passedOver[0]).toBe(
        "That opening has closed, so Rowan keeps to the confirmed choice.",
      );
      expect(artifact?.passedOver.join(" ")).not.toMatch(
        /suggested move|no longer legal|current world state|route hint action|Rejected because|objective action/i,
      );
      expect(artifact?.passedOver.join(" ")).not.toContain(reason);
    }
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
