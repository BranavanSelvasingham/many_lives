import type { AIProvider } from "../ai/provider.js";
import type { GameCommand } from "../types/api.js";
import { normalizePolicySettings } from "../domain/policy.js";
import type { WorldState } from "../domain/world.js";
import { seedScenario } from "./seedScenario.js";
import { advanceWorldByTicks } from "./tick.js";
import {
  addMinutes,
  clamp,
  cloneWorldState,
  findCharacter,
  recordEvent,
  recordInboxMessage,
} from "./worldState.js";

export class SimulationEngine {
  constructor(private readonly aiProvider: AIProvider) {}

  get providerName(): string {
    return this.aiProvider.name;
  }

  async createGame(gameId: string): Promise<WorldState> {
    const world = seedScenario(gameId);
    world.summary = await this.aiProvider.summarizeState(world);
    return world;
  }

  async tick(world: WorldState, tickCount: number): Promise<WorldState> {
    return advanceWorldByTicks(world, tickCount, this.aiProvider);
  }

  async runCommand(
    world: WorldState,
    command: GameCommand,
  ): Promise<WorldState> {
    const nextWorld = cloneWorldState(world);

    switch (command.type) {
      case "resolve_inbox": {
        const message = nextWorld.inbox.find(
          (entry) => entry.id === command.messageId,
        );
        if (!message) {
          break;
        }

        message.resolvedAt = nextWorld.currentTime;
        message.requiresResponse = false;
        message.snoozedUntil = null;

        const character = findCharacter(nextWorld, message.characterId);
        if (character) {
          applyActionOutcome(character, command.actionId);
          recordEvent(nextWorld, {
            characterId: character.id,
            type: "player_response",
            priority: "low",
          title: `Player resolved ${message.subject}`,
          description: buildResponseDescription(
            character.name,
              command.actionId,
              command.overrideText,
            ),
            createdAt: nextWorld.currentTime,
          });
        }

        break;
      }
      case "snooze_inbox": {
        const message = nextWorld.inbox.find(
          (entry) => entry.id === command.messageId,
        );
        if (!message) {
          break;
        }

        message.snoozedUntil = addMinutes(
          nextWorld.currentTime,
          command.durationMinutes,
        );

        recordEvent(nextWorld, {
          characterId: message.characterId,
          type: "player_response",
          priority: "low",
          title: `Player snoozed ${message.subject}`,
          description: `${message.subject} was snoozed until ${message.snoozedUntil}.`,
          createdAt: nextWorld.currentTime,
        });
        break;
      }
      case "delegate_inbox": {
        const message = nextWorld.inbox.find(
          (entry) => entry.id === command.messageId,
        );
        if (!message) {
          break;
        }

        const sourceCharacter = findCharacter(nextWorld, message.characterId);
        const targetCharacter = findCharacter(
          nextWorld,
          command.targetCharacterId,
        );

        message.resolvedAt = nextWorld.currentTime;
        message.requiresResponse = false;
        message.delegatedToCharacterId = command.targetCharacterId;
        message.snoozedUntil = null;

        if (sourceCharacter) {
          sourceCharacter.stress = clamp(sourceCharacter.stress - 4, 0, 100);
        }

        if (targetCharacter) {
          targetCharacter.stress = clamp(targetCharacter.stress + 6, 0, 100);
        }

        const delegationEvent = recordEvent(nextWorld, {
          characterId: targetCharacter?.id ?? message.characterId,
          type: "player_response",
          priority: "medium",
          title: `Player delegated ${message.subject}`,
          description: targetCharacter
            ? `${targetCharacter.name} has been asked to help with ${message.subject.toLowerCase()}.`
            : `The player delegated ${message.subject.toLowerCase()} to another character.`,
          createdAt: nextWorld.currentTime,
        });

        if (targetCharacter) {
          recordInboxMessage(nextWorld, {
            characterId: targetCharacter.id,
            senderName: targetCharacter.name,
            type: "update",
            priority: "medium",
            subject: `Delegated: ${message.subject}`,
            body: `${targetCharacter.name} is taking point on ${message.subject.toLowerCase()} and will report back after their current block.`,
            suggestedActions: ["Acknowledge"],
            requiresResponse: false,
            createdAt: nextWorld.currentTime,
            eventId: delegationEvent.id,
            consequences: {
              momentum: "medium",
              integrity: "medium",
            },
          });
        }
        break;
      }
      case "update_policy": {
        const character = findCharacter(nextWorld, command.characterId);
        if (!character) {
          break;
        }

        character.policies = normalizePolicySettings(
          command.policy,
          character.policies,
        );

        recordEvent(nextWorld, {
          characterId: character.id,
          type: "policy_update",
          priority: "low",
          title: `${character.name}'s policy changed`,
          description: `The player updated ${character.name}'s escalation and spending settings.`,
          createdAt: nextWorld.currentTime,
        });
        break;
      }
    }

    nextWorld.summary = await this.aiProvider.summarizeState(nextWorld);
    return nextWorld;
  }
}

function buildResponseDescription(
  characterName: string,
  actionId?: string,
  overrideText?: string,
): string {
  let description = `${characterName} has received a player directive.`;

  if (actionId) {
    description += ` Decision: ${prettifyActionId(actionId)}.`;
  }

  if (overrideText && overrideText.length > 0) {
    description += ` Override: ${overrideText}.`;
  }

  return description + " The board has shifted for now.";
}

function applyActionOutcome(
  character: WorldState["characters"][number],
  actionId?: string,
): void {
  if (!actionId) {
    character.stress = clamp(character.stress - 5, 0, 100);
    return;
  }

  const normalizedAction = actionId.toLowerCase();

  if (normalizedAction.includes("wait")) {
    character.stress = clamp(character.stress + 3, 0, 100);
    return;
  }

  if (
    normalizedAction.includes("switch") ||
    normalizedAction.includes("vendor") ||
    normalizedAction.includes("cover")
  ) {
    character.cash = Math.max(0, character.cash - 40);
    character.stress = clamp(character.stress - 6, 0, 100);
    return;
  }

  if (normalizedAction.includes("cancel")) {
    character.stress = clamp(character.stress + 5, 0, 100);
    return;
  }

  character.stress = clamp(character.stress - 4, 0, 100);
}

function prettifyActionId(actionId: string): string {
  return actionId.replace("_", " ").replace("-", " ");
}
