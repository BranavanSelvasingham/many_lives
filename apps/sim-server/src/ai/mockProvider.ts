import type {
  AIContext,
  AIProvider,
  EscalationSuggestion,
  GeneratedInboxMessage,
  StreetAutonomousLineRequest,
  StreetAutonomousLineResult,
  StreetConversationInterpretationRequest,
  StreetConversationInterpretationResult,
} from "./provider.js";
import { buildClassifyEscalationPrompt } from "./prompts/classifyEscalation.js";
import { buildGenerateStreetAutonomousLinePrompt } from "./prompts/generateStreetAutonomousLine.js";
import { buildGenerateStreetThoughtsPrompt } from "./prompts/generateStreetThoughts.js";
import { buildGenerateStreetReplyPrompt } from "./prompts/generateStreetReply.js";
import { buildGenerateInboxMessagePrompt } from "./prompts/generateInboxMessage.js";
import { buildInterpretStreetConversationPrompt } from "./prompts/interpretStreetConversation.js";
import { buildProposeNextActionPrompt } from "./prompts/proposeNextAction.js";
import { buildSummarizeStatePrompt } from "./prompts/summarizeState.js";
import {
  buildDeterministicStreetReply,
  type StreetDialogueRequest,
  type StreetDialogueResult,
} from "./streetDialogue.js";
import {
  buildDeterministicStreetThoughts,
  type StreetThoughtsResult,
} from "./streetThoughts.js";

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async summarizeState(world: AIContext["world"]): Promise<string> {
    buildSummarizeStatePrompt(world);

    const openMessages = world.inbox.filter(
      (message) => !message.resolvedAt,
    ).length;
    const liveCurrents = world.city.currents.filter(
      (current) => current.status === "live",
    ).length;
    const hottestRival = world.city.rivals
      .slice()
      .sort((left, right) => right.threat - left.threat)[0];
    const characterSummaries = world.characters.map((character) => {
      const activeTask = world.tasks.find(
        (task) => task.id === character.activeTaskId,
      );
      const taskLabel = activeTask
        ? activeTask.title
        : "reading the next signal";
      return `${character.name} is ${taskLabel.toLowerCase()} (energy ${character.energy}, strain ${character.stress}, coherence ${character.memoryCoherence})`;
    });

    return `${world.scenarioName} at ${world.currentTime}. Open threads: ${openMessages}. Live currents: ${liveCurrents}. Rival pressure: ${hottestRival?.name ?? "unknown rival"} on ${hottestRival?.focus ?? "multiple fronts"}. ${characterSummaries.join(
      " | ",
    )}`;
  }

  async classifyEscalation(context: AIContext): Promise<EscalationSuggestion> {
    buildClassifyEscalationPrompt(
      context.character,
      context.event,
      context.task,
    );

    const shouldEscalate =
      context.event.type === "obligation_missed" ||
      context.event.type === "schedule_conflict" ||
      context.event.type === "stress_spike";

    return {
      shouldEscalate,
      priority: context.event.priority,
      rationale: `${context.character.name} needs player attention because ${context.event.title.toLowerCase()} could reshape the board.`,
    };
  }

  async generateInboxMessage(
    context: AIContext & {
      escalation: EscalationSuggestion;
      suggestedActions: string[];
    },
  ): Promise<GeneratedInboxMessage> {
    buildGenerateInboxMessagePrompt(
      context.character,
      context.event,
      context.task,
    );

    const subjectPrefix = subjectPrefixForPriority(context.escalation.priority);
    const taskLabel = context.task ? context.task.title : context.event.title;

    return {
      type: context.event.type === "task_completed" ? "update" : "alert",
      priority: context.escalation.priority,
      subject: `${subjectPrefix}: ${context.character.name} - ${taskLabel}`,
      body: [
        `${context.character.name} reports: ${context.event.description}`,
        `Current energy is ${context.character.energy} and strain is ${context.character.stress}.`,
        context.task
          ? `Related thread: ${context.task.title} (${context.task.kind}, due ${context.task.dueAt}).`
          : "No single signal fully explains the situation.",
      ].join(" "),
      suggestedActions: context.suggestedActions,
      requiresResponse:
        context.event.priority === "high" ||
        context.event.priority === "critical",
    };
  }

  async proposeNextAction(context: AIContext): Promise<string[]> {
    buildProposeNextActionPrompt(
      context.character,
      context.event,
      context.task,
    );

    const genericActions = [
      `Acknowledge ${context.character.name} and let the thread run.`,
      `Tilt ${context.character.name} toward ${context.character.policies.priorityBias} for the next block.`,
    ];

    switch (context.event.type) {
      case "signal_detected":
      case "contact_shift":
      case "threshold_shift":
      case "rumor_sharpened":
      case "scene_heat":
      case "tech_glimmer":
        return [
          `Tell ${context.character.name} to move before the signal hardens into someone else's leverage.`,
          `Hold position and gather one more layer of signal around ${context.event.title}.`,
          `Route the thread toward the self best suited to ${context.character.policies.priorityBias}.`,
        ];
      case "current_lost":
      case "rival_advance":
      case "rival_trace":
        return [
          `Countermove immediately and contest the board shift.`,
          "Let the rival take this layer and protect coherence for the next turn of the city.",
          `Ask ${context.character.name} who still changes the map if approached tonight.`,
        ];
      case "coherence_drift":
        return [
          `Pull ${context.character.name} back toward coherence before the selves start contradicting each other.`,
          "Keep the thread hot and accept the fragmentation cost for now.",
          "Reassign one live thread to reduce internal strain.",
        ];
      case "obligation_missed":
        return [
          `Recover the miss tied to ${context.task?.title ?? "the incident"}.`,
          "Accept the loss and protect the next decisive shift.",
          `Authorize up to $${context.character.policies.spendingLimit} to buy back momentum.`,
        ];
      case "schedule_conflict":
        return [
          `Tell ${context.character.name} to pursue ${context.character.policies.priorityBias}.`,
          "Choose one room and sacrifice the other.",
          "Delay the choice and monitor who moves faster.",
        ];
      case "stress_spike":
        return [
          `Give ${context.character.name} permission to recover coherence.`,
          "Reduce noise and check back after the next block.",
          "Keep the thread live and absorb the fragmentation cost.",
        ];
      default:
        return genericActions;
    }
  }

  async generateStreetThoughts(
    game: import("../street-sim/types.js").StreetGameState,
  ): Promise<StreetThoughtsResult> {
    buildGenerateStreetThoughtsPrompt(game);
    return buildDeterministicStreetThoughts(game);
  }

  async generateStreetReply(
    input: StreetDialogueRequest,
  ): Promise<StreetDialogueResult> {
    buildGenerateStreetReplyPrompt(input);
    return buildDeterministicStreetReply(input);
  }

  async generateStreetAutonomousLine(
    input: StreetAutonomousLineRequest,
  ): Promise<StreetAutonomousLineResult> {
    buildGenerateStreetAutonomousLinePrompt(input);
    return {
      speech:
        input.purpose === "followup"
          ? "What does that change for me right now?"
          : "I'm Rowan. I'm trying to get my feet under me here. What matters most right now?",
    };
  }

  async interpretStreetConversation(
    input: StreetConversationInterpretationRequest,
  ): Promise<StreetConversationInterpretationResult> {
    buildInterpretStreetConversationPrompt(input);
    const npc = input.game.npcs.find((entry) => entry.id === input.npcId);
    const location = input.game.player.currentLocationId
      ? input.game.locations.find(
          (entry) => entry.id === input.game.player.currentLocationId,
        )
      : undefined;

    return {
      npcImpression: npc
        ? `${npc.name} is still deciding how much Rowan will follow through.`
        : undefined,
      summary: npc
        ? `${npc.name} and Rowan clarified the thread at ${
            location?.name ?? "South Quay"
          }, but the next move still needs a sharper read.`
        : undefined,
    };
  }
}

function subjectPrefixForPriority(
  priority: EscalationSuggestion["priority"],
): string {
  switch (priority) {
    case "critical":
      return "Critical";
    case "high":
      return "Important";
    case "medium":
      return "Signal";
    case "low":
      return "Update";
  }
}
