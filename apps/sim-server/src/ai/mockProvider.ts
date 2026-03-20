import type {
  AIContext,
  AIProvider,
  EscalationSuggestion,
  GeneratedInboxMessage,
} from "./provider.js";
import { buildClassifyEscalationPrompt } from "./prompts/classifyEscalation.js";
import { buildGenerateInboxMessagePrompt } from "./prompts/generateInboxMessage.js";
import { buildProposeNextActionPrompt } from "./prompts/proposeNextAction.js";
import { buildSummarizeStatePrompt } from "./prompts/summarizeState.js";

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async summarizeState(world: AIContext["world"]): Promise<string> {
    buildSummarizeStatePrompt(world);

    const openMessages = world.inbox.filter(
      (message) => !message.resolvedAt,
    ).length;
    const characterSummaries = world.characters.map((character) => {
      const activeTask = world.tasks.find(
        (task) => task.id === character.activeTaskId,
      );
      const taskLabel = activeTask
        ? activeTask.title
        : "holding for the next opening";
      return `${character.name} is ${taskLabel.toLowerCase()} (energy ${character.energy}, strain ${character.stress})`;
    });

    return `${world.scenarioName} at ${world.currentTime}. Open threads: ${openMessages}. ${characterSummaries.join(
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
          ? `Related opening: ${context.task.title} (${context.task.kind}, due ${context.task.dueAt}).`
          : "No single opening fully explains the situation.",
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
      case "obligation_missed":
        return [
          `Recover the miss tied to ${context.task?.title ?? "the incident"}.`,
          "Accept the loss and protect the next decisive opening.",
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
