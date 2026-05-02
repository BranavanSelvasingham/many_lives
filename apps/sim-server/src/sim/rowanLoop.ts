import type {
  ObjectiveFocus,
  RowanAutonomyEffect,
  RowanAutonomyLayer,
  RowanAutonomyState,
  RowanAutonomyStepKind,
  StreetGameState,
} from "../street-sim/types.js";

export type RowanLoopObjectiveDirective = {
  focus: ObjectiveFocus;
  routeKey: string;
  text: string;
};

export type RowanLoopStep = {
  actionId?: string;
  autoContinue: boolean;
  detail: string;
  effects?: RowanAutonomyEffect[];
  key: string;
  kind: RowanAutonomyStepKind;
  label: string;
  layer: RowanAutonomyLayer;
  npcId?: string;
  objective?: RowanLoopObjectiveDirective;
  speech?: string;
  targetLocationId?: string;
  waitUntilMinutes?: number;
};

export type RowanLoopOptionalResolver = (
  world: StreetGameState,
) => RowanLoopStep | undefined;

export type RowanLoopRequiredResolver = (
  world: StreetGameState,
) => RowanLoopStep;

export interface RowanLoopResolvers {
  conversation: RowanLoopOptionalResolver;
  pendingMove: RowanLoopOptionalResolver;
  commitment: RowanLoopOptionalResolver;
  objective: RowanLoopRequiredResolver;
}

type MaybePromise<T> = T | Promise<T>;

export interface RowanLoopStepHandlers<Result> {
  action: (loopStep: RowanLoopStep) => MaybePromise<Result>;
  blocked: (loopStep: RowanLoopStep) => MaybePromise<Result>;
  continueConversation: (loopStep: RowanLoopStep) => MaybePromise<Result>;
  idle: (loopStep: RowanLoopStep) => MaybePromise<Result>;
  move: (loopStep: RowanLoopStep) => MaybePromise<Result>;
  observe: (loopStep: RowanLoopStep) => MaybePromise<Result>;
  openConversation: (loopStep: RowanLoopStep) => MaybePromise<Result>;
  reflect: (loopStep: RowanLoopStep) => MaybePromise<Result>;
}

export const ROWAN_LOOP_LAYER_ORDER = [
  "conversation",
  "pendingMove",
  "commitment",
  "objective",
] as const;

export function resolveRowanLoopStep(
  world: StreetGameState,
  resolvers: RowanLoopResolvers,
): RowanLoopStep {
  return (
    resolvers.conversation(world) ??
    resolvers.pendingMove(world) ??
    resolvers.commitment(world) ??
    resolvers.objective(world)
  );
}

export function rowanAutonomyFromLoopStep(
  loopStep: RowanLoopStep,
): RowanAutonomyState {
  return {
    actionId: loopStep.actionId,
    autoContinue: loopStep.autoContinue,
    detail: loopStep.detail,
    effects: loopStep.effects,
    key: loopStep.key,
    label: loopStep.label,
    layer: loopStep.layer,
    mode: rowanLoopModeForStep(loopStep),
    npcId: loopStep.npcId,
    stepKind: loopStep.kind,
    targetLocationId: loopStep.targetLocationId,
  };
}

export function executeRowanLoopStep<Result>(
  loopStep: RowanLoopStep,
  handlers: RowanLoopStepHandlers<Result>,
): MaybePromise<Result> {
  switch (loopStep.kind) {
    case "idle":
      return handlers.idle(loopStep);
    case "blocked":
      return handlers.blocked(loopStep);
    case "reflect":
      return handlers.reflect(loopStep);
    case "talk":
      return loopStep.layer === "conversation"
        ? handlers.continueConversation(loopStep)
        : handlers.openConversation(loopStep);
    case "move":
      return handlers.move(loopStep);
    case "act":
    case "wait":
      return handlers.action(loopStep);
    case "observe":
      return handlers.observe(loopStep);
  }
}

export function rowanLoopModeForStep(
  loopStep: RowanLoopStep,
): RowanAutonomyState["mode"] {
  switch (loopStep.kind) {
    case "idle":
      return "idle";
    case "blocked":
      return "blocked";
    case "move":
      return "moving";
    case "wait":
      return "waiting";
    case "talk":
    case "reflect":
      return "conversation";
    default:
      return "acting";
  }
}
