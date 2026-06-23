export type ProblemRouteThoughtProblemId = "problem-cart" | "problem-pump";

export type ProblemRoutePlayerThoughtKind =
  | "inspect"
  | "missingTool"
  | "solve";

type ProblemRoutePlayerThoughts = Partial<
  Record<ProblemRoutePlayerThoughtKind, string>
>;

export type RecentConversationLeadThoughtKey =
  | "ada-shift-away"
  | "ada-shift-nearby"
  | "ada-yard-lead"
  | "jo-pump-has-wrench"
  | "jo-pump-needs-wrench"
  | "mara-ada-lead"
  | "mara-pump-away"
  | "mara-pump-nearby"
  | "mara-pump-needs-wrench"
  | "nia-cart-away"
  | "nia-cart-nearby"
  | "tea-lead-away"
  | "tomas-yard-away"
  | "tomas-yard-nearby";

export type NpcProblemThoughtKey =
  | "jo-pump-active-needs-wrench"
  | "mara-pump-active"
  | "mara-pump-solved"
  | "nia-cart-active";

const PROBLEM_ROUTE_PLAYER_THOUGHTS: Record<
  ProblemRouteThoughtProblemId,
  ProblemRoutePlayerThoughts
> = {
  "problem-cart": {
    inspect: "I should check that cart.",
    solve: "I need to move that cart.",
  },
  "problem-pump": {
    inspect: "I should check that pump.",
    missingTool: "I need a wrench first.",
    solve: "I should go fix that pump.",
  },
};

const RECENT_CONVERSATION_LEAD_THOUGHTS: Record<
  RecentConversationLeadThoughtKey,
  readonly string[]
> = {
  "ada-shift-away": [
    "If Rowan comes back, I hope he is ready for lunch.",
    "The room will show quickly whether he can keep pace.",
    "A steady pair of hands would still help if Rowan returns in time.",
  ],
  "ada-shift-nearby": [
    "If Rowan wants the shift, he can start with the cups.",
    "The room is busy, but there is space for steady hands.",
    "I gave Rowan the terms. Now he can decide.",
  ],
  "ada-yard-lead": [
    "If Rowan held up here, Tomas is the next place to try.",
    "The tea room was one kind of work. The yard will be another.",
    "Rowan can take this momentum to Tomas while the lead is fresh.",
  ],
  "jo-pump-has-wrench": [
    "The wrench part is done. The pump is the next bit.",
    "Once the wrench leaves my stall, the rest is patience.",
    "If Rowan bought the tool, he knows where to take it.",
  ],
  "jo-pump-needs-wrench": [
    "Either Rowan buys the wrench or finds another way to handle the leak.",
    "The pump is not getting fixed by talking at my bench.",
    "Eight coins is a lot when you are new. Still, it would help.",
  ],
  "mara-ada-lead": [
    "Ada is a good next stop if Rowan wants work.",
    "Rowan has enough to go ask Ada now.",
    "A clear lead is better than another hallway conversation.",
  ],
  "mara-pump-away": [
    "Maybe Rowan went to look at the pump.",
    "If Rowan follows through, the house gets quieter tonight.",
    "A useful promise usually turns into a short walk.",
  ],
  "mara-pump-nearby": [
    "The pump is still waiting.",
    "Rowan knows where to start now.",
    "A small repair would make the house easier today.",
  ],
  "mara-pump-needs-wrench": [
    "Mercer Repairs is the next stop if Rowan wants to handle the pump.",
    "The pump talk only matters if Rowan comes back with a tool.",
    "Rowan has a clear next errand now.",
  ],
  "nia-cart-away": [
    "Maybe Rowan caught the problem while it was still small.",
    "If Rowan listened, Quay Square might stay loose today.",
    "Someone moving the cart early would help.",
  ],
  "nia-cart-nearby": [
    "If Rowan sees the jam early, moving the cart is enough.",
    "The square will get noisy if Rowan waits too long.",
    "This is a small fix while it is still small.",
  ],
  "tea-lead-away": [
    "Maybe Rowan headed toward Kettle & Lamp after all.",
    "If Rowan keeps the lead warm, the tea house still makes sense.",
    "The next answer for Rowan is probably not here anymore.",
  ],
  "tomas-yard-away": [
    "If Rowan shows, put him on the load and keep it simple.",
    "If Rowan wants the shift, it is still here in the yard.",
    "A short shift will tell me enough.",
  ],
  "tomas-yard-nearby": [
    "If Rowan wants the coins, the load is right here.",
    "The work is right here. Rowan can start with the crates.",
    "The terms are clear enough now.",
  ],
};

const NPC_PROBLEM_THOUGHTS: Record<NpcProblemThoughtKey, readonly string[]> = {
  "jo-pump-active-needs-wrench": [
    "That wrench should move before long.",
    "Somebody's going to need that wrench today.",
    "That pump leak is good for tool sales.",
  ],
  "mara-pump-active": [
    "That pump is making the yard harder than it needs to be.",
    "I need that pump sorted before supper.",
    "A small leak becomes everyone's problem fast.",
  ],
  "mara-pump-solved": [
    "At least the yard is holding now.",
    "Good. That's one less house problem spreading.",
    "That fix bought the house some quiet.",
  ],
  "nia-cart-active": [
    "That cart is going to jam the square.",
    "Somebody needs to move that cart early.",
    "That bad wheel is going to jam things up.",
  ],
};

export function problemRoutePlayerThought(
  problemId: string,
  kind: ProblemRoutePlayerThoughtKind,
): string | undefined {
  return (
    PROBLEM_ROUTE_PLAYER_THOUGHTS as Partial<
      Record<string, ProblemRoutePlayerThoughts>
    >
  )[problemId]?.[kind];
}

export function recentConversationLeadThoughts(
  key: RecentConversationLeadThoughtKey,
): readonly string[] {
  return RECENT_CONVERSATION_LEAD_THOUGHTS[key];
}

export function npcProblemThoughts(
  key: NpcProblemThoughtKey,
): readonly string[] {
  return NPC_PROBLEM_THOUGHTS[key];
}
