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
        : "awaiting the next slot";
      return `${character.name} is ${taskLabel.toLowerCase()} (energy ${character.energy}, stress ${character.stress})`;
    });

    return `${world.scenarioName} at ${world.currentTime}. Open inbox: ${openMessages}. ${characterSummaries.join(
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
      rationale: `${context.character.name} needs player attention because ${context.event.title.toLowerCase()}.`,
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
        `Current energy is ${context.character.energy} and stress is ${context.character.stress}.`,
        context.task
          ? `Related obligation: ${context.task.title} (${context.task.kind}, due ${context.task.dueAt}).`
          : "No single task fully explains the situation.",
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
      `Acknowledge ${context.character.name} and let them continue.`,
      `Raise ${context.character.name}'s ${context.character.policies.priorityBias} priority for the rest of the day.`,
    ];

    switch (context.event.type) {
      case "obligation_missed":
        return [
          `Reschedule the missed item tied to ${context.task?.title ?? "the incident"}.`,
          `Accept the miss and protect the next commitment.`,
          `Ask ${context.character.name} to spend up to $${context.character.policies.spendingLimit} to recover.`,
        ];
      case "schedule_conflict":
        return [
          `Tell ${context.character.name} to prioritize ${context.character.policies.priorityBias}.`,
          "Choose the more important obligation manually in a later build.",
          "Accept a delay and monitor the fallout in the inbox.",
        ];
      case "stress_spike":
        return [
          `Give ${context.character.name} permission to take a recovery block.`,
          "Reduce reporting noise and check back later.",
          "Keep them on schedule and absorb the stress cost.",
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
      return "Heads-up";
    case "low":
      return "Update";
  }
}
