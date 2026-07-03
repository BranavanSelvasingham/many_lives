import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { buildGenerateStreetThoughtsPrompt } from "../src/ai/prompts/generateStreetThoughts.js";
import { buildGenerateStreetAutonomousLinePrompt } from "../src/ai/prompts/generateStreetAutonomousLine.js";
import { buildGenerateStreetReplyPrompt } from "../src/ai/prompts/generateStreetReply.js";
import { buildInterpretStreetConversationPrompt } from "../src/ai/prompts/interpretStreetConversation.js";
import { buildPlainRowanContext } from "../src/ai/prompts/plainStreetConversationContext.js";
import {
  buildStreetConversationContext,
  buildDeterministicStreetReply,
} from "../src/ai/streetDialogue.js";
import {
  buildDeterministicStreetThoughts,
  sanitizeThought,
} from "../src/ai/streetThoughts.js";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import {
  buildGenericClosedWorkWindowConversationResolution,
  buildNpcConversationImpression,
  buildNpcConversationResolution,
  buildSocialNextNpcConversationResolution,
} from "../src/street-sim/npcNarratives.js";
import {
  objectiveRouteActionPressureScore,
  objectiveRouteHasNiaBlockLead,
  objectiveRouteCompletionIdleCopy,
  objectiveRouteCompletionRationale,
  objectiveRouteCompletionSummaryTail,
  objectiveRouteMoveIntent,
  objectiveRouteSemanticHints,
  objectiveRouteSemanticMoveBonus,
  objectiveRouteWorkStageWatchCopy,
  type ObjectiveScaffoldDirective,
} from "../src/sim/objectiveScaffolds.js";
import {
  buildFirstAfternoonCompletionContinueCopy,
  firstAfternoonMaraAdaLeadFieldNoteNextCopy,
} from "../../many-lives-web/src/lib/street/rowanFallbackNarrative.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import type {
  PlayerObjective,
  StreetGameState,
} from "../src/street-sim/types.js";

const FIRST_AFTERNOON_PLAN_RATIONALE =
  "Leave Morrow House, reach Kettle & Lamp, then ask Ada before lunch gets busy.";
const FIRST_AFTERNOON_DIALOGUE_FALLBACK =
  "Go to Kettle & Lamp before lunch and ask Ada if she still needs help. It is close, honest, and useful today.";
const FIRST_AFTERNOON_CLOSED_WORK_WINDOW_DIALOGUE_COPY = [
  "Ada's lunch window has already moved on. If you still need coin today, try Tomas at North Crane before the yard closes.",
  "Pay when you say you will, be kind in the shared spaces, and stop chasing Ada's lunch window. If coin still matters today, ask Tomas at North Crane.",
  "Lunch already moved on. I cannot pay you for a rush that finished without you, but Tomas may still need hands at North Crane.",
  "The cup-and-counter work is gone for today. Do not stand here pretending lunch waited.",
  "You kept up. Tomas by the yard may need another set of hands, and he's easier after someone else has already vouched for you.",
  "The loading block already moved. I cannot pay hands I did not have when the carts were here.",
];
const FIRST_AFTERNOON_CLOSED_WORK_WINDOW_DIALOGUE_CHOICE_KEYS = [
  "mara-work-tea-closed-yard-open",
  "mara-home-work-closed",
  "ada-work-tea-closed-yard-open",
  "ada-yard-handoff",
  "tomas-yard-next-step-closed",
  "tomas-yard-closed",
];
const FIRST_AFTERNOON_OPEN_WORK_WINDOW_DIALOGUE_COPY = [
  "Ask Ada at Kettle & Lamp before lunch. She always knows who could use an extra pair of hands.",
  "Kettle & Lamp may need help before the lunch crowd wanders in. Try Ada now.",
  "Start with Ada at Kettle & Lamp. She will tell you quickly if lunch needs help.",
  "Ada will set him straight kindly.",
  "That should be enough to start.",
  "A tea room is a gentle first step.",
  "Pay when you say you will, be kind in the shared spaces, and rinse your cup before it becomes everyone's cup. If you need coin today, ask Ada at Kettle & Lamp before lunch.",
  "Morrow House keeps people who make the place easier to wake up in. Ada may still need help through lunch if you want the room to feel less temporary.",
  "A room starts feeling like yours when you treat the house like it is partly yours too. Start with Ada at Kettle & Lamp if you need honest work today.",
  "That is the heart of it.",
  "Keep the house easy.",
  "A fair answer is enough.",
  "I could use help through lunch: clear cups, wipe tables, keep an eye on the counter. The shift pays fourteen if you can stay steady.",
  "Lunch is coming. Clear cups, wipe tables, listen the first time. Fourteen for the shift, and tea after if we both survive it.",
  "I can use steady hands through lunch. It is simple work, and it pays fourteen.",
  "He might manage the room.",
  "Steady is plenty.",
  "Tea after, if he survives lunch.",
  "Take the short loading block if you want it. Start with the lighter crates by the bay, keep the cart lane clear, and I will pay twenty-four when the run is done.",
  "First thing is simple: stack the small crates by the service bay and leave the handcart lane open. Twenty-four when it is done.",
  "If you are in, start with the crates nearest the bay door. Keep the lane clear for the handcart, finish the run, and the pay is twenty-four.",
  "That is clear enough.",
  "Crates first, then pay.",
  "He gave the actual job.",
  "Short loading block by the yard. Twenty-four coins if you keep the cart lane clear and stack the lighter crates by the bay.",
  "One loading block. Keep up, finish clean, and I pay twenty-four. Start with the crates by the service bay.",
  "The yard needs another set of hands for a short run. Twenty-four if you can start with the bay crates now.",
  "Keep it simple.",
  "He either lifts or he doesn't.",
  "The path can stay clear.",
];
const FIRST_AFTERNOON_OPEN_WORK_WINDOW_DIALOGUE_CHOICE_KEYS = [
  "mara-work",
  "mara-work-followup",
  "mara-home",
  "mara-home-followup",
  "ada-work-open",
  "ada-work-open-followup",
  "tomas-yard-next-step",
  "tomas-yard-next-step-followup",
  "tomas-yard-offer",
  "tomas-yard-offer-followup",
];
const PROBLEM_ROUTE_DIALOGUE_COPY = [
  "You've already got the wrench. Good. Go slow and do not force the old metal.",
  "You have the wrench. Try the fitting gently first, then tighten only what moves cleanly.",
  "The wrench is the easy part. Take your time with the pump.",
  "Old wrench, eight coins. It is ugly, but it works.",
  "Eight coins for the wrench. It has handled worse than that pump.",
  "Eight coins gets you the wrench I would use myself.",
  "That wrench has another morning in it.",
  "The price is fair.",
  "Old metal, new hands.",
  "Square's clear again. Nicely done before everyone had to complain about it.",
  "That jam's gone. Good. The square feels lighter already.",
  "The square loosened up. Small fix, big difference.",
  "That split-wheel cart will jam Quay Square once foot traffic picks up. Move it early and everyone has an easier day.",
  "That cart will block the square if nobody moves it before the lunch crowd drifts in.",
  "Move the cart while it is still a small problem.",
  "That cart needs moving before lunch.",
  "The square wants an easier day.",
  "Small jams get loud fast.",
];
const PROBLEM_ROUTE_DIALOGUE_CHOICE_KEYS = [
  "jo-tool-owned",
  "jo-tool-sell",
  "jo-tool-followup",
  "nia-cart-solved",
  "nia-cart-active",
  "nia-cart-followup",
];
const PROBLEM_TOOL_OUTCOME_COPY = [
  "The jammed cart has not been inspected yet.",
  "The jammed cart got worse before anyone cleared it.",
  "The jammed cart is still active.",
  "The pump problem has not been inspected yet.",
  "The pump got away before the tool mattered.",
  "Rowan does not have a wrench yet.",
  "Wrench in inventory.",
  "The pump was already contained by the house.",
  "The pump got away before anyone contained it.",
  "The pump is still active.",
  "The pump needs a wrench before Rowan can solve it.",
  "The tool has not reached the problem yet.",
  "The target problem got worse before the tool reached it.",
  "The target problem is still active.",
  "The target problem needs the right tool first.",
];
const PASSIVE_PROBLEM_PRESSURE_COPY = [
  "The jammed cart has started pinching the square instead of waiting politely at the edge.",
  "Quay Square's cart problem grew sharper while Rowan spent the hour elsewhere.",
  "By late afternoon the cart jam is no longer a small nuisance; everyone crossing the square has to work around it.",
  "The square remembered that nobody moved on the cart before it became public friction.",
  "The Morrow Yard pump has started spreading water across the stones while Rowan is elsewhere.",
  "The pump did not wait for Rowan's route; by early afternoon it had become harder to ignore.",
  "The pump leak is turning house trouble into a shared headache before evening.",
  "Morrow House's pump problem kept worsening on its own while the day moved forward.",
  "The Morrow Yard pump was left until evening and turned into house strain.",
  "By evening the Morrow Yard pump stopped being a small fix and became house strain Rowan has to live with.",
  "Ignoring the pump cost Rowan standing at Morrow House.",
  "The square had to route itself around the jammed cart after nobody cleared it in time.",
  "The handcart jam hardened into a square-wide nuisance before Rowan moved on it.",
  "The square remembered that the cart problem was left until it slowed everybody down.",
  "Mara contained the pump herself after the house waited as long as it could.",
  "Mara got the pump contained before evening, but Morrow House had to solve that strain without Rowan.",
  "The pump did not wait for Rowan's route. Mara contained it herself, and the house noticed.",
  "Nia cleared the handcart after the square got tired of bending around it.",
  "Nia got the jammed handcart rolling while Rowan was elsewhere; the square solved that one without him.",
  "The jammed cart did not wait for Rowan. Nia cleared it once the square pressure peaked.",
];
const ACTIVE_PROBLEM_ACTION_COPY = [
  "The split wheel on the handcart is already starting to jam foot traffic through the square.",
  "You got the jammed handcart rolling again and the square paid you ${rewardMoney} to stop being in everybody's way.",
  "You learned that even small street problems become reputation if you solve them before they spread.",
  "Up close, the pump in Morrow Yard is one wrench-turn away from either a fix or a worse leak.",
  "You tightened the pump in Morrow Yard, slowed the leak, and Mara pressed ${rewardMoney} into your hand before the stones flooded again.",
  "Morrow House started to remember you as someone who fixes shared trouble instead of adding to it.",
];
const PASSIVE_JOB_OUTCOME_COPY = [
  "Ada's lunch window moved on without Rowan; the room learned to solve the rush without him.",
  "Rowan let the lunch rush move on without committing steady hands.",
  "You missed Ada's lunch window, so that paid foothold is no longer waiting.",
  "North Crane Yard finished its loading block without Rowan, and Tomas has less reason to hold space for him next time.",
  "Rowan missed the loading block after the yard had already made room for him.",
  "You missed the freight yard loading block, closing that work window for the day.",
  "Tomas closed the loading block with his own crew after Rowan left the yard waiting.",
  "Tomas got the North Crane Yard load out with his own crew; Rowan gets no pay or credit from that work.",
  "Tomas did not hold the freight yard load for Rowan; the work moved without him and closed that window.",
  "Tomas closed the loading block with his own crew before Rowan ever came asking.",
];
const ACTIVE_JOB_WORK_COPY = [
  "Lunch starts to fill Kettle & Lamp. Rowan clears cups, wipes tables, and learns where Ada points before she has to say it twice.",
  "Rowan started the lunch rush at Kettle & Lamp by keeping the small things moving.",
  "The rush crests. Rowan keeps the counter moving, catches a tray before it tips, and Ada gives one small nod that counts.",
  "Ada trusts steady hands more than big promises.",
  "That was tiring, but it turned an afternoon into proof. I should go back to Morrow House and let it land.",
  "Rowan finishes {jobTitle} and earns ${pay}. Ada says the room stayed easier because he kept up.",
  "The yard paid, and now I need to look at what the house had to handle while I was here.",
  "You finished {jobTitle} and earned ${pay}. The yard will remember you as someone who stayed until the load was done.",
  "You finished {jobTitle} and took your pay while the block was still moving.",
  "Rowan kept {jobTitle} moving until the city changed around him; the work is still in hand.",
  "Rowan started {jobTitle} before the window closed and still needs to finish it.",
  "Choosing the freight-yard lift paid Rowan, but it left the Morrow Yard pump for Mara to contain without him.",
  "Rowan chose paid yard work while the pump was still live, so Mara contained the house strain herself.",
];
const JO_MONEY_WORK_DIALOGUE_COPY = [
  "I sell repairs, not shifts.",
  "Around ${nearbyPlaceName}",
  "A decent tool can still save your afternoon.",
  "Paid work is elsewhere. If the pump is your problem, the wrench is the practical part.",
  "If the money is tight, spend it only when you know what it helps you fix.",
  "He can take his time.",
  "The wrench is simple enough.",
  "A calm decision is fine.",
];
const JO_MONEY_WORK_DIALOGUE_CHOICE_KEYS = [
  "jo-money-work",
  "jo-money-work-followup",
];
const MARA_ADA_GROUNDING_FOLLOWUP =
  "Just to be clear, should I ask Ada at Kettle & Lamp about lunch work before the rush?";
const MARA_ADA_GROUNDED_FALLBACK_REPLY =
  "Morrow House can hold you tonight, but a foothold needs work. Ask Ada at Kettle & Lamp before lunch; she may need steady hands for the cup-and-counter shift.";
const MARA_ADA_GROUNDING_FALLBACK_MEMORY =
  "Mara's answer was not specific enough yet to turn Ada into a grounded work lead.";
const MARA_ADA_GROUNDING_FALLBACK_SUMMARY =
  "Mara has not yet made the Kettle & Lamp lead visible in the conversation.";
const MARA_ADA_REQUIRED_PROMPT_LINE =
  "- Required for this Mara reply: visibly ground the work lead by naming Ada, Kettle & Lamp, and lunch work, shift, hands, counter, or pay.";
const MARA_ADA_PROMPT_OVERRIDE_LINE =
  "- This requirement overrides the general route-command caution; the player must see the Ada/Kettle & Lamp/lunch-work evidence before the sim can treat the lead as real.";
const MARA_ADA_GROUNDED_PROMPT_LINE =
  "- Rowan's line already names the exact Ada/Kettle & Lamp/lunch-work lead. Answer plainly whether Mara confirms it.";
const NPC_FIRST_CONTACT_PRIMER_COPY = [
  "Mara gives you a measured look, like she's deciding whether you're here for a bed, for work, or just to stop feeling new.",
  "Mara weighs newcomers by whether they settle in, pull their weight, or disappear.",
  "Ada glances over like the room is already filling, but there is still a little welcome in it.",
  "Ada offers work when she thinks someone can keep the tea room easy through lunch.",
  "Jo looks up from the bench with the kind of patience that expects you to get to the point.",
  "Jo prices things fairly enough that you notice.",
  "Tomas glances at your shoulders, not your face, like talk only matters if it turns into labor.",
  "Tomas thinks in loads, time windows, and whether you slow the rest of the yard down.",
  "Nia watches the square while she talks to you, like she expects the next important detail to arrive mid-sentence.",
  "Nia notices small jams before the whole block has to notice them.",
];
const NPC_CONVERSATION_RESOLUTION_COPY = [
  "get to Mercer Repairs for a wrench, then come back to the pump.",
  "Mara made it plain that fixing the pump would make the house easier for everyone.",
  "get to Kettle & Lamp before lunch gets busy and ask Ada for work.",
  "Mara trusts follow-through more than worry, and Ada is the nearest honest place to start.",
  "skip the closed lunch lead and ask Tomas while the yard window is still live.",
  "Ada closed the lunch option instead of holding a stale shift open, then pointed Rowan toward the yard.",
  "stay with Ada and take the tea-house shift if the room still needs the hands.",
  "Ada made the noon shift sound simple, but only if you can keep up once the room gets hot.",
  "decide whether Jo's wrench is worth the eight coins, then take it where it matters.",
  "Jo made the wrench feel less like a purchase and more like a decision about whether you'll actually use it.",
  "Tomas did not reopen the loading block after the yard had already moved without Rowan.",
  "stay near the yard and take the loading shift if the pay and timing still work.",
  "swing through Quay Square and clear the cart before the foot traffic swells.",
  "Nia keeps seeing the small jams that become the whole block's problem if nobody moves first.",
  "Ask Nia where the block is about to jam before the square feels it.",
  "Rowan might keep pace when the cafe fills up.",
  "Rowan paid attention to where the block might jam up.",
];
const NPC_INNER_STATE_NARRATIVE_COPY = [
  "Keep the house from turning Rowan's absence into the whole story.",
  "Get eyes on Morrow Yard before the pump turns house strain into rent talk.",
  "The pump is contained, but the house had to handle it without Rowan.",
  "The pump is not a future worry anymore; the house is already paying for it.",
  "That pump is turning house trouble public.",
  "Keep the house from slipping into rent talk.",
  "Decide whether this newcomer means strain, help, or maybe a future here.",
  "Lunch already had to run without the hands Rowan could have offered.",
  "The room needs speed, not apologies.",
  "Keep the room from falling behind the cups.",
  "Mara already contained the leak; the wrench is no longer the live bottleneck.",
  "That wrench should leave the bench before dusk.",
  "The load moved without Rowan, which says plenty in a working yard.",
  "That lift needs finishing clean.",
  "Keep the yard moving without rushing anyone into a mistake.",
  "Stay with Quay Square until the jam stops bending everybody's route.",
  "The square is moving again, but it had to handle the cart itself.",
  "The square already spent the afternoon working around a problem that could have moved sooner.",
  "That jam in Quay Square is about to become everybody's problem.",
  "Watch what comes off the boats before the story gets retold.",
];
const STREET_THOUGHT_NARRATIVE_COPY = [
  "I need a wrench first.",
  "I should go fix that pump.",
  "I should check that pump.",
  "I need to move that cart.",
  "I should check that cart.",
  "Mercer Repairs is the next stop if Rowan wants to handle the pump.",
  "The pump talk only matters if Rowan comes back with a tool.",
  "Rowan has a clear next errand now.",
  "The pump is still waiting.",
  "Rowan knows where to start now.",
  "A small repair would make the house easier today.",
  "Maybe Rowan went to look at the pump.",
  "If Rowan follows through, the house gets quieter tonight.",
  "A useful promise usually turns into a short walk.",
  "Ada is a good next stop if Rowan wants work.",
  "Rowan has enough to go ask Ada now.",
  "A clear lead is better than another hallway conversation.",
  "If Rowan wants the shift, he can start with the cups.",
  "The room is busy, but there is space for steady hands.",
  "I gave Rowan the terms. Now he can decide.",
  "If Rowan comes back, I hope he is ready for lunch.",
  "The room will show quickly whether he can keep pace.",
  "A steady pair of hands would still help if Rowan returns in time.",
  "If Rowan held up here, Tomas is the next place to try.",
  "The tea room was one kind of work. The yard will be another.",
  "Rowan can take this momentum to Tomas while the lead is fresh.",
  "The wrench part is done. The pump is the next bit.",
  "Once the wrench leaves my stall, the rest is patience.",
  "If Rowan bought the tool, he knows where to take it.",
  "Either Rowan buys the wrench or finds another way to handle the leak.",
  "The pump is not getting fixed by talking at my bench.",
  "Eight coins is a lot when you are new. Still, it would help.",
  "If Rowan wants the coins, the load is right here.",
  "The work is right here. Rowan can start with the crates.",
  "The terms are clear enough now.",
  "If Rowan shows, put him on the load and keep it simple.",
  "If Rowan wants the shift, it is still here in the yard.",
  "A short shift will tell me enough.",
  "If Rowan sees the jam early, moving the cart is enough.",
  "The square will get noisy if Rowan waits too long.",
  "This is a small fix while it is still small.",
  "Maybe Rowan caught the problem while it was still small.",
  "If Rowan listened, Quay Square might stay loose today.",
  "Someone moving the cart early would help.",
  "Maybe Rowan headed toward Kettle & Lamp after all.",
  "If Rowan keeps the lead warm, the tea house still makes sense.",
  "The next answer for Rowan is probably not here anymore.",
  "That pump is making the yard harder than it needs to be.",
  "I need that pump sorted before supper.",
  "A small leak becomes everyone's problem fast.",
  "At least the yard is holding now.",
  "Good. That's one less house problem spreading.",
  "That fix bought the house some quiet.",
  "That wrench should move before long.",
  "Somebody's going to need that wrench today.",
  "That pump leak is good for tool sales.",
  "That cart is going to jam the square.",
  "Somebody needs to move that cart early.",
  "That bad wheel is going to jam things up.",
];
const FIRST_AFTERNOON_RETURN_HOME_THOUGHT =
  "I should head back to Morrow House and let today land.";
const FIRST_AFTERNOON_TEA_RUSH_THOUGHT =
  "The room is filling. Cups first, tables second, keep moving.";
const FIRST_AFTERNOON_TEA_COUNTER_THOUGHT =
  "Ada is not watching every step now. That probably means I am keeping up.";
const FIRST_AFTERNOON_TEA_SHIFT_WATCH_COPY = [
  "Start the lunch rush",
  "Lunch is filling Kettle & Lamp. Rowan can start with cups, tables, and the counter.",
  "Keep the lunch rush moving",
  "The room is busy now. Rowan can keep clearing cups and watching Ada's rhythm.",
  "Finish the cup-and-counter shift",
  "The rush is almost through. Rowan can finish the last counter pass and collect the pay.",
];
const FIRST_AFTERNOON_COMPLETION_FEED =
  "Rowan closes the first-afternoon note and lets tomorrow's lead compete with the live work and trouble still moving around South Quay.";
const FIRST_AFTERNOON_COMPLETION_MEMORY =
  "After the first afternoon was recorded, Rowan treated the next move as a fresh choice from live work, rest, and local trouble instead of replaying the old route.";
const FIRST_AFTERNOON_COMPLETION_IDLE_LABEL = "First afternoon complete";
const FIRST_AFTERNOON_COMPLETION_IDLE_DETAIL =
  "Good stopping point: tonight's bed still holds, $14 is in Rowan's pocket, Ada knows he can keep up, and tomorrow has a real lead.";
const FIRST_AFTERNOON_COMPLETION_RATIONALE =
  "First afternoon complete: Rowan has a bed, pay, Ada's trust, and a real lead for tomorrow.";
const FIRST_AFTERNOON_COMPLETION_SUMMARY_TAIL =
  "The first afternoon is complete: room to return to, paid shift, and a real foothold.";
const FIRST_AFTERNOON_COMPLETED_OBJECTIVE_BANNER_RATIONALE =
  "This is a natural stopping point: the objective is complete and Rowan has enough from today to sleep on.";
const FIRST_AFTERNOON_COMPLETION_PLAYER_THOUGHT =
  "Tonight's bed holds. I earned real money, and tomorrow has a lead.";
const FIRST_AFTERNOON_COMPLETION_OUTCOME_PLAYER_THOUGHT =
  "Tonight's bed still holds. I earned real money, Ada knows I can keep up, and the pump in Morrow Yard is not just background noise anymore. That is enough for a first afternoon.";
const FIRST_AFTERNOON_COMPLETION_OUTCOME_FEED =
  "Rowan takes stock at Morrow House: tonight's bed still holds, $14 is in his pocket, Ada has seen him keep up, and the Morrow Yard pump is now a real local problem instead of background noise.";
const FIRST_AFTERNOON_COMPLETION_OUTCOME_MEMORY =
  "You finished the first afternoon with a room to return to, paid work, and a small foothold in South Quay. Taking stock also made the Morrow Yard pump impossible to ignore.";
const FIRST_AFTERNOON_PLAN_ACTION_DESCRIPTION =
  "Commit to leaving Morrow House and following Mara's lead to Ada at Kettle & Lamp.";
const FIRST_AFTERNOON_PUMP_ACTION_DESCRIPTION =
  "Treat the leaking pump as the first proof that Rowan notices what the house needs.";
const FIRST_AFTERNOON_COMPARE_ACTION_DESCRIPTION =
  "Keep Ada's offer in view while checking the pump, the square, or another lead before committing.";
const FIRST_AFTERNOON_COMPLETION_ACTION_DESCRIPTION =
  "Count what changed today before chasing another errand.";
const FIRST_AFTERNOON_PLAN_AND_FIELD_NOTE_COPY = [
  "Mara gave me live choices: chase Ada's lunch work, deal with the pump, rest, or make myself useful here. Ada is the best first bet before the noon window closes.",
  "Rowan weighs the first move against the live state of the block and chooses Ada before the lunch window closes.",
  "Step inside Morrow House before settling that plan.",
  "When the first afternoon opened up, Rowan treated Ada's lunch work as the best first move, not the only possible route.",
  "The pump is not glamorous, but solving house trouble is one way to make tonight's bed feel less borrowed.",
  "Rowan chooses the Morrow Yard pump as the first proof that he notices what the house needs.",
  "Step inside Morrow House before weighing that lead.",
  "Rowan chose the pump over the obvious work lead because the house itself had a live problem.",
  "Fix the leaking pump in Morrow Yard before it spreads.",
  "Ada's shift is real, but it sits beside the pump, the house, and whatever else is moving through the square.",
  "Rowan keeps Ada's offer in view while checking whether another current opening should come first.",
  "Step inside Kettle & Lamp before comparing Ada's offer.",
  "Compare the live work offer with the pump, the square, and any better lead before committing.",
  "Rowan did not treat Ada's offer as a script; he paused to compare it against the live state of the block.",
  "Bring Rowan back to Morrow House before calling the first afternoon done.",
  "There is still no paid shift to count. Rowan needs one real follow-through first.",
  "The first afternoon is already settled.",
  "Asked Ada at Kettle & Lamp at",
  "Worked ${normalizedTitle} at Kettle & Lamp and got paid",
  "Ada needed steady lunch help, and Rowan could keep Kettle & Lamp moving when the room filled up.",
  "Ada remembers Rowan asked directly, stayed through the rush, and took his pay without making the room harder.",
  "Rest on the first foothold, then choose between the yard work window and the Morrow Yard pump before the city moves on without Rowan.",
  "Mara's Kettle & Lamp lead is real: Ada needs steady lunch help today.",
  "Ada remembers Rowan asked directly before the lunch rush instead of waiting for work to find him.",
  "Ada's offer is now a current choice: take the cup-and-counter shift, compare another opening, or deliberately walk away before the window closes.",
  "Rowan records the lead as grounded knowledge: Ada at Kettle & Lamp has real lunch work on the table.",
  "You verified Mara's lead at Kettle & Lamp: Ada needs steady lunch help and offered the cup-and-counter shift.",
];
const WEB_FIRST_AFTERNOON_FALLBACK_COPY = [
  "Rowan is stepping inside Morrow House to ask Mara.",
  "Rowan is turning Mara's lead toward Kettle & Lamp.",
  "Enter Morrow House and ask Mara.",
  "Let Mara's lead about Ada and Kettle & Lamp land.",
  "Let Mara's lead land.",
  "Let Ada answer whether the lunch shift is real.",
  "Let Ada's answer land.",
  "Mara's lead verified",
  "Ada's offer is live: take the cup-and-counter shift, compare another real pressure, or deliberately walk away.",
  "Mara's lead is verified: Ada at Kettle & Lamp has real lunch work on the table.",
  "Mara's lead points to Ada at Kettle & Lamp; lunch work is the best first bet.",
  "Close the field note, then weigh rest, the yard window, and the Morrow Yard pump.",
];
const PLAYBACK_NIA_BLOCK_POLICY_ID =
  "nia-block-lead-hides-morrow-standing";
const FIRST_AFTERNOON_ROUTE_OUTCOME_LABEL = "Useful first move chosen";
const FIRST_AFTERNOON_ROUTE_STEP_TITLE = "Choose the first useful move.";
const FIRST_AFTERNOON_ROUTE_STEP_DETAIL =
  "Rowan could wander, rest, or ask Ada. Ada is the useful first bet.";
const FIRST_AFTERNOON_ROUTE_COMPLETION_DETAIL =
  "Tonight's bed still holds, $14 is in Rowan's pocket, Ada has seen him keep up, and tomorrow has a real lead.";
const MARA_ADA_ROUTE_OUTCOME_LABEL = "Ada verification intent formed";
const MARA_ADA_ROUTE_STEP_TITLE = "Form the plan to verify it directly.";
const MARA_ADA_ROUTE_STEP_DETAIL =
  "Make the plan explicit: walk to Kettle & Lamp and ask Ada about lunch work.";
const MARA_ADA_ROUTE_COMPLETION_DETAIL =
  "The offer is now actionable: take the shift, check another lead, return later, or keep exploring.";
const MARA_ADA_ROUTE_HEADLINE =
  "Verify Mara's Kettle & Lamp lead and turn it into a real choice.";
const WORK_ROUTE_COMMIT_OUTCOME_LABEL = "Paid work committed";
const WORK_ROUTE_YARD_STEP_TITLE =
  "Take the freight-yard lift before the window closes.";
const WORK_ROUTE_TEA_STEP_DETAIL = "Ada likes speed more than speeches.";
const WORK_ROUTE_PAY_STEP_DETAIL =
  "Work only matters if it buys more than the next hour.";
const WORK_ROUTE_TEA_HEADLINE =
  "Secure paid work at Kettle & Lamp and follow through.";
const WORK_ROUTE_YARD_HEADLINE = "Secure paid yard work and follow through.";
const SETTLE_ROUTE_TERMS_OUTCOME_LABEL = "Room terms understood";
const SETTLE_ROUTE_STANDING_OUTCOME_LABEL = "Morrow House standing built";
const SETTLE_ROUTE_LEAD_OUTCOME_LABEL = "Tea-house work lead confirmed";
const SETTLE_ROUTE_TERMS_STEP_TITLE_ANCHOR = "Lock in my stay at";
const SETTLE_ROUTE_TERMS_STEP_DETAIL =
  "Mara can walk Rowan through exactly what it takes to keep a room here.";
const SETTLE_ROUTE_STANDING_STEP_DETAIL =
  "Now that Rowan knows the terms, he needs to show up, help out, and make the house easier to run.";
const SETTLE_ROUTE_YARD_STEP_TITLE =
  "Line up one solid work lead at North Crane Yard.";
const SETTLE_ROUTE_INCOME_STEP_TITLE = "Turn that lead into steady pay.";
const SETTLE_ROUTE_PEOPLE_STEP_TITLE = "Build two real connections.";
const SETTLE_ROUTE_HEADLINE =
  "Get settled in Brackenport: find a place to stay, steady income, and a few friends.";
const PEOPLE_ROUTE_OUTCOME_LABEL = "Local introduction made";
const PEOPLE_ROUTE_STEP_TITLE = "Give somebody a reason to remember me well.";
const PEOPLE_ROUTE_STEP_DETAIL =
  "A real introduction makes the block feel less faceless.";
const PEOPLE_ROUTE_HEADLINE =
  "Meet people who could become real friends in South Quay.";
const EXPLORE_ROUTE_OUTCOME_LABEL = "Unknown place visited";
const EXPLORE_ROUTE_STEP_TITLE = "Learn what the place is really for.";
const EXPLORE_ROUTE_STEP_DETAIL =
  "A new corner is usually easier to understand once you stand in it.";
const EXPLORE_ROUTE_HEADLINE = "Learn the lanes and people of South Quay.";
const COMMITTED_JOB_ROUTE_OUTCOME_LABEL_SUFFIX = "site reached";
const COMMITTED_JOB_ROUTE_STEP_DETAIL =
  "A live commitment should be the first thing Rowan can actually cash in.";
const COMMITTED_JOB_ROUTE_WINDOW_DETAIL =
  "The block only keeps a shift open for so long.";
const COMMITTED_JOB_ROUTE_HEADLINE =
  "Follow through on accepted work before the window closes.";
const REST_ROUTE_OUTCOME_LABEL = "Recovered with an hour of rest";
const REST_ROUTE_RETURN_DETAIL =
  "Rowan needs a safe pause before the next live opening costs him tired mistakes.";
const REST_ROUTE_HOUR_DETAIL =
  "The point is to stop fighting the block long enough to get your legs back.";
const REST_ROUTE_HEADLINE =
  "Recover enough at Morrow House to move cleanly again.";
const REST_ROUTE_DEFAULT_TEXT = "Recover enough to move cleanly again.";
const ADA_LEAD_OUTCOME_MOVE_RATIONALE =
  "Mara's lead points to Ada at Kettle & Lamp before lunch fills the room";
const BAD_ADA_AT_MORROW_PLAYER_RATIONALE =
  "Mara's lead points to Ada at Kettle & Lamp, so Rowan needs to leave Morrow House and reach the cafe first";
const ADA_AT_MORROW_ACTION_REASON =
  "Mara's lead points to Ada at Kettle & Lamp, so Rowan has to reach the cafe before asking.";
const FIRST_AFTERNOON_LOW_ENERGY_OUTCOME_MOVE_RATIONALE =
  "The shift paid, and Rowan is tired enough that Morrow House is the right place to let the day land";
const FIRST_AFTERNOON_NORMAL_ENERGY_OUTCOME_MOVE_RATIONALE =
  "The shift paid, and Morrow House is the right place to let the day land";
const FIRST_AFTERNOON_LOW_ENERGY_PLAYER_RATIONALE =
  "the shift paid, and Rowan is tired enough that Morrow House is the right place to let the day land";
const FIRST_AFTERNOON_NORMAL_ENERGY_PLAYER_RATIONALE =
  "the shift paid, and Morrow House is the right place to let the day land";
const TEA_SHIFT_OUTCOME_MOVE_RATIONALE =
  "Ada gave Rowan real work, and the room needs steady hands now";
const NIA_RECOVERY_PLAYER_RATIONALE =
  "Rowan is too worn down to make Nia's lead stick, so he needs a short recovery before the block jam gets worse";
const NIA_STANDING_PLAYER_RATIONALE =
  "Jo's clue points toward Nia now, so Rowan needs South Quay before the block jam gets worse";
const MORROW_STANDING_LOW_ENERGY_PLAYER_RATIONALE =
  "Morrow House is where Rowan can let today's standing settle before he runs himself flat";
const MORROW_STANDING_NORMAL_ENERGY_PLAYER_RATIONALE =
  "Morrow House is where today's standing can turn into a steadier foothold";
const HOME_RETURN_MOVE_REASON_COPY = [
  "recover enough to move cleanly, keep tonight's room safe, and let Ada's field-note standing land before choosing the yard work, pump, or another current opening.",
  "recover enough to move cleanly before taking another commitment.",
  "take stock after the paid shift, keep tonight's room safe, and decide what the pump or next work window requires.",
  "keep tonight's room safe and turn today's standing into a steadier foothold.",
];
const CURRENT_OPENING_MOVE_REASON_COPY = [
  "put the wrench to the live pump before the house has to absorb the strain.",
  "check the live pump pressure before it becomes house strain.",
  "house problem needs eyes before Rowan commits the recovered hour elsewhere.",
  "check the paid yard work window",
  "with his recovered energy.",
];
const AUTONOMOUS_OPENING_AND_FOLLOWUP_COPY = [
  "I'm Rowan. New in Brackenport. I'm looking for a room, a little work, and a few friendly faces. Where should I start?",
  "I'm Rowan. I heard lunch might still need hands. Is that still true?",
  "I'm Rowan. I'm looking for work. Still need another set of hands in the yard?",
  "I'm trying to fix the pump. What tool actually gets it done?",
  "I need the right tool for this. What would actually help me today?",
  "I'm running thin. Is there anything here that can't wait until I get my legs back?",
  "Who on this block is worth meeting properly if I'm trying to find my footing?",
  "I'm still learning South Quay. What should I look at before I miss it?",
  "Got it. Anything I should know before I ask Ada?",
  "If I take it, what do you need me to move first?",
  "When does that cart turn from nuisance into a real jam?",
  "What should I notice if I'm trying to read this place properly?",
  "Who should I see after you if I'm trying to get my feet under me here?",
  "So if the work is not here, where should I try next?",
  "If I spend the coin, what does it actually unlock for me?",
  "What am I still missing about this block?",
  "What can wait until I've got my legs back under me?",
];
const ROWAN_NOTEBOOK_FIELD_NOTE_UNCERTAINTY =
  "Which current opening deserves Rowan's recovered hour: North Crane Yard work, the Morrow Yard pump, or another lead?";
const ROWAN_NOTEBOOK_JO_TOOLS_UNCERTAINTY =
  "Which local problem is worth spending scarce money on?";
const ROWAN_NOTEBOOK_NIA_UNCERTAINTY =
  "What does Nia know about the block before it jams?";
const ROWAN_NOTEBOOK_PUMP_UNCERTAINTY =
  "Can Rowan turn a small fix into a real local foothold?";
const ROWAN_NOTEBOOK_NIA_RECOVERY_PLAN =
  "Recover before following Nia's block-jam lead.";
const ROWAN_NOTEBOOK_RECOVERY_PLAN =
  "Rest at Morrow House long enough to recover, then choose the yard work, pump, or current opening that still matters.";
const ROWAN_NOTEBOOK_PUMP_PLAN =
  "Handle the Morrow Yard pump before the house has to absorb it without Rowan.";
const ROWAN_NOTEBOOK_YARD_PLAN =
  "Ask Tomas before the North Crane Yard freight window closes.";
const ROWAN_NOTEBOOK_STALE_ENTRY_FALLBACK = "Ask the first useful question.";
const ROWAN_NOTEBOOK_FIELD_NOTE_CLUE =
  "Evidence: Ada's field note says Rowan asked directly, stayed through lunch, and left Kettle & Lamp with pay and a clearer obligation.";
const ROWAN_NOTEBOOK_YARD_CLUE =
  "Evidence: Tomas described paid yard work at North Crane Yard, and the freight window is the obligation Rowan can still try to meet.";
const ROWAN_NOTEBOOK_PUMP_WITH_TOOL_CLUE =
  "Evidence: the Morrow Yard pump is active, and Rowan already has the wrench that can make the repair real.";
const PLAYBACK_HOME_REST_POLICY_ID = "home-rest-location";

function worldWithPoisonedTrail(): StreetGameState {
  const world = seedStreetGame("game-reasoning-poisoned-trail");
  const currentObjective = world.player.objective as PlayerObjective;

  world.player.currentLocationId = "boarding-house";
  world.player.knownNpcIds = Array.from(
    new Set([...world.player.knownNpcIds, "npc-mara"]),
  );
  world.player.objective = {
    ...currentObjective,
    focus: "settle",
    outcomes: [
      {
        authority: "predicate",
        id: "live-room-standing",
        label: "Ask Mara what keeps the Morrow House room stable",
        npcId: "npc-mara",
        status: "open",
        targetLocationId: "boarding-house",
        urgency: 96,
      },
    ],
    progress: {
      completed: 0,
      label: "0/1 outcomes met",
      total: 1,
    },
    trail: [
      {
        detail:
          "This poisoned route hint should stay scaffolding and must not become Rowan's plan.",
        done: false,
        id: "poisoned-route-hint",
        targetLocationId: "pier",
        title: "Follow the stale route to the old pier",
      },
    ],
  };
  world.rowanAutonomy = {
    autoContinue: true,
    detail: "Mara is here, so Rowan can ask the question in person.",
    intent: {
      reason: "Mara is here, so Rowan can ask the question in person.",
      signals: [
        "Goal: Ask Mara what keeps the Morrow House room stable",
        "Target: Morrow House",
      ],
    },
    key: "objective:talk:mara",
    label: "Talk to Mara",
    layer: "objective",
    mode: "conversation",
    npcId: "npc-mara",
    stepKind: "talk",
    targetLocationId: "boarding-house",
  };
  world.availableActions = [
    {
      description: "Ask Mara what actually keeps the room stable.",
      emphasis: "high",
      id: "talk:npc-mara",
      kind: "talk",
      label: "Talk to Mara",
      matchesObjective: true,
      targetLocationId: "boarding-house",
    },
    {
      description: "The stale route hint is not a legal current-state action.",
      disabled: true,
      disabledReason: "Rowan has no current reason to go to the old pier.",
      emphasis: "low",
      id: "move:pier",
      kind: "inspect",
      label: "Head to the old pier",
      matchesObjective: false,
      targetLocationId: "pier",
    },
  ];

  return world;
}

function worldWithStaleFirstAfternoonThoughtAndLivePump(): StreetGameState {
  const world = seedStreetGame("game-reasoning-stale-first-afternoon-thought");

  world.player.currentLocationId = "boarding-house";
  world.player.inventory.push({
    description: "A worn wrench that can handle the yard pump.",
    id: "item-wrench",
    name: "Old wrench",
  });
  world.firstAfternoon = {
    completedAt: world.currentTime,
    fieldNote: {
      createdAt: world.currentTime,
      evidence: "Rowan already finished the first afternoon route.",
      learned: "The original first-afternoon loop is complete.",
      memory: "The old route should not control later thought.",
      next: "Follow the live problem instead.",
    },
    teaShiftStage: "paid",
  };

  const pump = world.problems.find((problem) => problem.id === "problem-pump");
  if (pump) {
    pump.discovered = true;
    pump.status = "active";
  }

  world.rowanAutonomy = {
    actionId: "solve:problem-pump",
    autoContinue: true,
    detail:
      "The pump is active and Rowan has the wrench, so fixing it is the live useful move.",
    intent: {
      reason:
        "The pump is active and Rowan has the wrench, so fixing it is the live useful move.",
      signals: ["Problem: pump active", "Tool: wrench owned"],
    },
    key: "objective:solve:pump",
    label: "Fix the pump",
    layer: "objective",
    mode: "acting",
    stepKind: "act",
    targetLocationId: "boarding-house",
  };
  world.availableActions = [
    {
      description: "Fix the yard pump with the wrench.",
      emphasis: "high",
      id: "solve:problem-pump",
      kind: "solve",
      label: "Fix the pump",
      matchesObjective: true,
      targetLocationId: "boarding-house",
    },
  ];

  return world;
}

function worldWithActiveTeaCommitment(
  teaShiftStage: "rush" | "counter" = "rush",
): StreetGameState {
  const world = seedStreetGame("game-reasoning-active-tea-thought");
  const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");

  world.player.currentLocationId = "tea-house";
  world.player.activeJobId = "job-tea-shift";
  world.clock = {
    day: 1,
    hour: 12,
    label: "Afternoon",
    minute: 30,
    totalMinutes: 12 * 60 + 30,
  };
  world.currentTime = "2026-03-21T12:30:00.000Z";
  world.firstAfternoon = {
    teaShiftStage,
  };
  if (teaJob) {
    teaJob.accepted = true;
    teaJob.completed = false;
    teaJob.missed = false;
  }

  return world;
}

function worldWithPaidFirstAfternoonReturnThought(): StreetGameState {
  const world = seedStreetGame("game-reasoning-paid-first-afternoon-return");

  world.player.currentLocationId = "freight-yard";
  world.firstAfternoon = {
    teaShiftStage: "paid",
  };

  return world;
}

function worldWithCompletedFirstAfternoonPlayerThought(): StreetGameState {
  const world = seedStreetGame(
    "game-reasoning-completed-first-afternoon-thought",
  );

  world.firstAfternoon = {
    completedAt: world.currentTime,
  };

  return world;
}

function worldWithRecentConversationLead(
  npcId: string,
  objectiveText: string,
  decision = "",
): StreetGameState {
  const world = seedStreetGame(`game-recent-conversation-lead-${npcId}`);
  const npc = world.npcs.find((entry) => entry.id === npcId);

  if (!npc) {
    throw new Error(`Missing NPC ${npcId}`);
  }

  world.player.currentLocationId = npc.currentLocationId;
  npc.lastInteractionAt = world.currentTime;
  world.conversationThreads = {
    ...world.conversationThreads,
    [npcId]: {
      decision,
      id: `thread-${npcId}`,
      lines: [],
      updatedAt: world.currentTime,
      npcId,
      objectiveText,
      summary: objectiveText,
    },
  };

  return world;
}

describe("street reasoning authority", () => {
  it("keeps first-afternoon action rationale in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain(FIRST_AFTERNOON_PLAN_RATIONALE);
    expect(engineSource).not.toContain(FIRST_AFTERNOON_PLAN_RATIONALE);
  });

  it("keeps deterministic Rowan opening and follow-up copy in scaffold helpers, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const line of AUTONOMOUS_OPENING_AND_FOLLOWUP_COPY) {
      expect(scaffoldSource).toContain(line);
      expect(engineSource).not.toContain(line);
    }

    expect(scaffoldSource).toContain("AUTONOMOUS_OPENING_SPEECH_RULES");
    expect(scaffoldSource).toContain("AUTONOMOUS_FOLLOWUP_RULES");
    expect(scaffoldSource).toContain(
      "AUTONOMOUS_CONTINUATION_FALLBACK_RULES",
    );
    expect(engineSource).toContain("objectiveRouteAutonomousOpeningSpeech");
    expect(engineSource).toContain("objectiveRouteAutonomousFollowupSpeech");
    expect(engineSource).toContain(
      "objectiveRouteAutonomousContinuationFallbackSpeech",
    );
  });

  it("keeps desired-outcome planner scoring rules outside engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scoringSource = readFileSync(
      new URL("../src/sim/objectivePlanningScoring.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );
    const scaffoldPolicyIds = [
      "active-commitment",
      "income",
      "shelter-stability",
      "social-anchors",
      "useful-help",
      "tool-ready",
      "recover",
      "map-knowledge",
    ];

    expect(scaffoldSource).toContain(
      "OBJECTIVE_DESIRED_OUTCOME_SCORE_POLICY_IDS",
    );
    expect(scaffoldSource).toContain(
      "export function objectiveDesiredOutcomeScoreAdjustment",
    );
    expect(scaffoldSource).toContain(
      "const OBJECTIVE_DESIRED_OUTCOME_SCORE_POLICIES",
    );
    expect(scoringSource).toContain("objectiveDesiredOutcomeScoreAdjustment");
    expect(scoringSource).not.toContain("DESIRED_OUTCOME_SCORE_RULES");
    expect(scoringSource).not.toContain(
      "const OBJECTIVE_DESIRED_OUTCOME_SCORE_POLICIES",
    );
    expect(scoringSource).toContain("scoreJobWindowOutcome");
    expect(scoringSource).toContain(
      "outcome.id.startsWith(JOB_WINDOW_OUTCOME_PREFIX)",
    );
    expect(scoringSource).toContain("scorePlanForTargetedOutcome");
    for (const policyId of scaffoldPolicyIds) {
      expect(scaffoldSource).toContain(`"${policyId}"`);
      expect(scoringSource).not.toContain(`"${policyId}"`);
    }
    for (const multiplier of [
      "priority * 2.6",
      "priority * 4.2",
      "priority * 2.8",
      "priority * 2.7",
    ]) {
      expect(scaffoldSource).toContain(multiplier);
      expect(scoringSource).not.toContain(multiplier);
    }
    expect(engineSource).toContain("scorePlanForDesiredOutcomes");
    expect(engineSource).not.toContain("function scorePlanForDesiredOutcomes");
    expect(engineSource).not.toContain('case "active-commitment"');
    expect(engineSource).not.toContain('case "income"');
    expect(engineSource).not.toContain('case "shelter-stability"');
    expect(engineSource).not.toContain('case "social-anchors"');
    expect(engineSource).not.toContain('case "useful-help"');
    expect(engineSource).not.toContain('case "tool-ready"');
    expect(engineSource).not.toContain('case "recover"');
    expect(engineSource).not.toContain('case "map-knowledge"');
    expect(engineSource).not.toContain('outcome.id.startsWith("job-window-")');
  });

  it("keeps generic desired-outcome construction policy in objective scaffolds", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );
    const policyStart = scaffoldSource.indexOf(
      "const GENERIC_PLANNING_DESIRED_OUTCOME_POLICIES",
    );
    const helperStart = scaffoldSource.indexOf(
      "export function buildGenericStreetPlanningOutcomes",
    );
    const policySource = scaffoldSource.slice(policyStart, helperStart);
    const genericConstructionNeedles = [
      'id: "shelter-stability"',
      `label: "Keep tonight's room and improve Rowan's standing at Morrow House."`,
      "textMatches: /room|stay|bed|home|foothold/",
      'id: "income"',
      'label: "Turn one real lead into money or a live work commitment."',
      'label: "Earn money or secure a credible work commitment."',
      "textMatches: /work|job|money|earn|pay|shift/",
      'id: "social-anchors"',
      "textMatches: /people|friend|trust|meet/",
      'id: "useful-help"',
      '"Find and resolve a concrete local problem."',
      "textMatches: /help|fix|solve|repair|problem|pump|cart/",
      'id: "tool-ready"',
      'label: "Get the tool Rowan needs before trying the repair."',
      "textMatches: /tool|wrench|buy/",
      'id: "recover"',
      'label: "Recover enough energy to make the next commitment safely."',
      "textMatches: /rest|recover|sleep|tired|energy/",
      'id: "map-knowledge"',
      'label: "Make South Quay more legible by visiting places and asking locals."',
      "textMatches: /explore|map|learn|district|bearings/",
    ];

    expect(policyStart).toBeGreaterThanOrEqual(0);
    expect(helperStart).toBeGreaterThan(policyStart);
    expect(scaffoldSource).toContain(
      "export function buildGenericStreetPlanningOutcomes",
    );
    expect(engineSource).toContain("buildGenericStreetPlanningOutcomes");
    expect(engineSource).not.toContain(
      "GENERIC_PLANNING_DESIRED_OUTCOME_POLICIES",
    );
    for (const needle of genericConstructionNeedles) {
      expect(policySource).toContain(needle);
      expect(engineSource).not.toContain(needle);
    }
  });

  it("keeps route scaffold pressure advisory behind predicate and live pressure", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );
    const livePressureSource = engineSource.slice(
      engineSource.indexOf("function scoreLiveStatePressureForAction"),
      engineSource.indexOf("function scoreObjectiveAgentMovePlan"),
    );

    const predicatePressureIndex = livePressureSource.indexOf(
      "scoreObjectivePlanningPressureForPlan",
    );
    const liveProblemPressureIndex = livePressureSource.indexOf(
      "scoreLiveProblemPressureForAction",
    );
    const liveJobPressureIndex = livePressureSource.indexOf(
      "scoreLiveJobPressureForAction",
    );
    const routeScaffoldPressureIndex = livePressureSource.indexOf(
      "objectiveRouteActionPressureScore",
    );

    expect(scaffoldSource).toContain(
      "export function objectiveRouteActionPressureScore",
    );
    expect(engineSource).not.toContain(
      "function objectiveRouteActionPressureScore",
    );
    expect(livePressureSource).toContain("predicateAuthority");
    expect(predicatePressureIndex).toBeGreaterThanOrEqual(0);
    expect(liveProblemPressureIndex).toBeGreaterThan(predicatePressureIndex);
    expect(liveJobPressureIndex).toBeGreaterThan(liveProblemPressureIndex);
    expect(routeScaffoldPressureIndex).toBeGreaterThan(liveJobPressureIndex);
  });

  it("keeps NPC objective affinity scoring rules outside engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const affinitySource = readFileSync(
      new URL("../src/sim/npcObjectiveAffinity.ts", import.meta.url),
      "utf8",
    );
    const autoActionScoringSource = engineSource.slice(
      engineSource.indexOf("function scoreAutoActionForObjective"),
      engineSource.indexOf("function shouldAllowImmediateNpcFollowup"),
    );

    expect(affinitySource).toContain("NPC_FOCUS_AFFINITY_SCORES");
    expect(affinitySource).toContain("OBJECTIVE_TEXT_AFFINITY_RULES");
    expect(affinitySource).toContain('"npc-mara": 16');
    expect(affinitySource).toContain('"npc-ada": 10');
    expect(affinitySource).toContain('"npc-tomas": 12');
    expect(affinitySource).toContain('"npc-jo": 16');
    expect(affinitySource).toContain('"npc-nia": 14');
    expect(engineSource).toContain("scoreNpcForObjectiveAffinity");
    expect(engineSource).not.toContain("function scoreNpcForObjective");
    expect(engineSource).not.toContain("pointsToAda");
    expect(engineSource).not.toContain("POINTS_TO_ADA_PATTERN");
    expect(engineSource).not.toContain("OBJECTIVE_TEXT_AFFINITY_RULES");
    expect(engineSource).not.toContain("NPC_FOCUS_AFFINITY_SCORES");

    for (const npcId of [
      "npc-mara",
      "npc-ada",
      "npc-tomas",
      "npc-jo",
      "npc-nia",
    ]) {
      expect(autoActionScoringSource).not.toContain(`"${npcId}"`);
    }
  });

  it("keeps first-afternoon reflection action metadata in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const actionCopy of [
      FIRST_AFTERNOON_PLAN_ACTION_DESCRIPTION,
      FIRST_AFTERNOON_PUMP_ACTION_DESCRIPTION,
      FIRST_AFTERNOON_COMPARE_ACTION_DESCRIPTION,
      FIRST_AFTERNOON_COMPLETION_ACTION_DESCRIPTION,
    ]) {
      expect(scaffoldSource).toContain(actionCopy);
      expect(engineSource).not.toContain(actionCopy);
    }

    expect(scaffoldSource).toContain("availableActions");
    expect(engineSource).toContain("objectiveRouteAvailableActions");
  });

  it("keeps first-afternoon plan-choice and field-note copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const actionCopy of FIRST_AFTERNOON_PLAN_AND_FIELD_NOTE_COPY) {
      expect(scaffoldSource).toContain(actionCopy);
      expect(engineSource).not.toContain(actionCopy);
    }

    expect(scaffoldSource).toContain("firstAfternoon");
    expect(scaffoldSource).toContain("completionFieldNote");
    expect(scaffoldSource).toContain("leadFieldNote");
    expect(engineSource).toContain(
      "objectiveRouteFirstAfternoonPlanSettlementCopy",
    );
    expect(engineSource).toContain(
      "objectiveRouteFirstAfternoonCompletionFieldNote",
    );
    expect(engineSource).not.toContain("firstAfternoon: {");
  });

  it("keeps first-afternoon dialogue fallback copy in scaffold data, not dialogue control flow", () => {
    const dialogueSource = readFileSync(
      new URL("../src/ai/streetDialogue.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain(FIRST_AFTERNOON_DIALOGUE_FALLBACK);
    expect(dialogueSource).not.toContain(FIRST_AFTERNOON_DIALOGUE_FALLBACK);
    expect(dialogueSource).not.toContain('routeKey === "first-afternoon"');
  });

  it("keeps first-afternoon work-window dialogue policy in scaffold data, not dialogue control flow", () => {
    const dialogueSource = readFileSync(
      new URL("../src/ai/streetDialogue.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain("firstAfternoonWorkWindowDialogue");
    expect(dialogueSource).toContain(
      "objectiveRouteFirstAfternoonWorkWindowDialogue",
    );

    for (const dialogueCopy of [
      ...FIRST_AFTERNOON_OPEN_WORK_WINDOW_DIALOGUE_COPY,
      ...FIRST_AFTERNOON_CLOSED_WORK_WINDOW_DIALOGUE_COPY,
    ]) {
      expect(scaffoldSource).toContain(dialogueCopy);
      expect(dialogueSource).not.toContain(dialogueCopy);
    }

    for (const choiceKey of [
      ...FIRST_AFTERNOON_OPEN_WORK_WINDOW_DIALOGUE_CHOICE_KEYS,
      ...FIRST_AFTERNOON_CLOSED_WORK_WINDOW_DIALOGUE_CHOICE_KEYS,
    ]) {
      expect(scaffoldSource).toContain(choiceKey);
      expect(dialogueSource).not.toContain(choiceKey);
    }
  });

  it("keeps selected Jo/Nia problem-route dialogue policy in scaffold data, not dialogue control flow", () => {
    const dialogueSource = readFileSync(
      new URL("../src/ai/streetDialogue.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain("problemRouteDialogue");
    expect(dialogueSource).toContain("objectiveRouteProblemDialogue");

    for (const dialogueCopy of PROBLEM_ROUTE_DIALOGUE_COPY) {
      expect(scaffoldSource).toContain(dialogueCopy);
      expect(dialogueSource).not.toContain(dialogueCopy);
    }

    for (const choiceKey of PROBLEM_ROUTE_DIALOGUE_CHOICE_KEYS) {
      expect(scaffoldSource).toContain(choiceKey);
      expect(dialogueSource).not.toContain(choiceKey);
    }
  });

  it("keeps passive problem-pressure narratives in street-sim data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const pressureNarrativesSource = readFileSync(
      new URL(
        "../src/street-sim/problemPressureNarratives.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const pressureRulesSource = readFileSync(
      new URL("../src/street-sim/problemPressureRules.ts", import.meta.url),
      "utf8",
    );

    for (const pressureCopy of PASSIVE_PROBLEM_PRESSURE_COPY) {
      expect(pressureNarrativesSource).toContain(pressureCopy);
      expect(engineSource).not.toContain(pressureCopy);
    }

    expect(pressureNarrativesSource).toContain("PROBLEM_PRESSURE_NARRATIVES");
    expect(pressureNarrativesSource).toContain("problemEscalationStages");
    expect(pressureNarrativesSource).toContain(
      "problemExpiryConsequenceNarrative",
    );
    expect(pressureNarrativesSource).toContain(
      "independentProblemResolutionNarrative",
    );
    expect(pressureRulesSource).toContain("PROBLEM_PRESSURE_RULES");
    expect(pressureRulesSource).toContain("problemPressurePassiveActivation");
    expect(pressureRulesSource).toContain("problemPressurePassiveExpiry");
    expect(pressureRulesSource).toContain(
      "problemPressureIndependentResolution",
    );
    expect(engineSource).toContain("problemEscalationStages");
    expect(engineSource).toContain("problemPressurePassiveActivation");
    expect(engineSource).toContain("problemPressurePassiveExpiry");
    expect(engineSource).toContain("problemPressureIndependentResolution");
    expect(engineSource).not.toContain("PROBLEM_ESCALATION_STAGES");

    const passivePressureStart = engineSource.indexOf(
      "function resolvePassiveState",
    );
    const passivePressureEnd = engineSource.indexOf(
      "function resolveTomasYardLoading",
    );
    expect(passivePressureStart).toBeGreaterThanOrEqual(0);
    expect(passivePressureEnd).toBeGreaterThan(passivePressureStart);
    const passivePressureEngineSource = engineSource.slice(
      passivePressureStart,
      passivePressureEnd,
    );
    for (const passiveRuleToken of [
      '"problem-pump"',
      '"problem-cart"',
      '"npc-mara"',
      '"npc-nia"',
      '"courtyard"',
      '"market-square"',
      "morrow_house",
      "south_quay",
    ]) {
      expect(passivePressureEngineSource).not.toContain(passiveRuleToken);
      expect(pressureRulesSource).toContain(passiveRuleToken);
    }
  });

  it("keeps active problem action narratives in street-sim data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const pressureNarrativesSource = readFileSync(
      new URL(
        "../src/street-sim/problemPressureNarratives.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const actionRulesSource = readFileSync(
      new URL("../src/street-sim/problemActionRules.ts", import.meta.url),
      "utf8",
    );

    for (const problemActionCopy of ACTIVE_PROBLEM_ACTION_COPY) {
      expect(pressureNarrativesSource).toContain(problemActionCopy);
      expect(engineSource).not.toContain(problemActionCopy);
    }

    expect(pressureNarrativesSource).toContain(
      "activeProblemInspectNarrative",
    );
    expect(pressureNarrativesSource).toContain("activeProblemSolveNarrative");
    expect(actionRulesSource).toContain("activeProblemInspectNarrative");
    expect(actionRulesSource).toContain("activeProblemSolveNarrative");
    expect(engineSource).toContain("activeProblemInspectAction");
    expect(engineSource).toContain("activeProblemSolveAction");
    expect(engineSource).not.toContain("activeProblemInspectNarrative");
    expect(engineSource).not.toContain("activeProblemSolveNarrative");
  });

  it("keeps active problem action effects in street-sim rules, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const actionRulesSource = readFileSync(
      new URL("../src/street-sim/problemActionRules.ts", import.meta.url),
      "utf8",
    );

    expect(actionRulesSource).toContain("PROBLEM_ACTION_RULES");
    expect(actionRulesSource).toContain("activeProblemInspectAction");
    expect(actionRulesSource).toContain("activeProblemSolveAction");
    expect(engineSource).toContain("activeProblemInspectAction");
    expect(engineSource).toContain("activeProblemSolveAction");

    const activeProblemStart = engineSource.indexOf("function solveProblem");
    const activeProblemEnd = engineSource.indexOf(
      "function contributeToLocation",
    );
    expect(activeProblemStart).toBeGreaterThanOrEqual(0);
    expect(activeProblemEnd).toBeGreaterThan(activeProblemStart);
    const activeProblemEngineSource = engineSource.slice(
      activeProblemStart,
      activeProblemEnd,
    );

    for (const activeRuleToken of [
      '"problem-pump"',
      '"problem-cart"',
      '"morrow_house"',
      '"south_quay"',
      "durationMinutes: 60",
      "durationMinutes: 30",
      "delta: -10",
      "delta: -8",
      'toStatus: "solved"',
    ]) {
      expect(activeProblemEngineSource).not.toContain(activeRuleToken);
      expect(actionRulesSource).toContain(activeRuleToken);
    }
  });

  it("keeps passive job outcome narratives in street-sim data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const jobNarrativesSource = readFileSync(
      new URL("../src/street-sim/jobNarratives.ts", import.meta.url),
      "utf8",
    );

    for (const jobCopy of PASSIVE_JOB_OUTCOME_COPY) {
      expect(jobNarrativesSource).toContain(jobCopy);
      expect(engineSource).not.toContain(jobCopy);
    }

    expect(jobNarrativesSource).toContain("JOB_NARRATIVES");
    expect(jobNarrativesSource).toContain("passiveMissedJobNarrative");
    expect(jobNarrativesSource).toContain("independentNpcJobClosureNarrative");
    expect(engineSource).toContain("passiveMissedJobNarrative");
    expect(engineSource).toContain("independentNpcJobClosureNarrative");
    expect(engineSource).not.toContain("JOB_NARRATIVES");
  });

  it("keeps active job work narratives in street-sim data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const jobNarrativesSource = readFileSync(
      new URL("../src/street-sim/jobNarratives.ts", import.meta.url),
      "utf8",
    );

    for (const jobCopy of ACTIVE_JOB_WORK_COPY) {
      expect(jobNarrativesSource).toContain(jobCopy);
      expect(engineSource).not.toContain(jobCopy);
    }

    expect(jobNarrativesSource).toContain("activeJobStageNarrative");
    expect(jobNarrativesSource).toContain("activeJobInterruptionNarrative");
    expect(jobNarrativesSource).toContain("activeJobCompletionNarrative");
    expect(jobNarrativesSource).toContain("yardWorkPumpConsequenceNarrative");
    expect(engineSource).toContain("activeJobStageNarrative");
    expect(engineSource).toContain("activeJobInterruptionNarrative");
    expect(engineSource).toContain("activeJobCompletionNarrative");
    expect(engineSource).toContain("yardWorkPumpConsequenceNarrative");
    expect(engineSource).not.toContain("GENERIC_ACTIVE_JOB_COMPLETION");
  });

  it("keeps Jo money/work dialogue policy in scaffold helper data, not dialogue control flow", () => {
    const dialogueSource = readFileSync(
      new URL("../src/ai/streetDialogue.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain("objectiveRouteJoMoneyWorkDialogue");
    expect(dialogueSource).toContain("objectiveRouteJoMoneyWorkDialogue");

    for (const dialogueCopy of JO_MONEY_WORK_DIALOGUE_COPY) {
      expect(scaffoldSource).toContain(dialogueCopy);
      expect(dialogueSource).not.toContain(dialogueCopy);
    }

    for (const choiceKey of JO_MONEY_WORK_DIALOGUE_CHOICE_KEYS) {
      expect(scaffoldSource).toContain(choiceKey);
      expect(dialogueSource).not.toContain(choiceKey);
    }
  });

  it("keeps web first-afternoon fallback narrative copy in the web narrative helper", () => {
    const componentSource = readFileSync(
      new URL(
        "../../many-lives-web/src/components/street/PhaserStreetGameApp.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const overlaySource = readFileSync(
      new URL(
        "../../many-lives-web/src/components/street/streetOverlayHtml.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const helperSource = readFileSync(
      new URL(
        "../../many-lives-web/src/lib/street/rowanFallbackNarrative.ts",
        import.meta.url,
      ),
      "utf8",
    );

    for (const playerFacingCopy of WEB_FIRST_AFTERNOON_FALLBACK_COPY) {
      expect(helperSource).toContain(playerFacingCopy);
      expect(componentSource).not.toContain(playerFacingCopy);
      expect(overlaySource).not.toContain(playerFacingCopy);
    }

    expect(componentSource).toContain(
      "buildFirstAfternoonActiveConversationContinueCopy",
    );
    expect(componentSource).toContain(
      "buildFirstAfternoonOpeningWatchContinueCopy",
    );
    expect(overlaySource).toContain("buildRowanFallbackNotebookModel");
    expect(overlaySource).toContain(
      "firstAfternoonMaraAdaLeadFieldNoteNextCopy",
    );
  });

  it("prefers simulator-owned first-afternoon next copy before web fallback copy", () => {
    const world = seedStreetGame("game-web-first-afternoon-next-authority");
    const webWorld = world as unknown as Parameters<
      typeof buildFirstAfternoonCompletionContinueCopy
    >[0];

    webWorld.firstAfternoon = {
      completedAt: webWorld.currentTime,
      fieldNote: {
        createdAt: webWorld.currentTime,
        evidence: "Server completion evidence.",
        learned: "Server completion learning.",
        memory: "Server completion memory.",
        next: "Server field-note next should win.",
      },
      leadFieldNote: {
        createdAt: webWorld.currentTime,
        evidence: "Server lead evidence.",
        learned: "Server lead learning.",
        memory: "Server lead memory.",
        next: "Server lead next should win.",
      },
      teaShiftStage: "paid",
    };
    webWorld.rowanCognition = {
      notebook: {
        belief: "Notebook belief.",
        clue: "Notebook clue.",
        confidence: "Notebook confidence.",
        plan: "Notebook plan should win when no field note next exists.",
        title: "Notebook title.",
        uncertainty: "Notebook uncertainty.",
        authority: {},
      },
    };
    webWorld.rowanAutonomy = {
      actionId: "solve:problem-pump",
      autoContinue: true,
      detail: "Autonomy detail should win when cognition is absent.",
      intent: {
        reason: "Autonomy rationale should win when cognition is absent.",
        signals: [],
      },
      key: "objective:solve:pump",
      label: "Fix the pump",
      mode: "acting",
      targetLocationId: "boarding-house",
    };
    webWorld.player.objective = {
      ...webWorld.player.objective!,
      outcomes: [
        {
          authority: "predicate",
          id: "live-objective",
          label: "Objective outcome should win when autonomy is absent.",
          status: "open",
          urgency: 50,
        },
      ],
      progress: {
        completed: 0,
        label: "Objective progress should not beat the outcome label.",
        total: 1,
      },
      text: "Objective text should be available before fallback.",
    };

    expect(
      firstAfternoonMaraAdaLeadFieldNoteNextCopy(
        webWorld,
        "Web fallback lead copy.",
      ),
    ).toBe("Server lead next should win.");

    const stageWorld = seedStreetGame(
      "game-web-first-afternoon-stage-next-authority",
    ) as unknown as Parameters<
      typeof firstAfternoonMaraAdaLeadFieldNoteNextCopy
    >[0];
    stageWorld.firstAfternoon = { teaShiftStage: "counter" };
    expect(
      firstAfternoonMaraAdaLeadFieldNoteNextCopy(
        stageWorld,
        "Web fallback lead copy.",
      ),
    ).toBe(
      "Finish the counter pass, collect the pay, then let the work become a real field note.",
    );

    expect(buildFirstAfternoonCompletionContinueCopy(webWorld)).toBe(
      "Server field-note next should win.",
    );

    webWorld.firstAfternoon.fieldNote = undefined;
    expect(buildFirstAfternoonCompletionContinueCopy(webWorld)).toBe(
      "Notebook plan should win when no field note next exists.",
    );

    webWorld.rowanCognition = undefined;
    expect(buildFirstAfternoonCompletionContinueCopy(webWorld)).toBe(
      "Autonomy rationale should win when cognition is absent.",
    );

    webWorld.rowanAutonomy.intent = undefined;
    webWorld.rowanAutonomy.label = "";
    webWorld.rowanAutonomy.detail = "";
    expect(buildFirstAfternoonCompletionContinueCopy(webWorld)).toBe(
      "Objective outcome should win when autonomy is absent.",
    );
  });

  it("keeps playback trail visibility policy in scaffold data, not rail control flow", () => {
    const playbackSource = readFileSync(
      new URL(
        "../../many-lives-web/src/lib/street/rowanPlayback.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const playbackScaffoldSource = readFileSync(
      new URL(
        "../../many-lives-web/src/lib/street/rowanPlaybackScaffolds.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(playbackScaffoldSource).toContain(
      "PLAYBACK_TRAIL_VISIBILITY_POLICIES",
    );
    expect(playbackScaffoldSource).toContain(
      "isObjectiveTrailStepPlayerFacingForPlayback",
    );
    expect(playbackScaffoldSource).toContain(PLAYBACK_NIA_BLOCK_POLICY_ID);
    expect(playbackScaffoldSource).toContain("\\bnia\\b");
    expect(playbackScaffoldSource).toContain("\\b(block|jam|cart|square)\\b");
    expect(playbackScaffoldSource).toContain("\\bmorrow house\\b");
    expect(playbackScaffoldSource).toContain(
      "\\b(standing|room stays mine|tonight'?s bed|settle)\\b",
    );

    expect(playbackSource).toContain(
      "isObjectiveTrailStepPlayerFacingForPlayback",
    );
    expect(playbackSource).not.toContain("trailHintConflictsWithLiveObjective");
    expect(playbackSource).not.toContain("liveObjectiveIsNiaBlockLead");
    expect(playbackSource).not.toContain("trailHintIsMorrowStanding");
    expect(playbackSource).not.toContain("\\bnia\\b");
    expect(playbackSource).not.toContain("\\b(block|jam|cart|square)\\b");
    expect(playbackSource).not.toContain("\\bmorrow house\\b");
    expect(playbackSource).not.toContain(
      "\\b(standing|room stays mine|tonight'?s bed|settle)\\b",
    );
  });

  it("keeps playback rest location policy in scaffold data, not rail control flow", () => {
    const playbackSource = readFileSync(
      new URL(
        "../../many-lives-web/src/lib/street/rowanPlayback.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const playbackScaffoldSource = readFileSync(
      new URL(
        "../../many-lives-web/src/lib/street/rowanPlaybackScaffolds.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(playbackScaffoldSource).toContain(
      "PLAYBACK_HOME_REST_LOCATION_POLICY",
    );
    expect(playbackScaffoldSource).toContain("isPlaybackHomeRestLocation");
    expect(playbackScaffoldSource).toContain(PLAYBACK_HOME_REST_POLICY_ID);
    expect(playbackScaffoldSource).toContain('"boarding-house"');
    expect(playbackScaffoldSource).toContain("morrow house|boarding house");

    expect(playbackSource).toContain("isPlaybackHomeRestLocation");
    expect(playbackSource).not.toContain("/morrow house|boarding house/i");
    expect(playbackSource).not.toContain(
      'currentLocationId === "boarding-house"',
    );
  });

  it("keeps Mara/Ada lead-grounding copy in scaffold policy, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const promptSource = readFileSync(
      new URL("../src/ai/prompts/generateStreetReply.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const groundingCopy of [
      MARA_ADA_GROUNDING_FOLLOWUP,
      MARA_ADA_GROUNDED_FALLBACK_REPLY,
      MARA_ADA_GROUNDING_FALLBACK_MEMORY,
      MARA_ADA_GROUNDING_FALLBACK_SUMMARY,
      MARA_ADA_REQUIRED_PROMPT_LINE,
      MARA_ADA_PROMPT_OVERRIDE_LINE,
      MARA_ADA_GROUNDED_PROMPT_LINE,
    ]) {
      expect(scaffoldSource).toContain(groundingCopy);
      expect(engineSource).not.toContain(groundingCopy);
      expect(promptSource).not.toContain(groundingCopy);
    }

    expect(scaffoldSource).toContain("conversationGroundingPolicies");
    expect(scaffoldSource).toContain("mara-ada-lead-grounding");
    expect(engineSource).toContain("objectiveRouteConversationGroundingPolicy");
    expect(promptSource).toContain(
      "objectiveRouteConversationPromptGroundingLines",
    );
    expect(promptSource).not.toContain("buildRequiredGroundingLines");
    expect(promptSource).not.toContain('input.npcId !== "npc-mara"');
    expect(promptSource).not.toContain('routeKey !== "first-afternoon"');
    expect(engineSource).not.toContain("groundedMaraAdaLeadReply");
    expect(engineSource).not.toContain("buildMaraAdaLeadGroundingFollowup");
    expect(engineSource).not.toContain("shouldRequireMaraAdaLeadEvidence");
  });

  it("keeps NPC first-contact primer copy in NPC narrative data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const npcNarrativesSource = readFileSync(
      new URL("../src/street-sim/npcNarratives.ts", import.meta.url),
      "utf8",
    );

    for (const primerCopy of NPC_FIRST_CONTACT_PRIMER_COPY) {
      expect(npcNarrativesSource).toContain(primerCopy);
      expect(engineSource).not.toContain(primerCopy);
    }

    expect(npcNarrativesSource).toContain("firstContactPrimer");
    expect(engineSource).toContain("getNpcFirstContactPrimer");
    expect(engineSource).not.toContain("firstContactPrimer:");
  });

  it("keeps NPC conversation resolution and impression copy in NPC narrative data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const npcNarrativesSource = readFileSync(
      new URL("../src/street-sim/npcNarratives.ts", import.meta.url),
      "utf8",
    );

    for (const resolutionCopy of NPC_CONVERSATION_RESOLUTION_COPY) {
      expect(npcNarrativesSource).toContain(resolutionCopy);
      expect(engineSource).not.toContain(resolutionCopy);
    }

    expect(npcNarrativesSource).toContain("NPC_CONVERSATION_RESOLUTIONS");
    expect(npcNarrativesSource).toContain("NEXT_NPC_OBJECTIVE_TEXT");
    expect(npcNarrativesSource).toContain("NPC_CONVERSATION_IMPRESSIONS");
    expect(engineSource).toContain("buildNpcConversationResolution");
    expect(engineSource).toContain("buildSocialNextNpcConversationResolution");
    expect(engineSource).toContain("buildNpcConversationImpression");
    expect(engineSource).not.toContain("buildNextNpcObjectiveText");
    expect(engineSource).not.toContain(
      "yardWorkRedirectConversationResolution",
    );
    expect(engineSource).not.toContain(
      "closedWorkWindowConversationResolution",
    );
  });

  it("keeps NPC inner-state objective and concern copy in NPC narrative data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const npcNarrativesSource = readFileSync(
      new URL("../src/street-sim/npcNarratives.ts", import.meta.url),
      "utf8",
    );

    for (const innerStateCopy of NPC_INNER_STATE_NARRATIVE_COPY) {
      expect(npcNarrativesSource).toContain(innerStateCopy);
      expect(engineSource).not.toContain(innerStateCopy);
    }

    expect(npcNarrativesSource).toContain("NPC_INNER_STATE_NARRATIVES");
    expect(npcNarrativesSource).toContain("npcInnerStateNarrative");
    expect(engineSource).toContain("npcInnerStateNarrative");
  });

  it("keeps problem-route and conversation-lead thought copy in street-sim data, not thought control flow", () => {
    const thoughtsSource = readFileSync(
      new URL("../src/ai/streetThoughts.ts", import.meta.url),
      "utf8",
    );
    const thoughtNarrativesSource = readFileSync(
      new URL("../src/street-sim/thoughtNarratives.ts", import.meta.url),
      "utf8",
    );

    for (const thoughtCopy of STREET_THOUGHT_NARRATIVE_COPY) {
      expect(thoughtNarrativesSource).toContain(thoughtCopy);
      expect(thoughtsSource).not.toContain(thoughtCopy);
    }

    expect(thoughtNarrativesSource).toContain("PROBLEM_ROUTE_PLAYER_THOUGHTS");
    expect(thoughtNarrativesSource).toContain(
      "RECENT_CONVERSATION_LEAD_THOUGHTS",
    );
    expect(thoughtNarrativesSource).toContain("NPC_PROBLEM_THOUGHTS");
    expect(thoughtsSource).toContain("problemRoutePlayerThought");
    expect(thoughtsSource).toContain("recentConversationLeadThoughts");
    expect(thoughtsSource).toContain("npcProblemThoughts");
  });

  it("preserves selected NPC-owned conversation resolution payloads exactly", () => {
    expect(
      buildNpcConversationResolution("mara-pump-needs-wrench", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "get to Mercer Repairs for a wrench, then come back to the pump.",
      memoryKind: "problem",
      memoryText:
        "Mara made it plain that fixing the pump would make the house easier for everyone.",
      objectiveText: "Buy a wrench and fix the pump.",
    });
    expect(
      buildNpcConversationResolution("mara-live-tea-lead", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "get to Kettle & Lamp before lunch gets busy and ask Ada for work.",
      memoryKind: "job",
      memoryText:
        "Mara trusts follow-through more than worry, and Ada is the nearest honest place to start.",
      objectiveText: "Get to Kettle & Lamp and ask Ada for work.",
    });
    expect(
      buildNpcConversationResolution("ada-closed-lunch-yard-redirect", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "skip the closed lunch lead and ask Tomas while the yard window is still live.",
      memoryKind: "job",
      memoryText:
        "Ada closed the lunch option instead of holding a stale shift open, then pointed Rowan toward the yard.",
      objectiveText:
        "See if Tomas still needs another set of hands in the yard.",
      summary:
        "Ada closed the stale lunch lead and redirected Rowan toward the live yard window.",
    });
    expect(
      buildNpcConversationResolution("ada-live-tea-shift", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "stay with Ada and take the tea-house shift if the room still needs the hands.",
      memoryKind: "job",
      memoryText:
        "Ada made the noon shift sound simple, but only if you can keep up once the room gets hot.",
      objectiveText: "Take the cup-and-counter shift at Kettle & Lamp.",
    });
    expect(
      buildNpcConversationResolution("jo-wrench-needed-for-pump", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "decide whether Jo's wrench is worth the eight coins, then take it where it matters.",
      memoryKind: "self",
      memoryText:
        "Jo made the wrench feel less like a purchase and more like a decision about whether you'll actually use it.",
      objectiveText: "Buy a wrench and fix the pump.",
    });
    expect(
      buildNpcConversationResolution("jo-has-wrench-for-pump", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "leave the stall and go use the wrench before the pump gets worse.",
      memoryKind: "problem",
      memoryText:
        "Jo made the repair feel plain: take the tool back and use it before the leak gets worse.",
      objectiveText: "Fix the pump in Morrow Yard.",
    });
    expect(
      buildNpcConversationResolution("tomas-live-yard-shift", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "stay near the yard and take the loading shift if the pay and timing still work.",
      memoryKind: "job",
      memoryText:
        "Tomas was clear about the work: keep the lane open, move the crates, and finish on time.",
      objectiveText: "Take the freight yard lift before the window closes.",
    });
    expect(
      buildNpcConversationResolution("tomas-closed-yard-window", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "stop chasing closed work windows and return to Morrow House to take stock.",
      memoryKind: "job",
      memoryText:
        "Tomas did not reopen the loading block after the yard had already moved without Rowan.",
      objectiveText: "Return to Morrow House and take stock.",
    });
    expect(
      buildNpcConversationResolution("nia-live-cart-jam", {
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "swing through Quay Square and clear the cart before the foot traffic swells.",
      memoryKind: "problem",
      memoryText:
        "Nia keeps seeing the small jams that become the whole block's problem if nobody moves first.",
      objectiveText: "Clear the jammed cart in Quay Square.",
    });
  });

  it("preserves social next-NPC and impression copy from NPC narrative helpers", () => {
    expect(
      buildSocialNextNpcConversationResolution({
        currentNpcName: "Mara",
        nextNpcId: "npc-ada",
        nextNpcName: "Ada",
        shouldSharpenObjective: true,
        socialLoopObjective: false,
      }),
    ).toMatchObject({
      decision: "talk to Ada next while there is still time.",
      memoryKind: "person",
      memoryText: "Mara pointed Rowan toward the next person to talk to.",
      objectiveText: "Ask Ada if Kettle & Lamp needs steady hands today.",
    });
    expect(
      buildSocialNextNpcConversationResolution({
        currentNpcName: "Mara",
        nextNpcId: "npc-ada",
        nextNpcName: "Ada",
        shouldSharpenObjective: false,
        socialLoopObjective: true,
      }),
    ).toMatchObject({
      decision: "talk to Ada next.",
      memoryKind: "person",
      memoryText:
        "Mara gave the block a clearer shape and pointed you toward the next person.",
      objectiveText: "Talk to Ada next.",
    });
    expect(
      buildGenericClosedWorkWindowConversationResolution({
        npcName: "Rin",
        shouldSharpenObjective: true,
      }),
    ).toMatchObject({
      decision:
        "stop chasing closed work windows and return to Morrow House to take stock.",
      memoryKind: "job",
      memoryText:
        "The block did not keep paid work windows open just because Rowan asked late.",
      objectiveText: "Return to Morrow House and take stock.",
      summary:
        "Rin made the closed work window explicit instead of reopening a stale route.",
    });
    expect(
      buildNpcConversationImpression({
        npcId: "npc-mara",
        nextMove: "Get to Kettle & Lamp and ask Ada for work.",
        objectiveText: "Find work today.",
      }),
    ).toBe(
      "Rowan sounded willing to get to Kettle & Lamp and ask Ada for work.",
    );
    expect(
      buildNpcConversationImpression({
        npcId: "npc-nia",
        nextMove: "Clear the jammed cart in Quay Square.",
        objectiveText: "Help the block.",
      }),
    ).toBe("Rowan paid attention to where the block might jam up.");
  });

  it("keeps first-afternoon return-home thought copy in scaffold data, not thought control flow", () => {
    const thoughtsSource = readFileSync(
      new URL("../src/ai/streetThoughts.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain(FIRST_AFTERNOON_RETURN_HOME_THOUGHT);
    expect(thoughtsSource).not.toContain(FIRST_AFTERNOON_RETURN_HOME_THOUGHT);
  });

  it("keeps first-afternoon tea-shift stage thoughts in scaffold data, not thought or engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const thoughtsSource = readFileSync(
      new URL("../src/ai/streetThoughts.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const stageThought of [
      FIRST_AFTERNOON_TEA_RUSH_THOUGHT,
      FIRST_AFTERNOON_TEA_COUNTER_THOUGHT,
    ]) {
      expect(scaffoldSource).toContain(stageThought);
      expect(engineSource).not.toContain(stageThought);
      expect(thoughtsSource).not.toContain(stageThought);
    }
  });

  it("keeps first-afternoon tea-shift watch copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const watchCopy of FIRST_AFTERNOON_TEA_SHIFT_WATCH_COPY) {
      expect(scaffoldSource).toContain(watchCopy);
      expect(engineSource).not.toContain(watchCopy);
    }

    expect(scaffoldSource).toContain("workStageWatchCopy");
    expect(engineSource).toContain("objectiveRouteWorkStageWatchCopy");
    expect(engineSource).not.toContain("teaShiftWatchLabel");
    expect(engineSource).not.toContain("teaShiftWatchDetail");
  });

  it("resolves first-afternoon tea-shift watch copy through scaffold data", () => {
    const world = seedStreetGame("game-tea-shift-watch-copy-scaffold");
    const objective: ObjectiveScaffoldDirective = {
      focus: "settle",
      routeKey: "first-afternoon",
      text: "Make the first afternoon count.",
    };

    expect(
      objectiveRouteWorkStageWatchCopy(world, objective, {
        jobId: "job-tea-shift",
        stage: undefined,
      }),
    ).toEqual({
      label: "Start the lunch rush",
      detail:
        "Lunch is filling Kettle & Lamp. Rowan can start with cups, tables, and the counter.",
    });
    expect(
      objectiveRouteWorkStageWatchCopy(world, objective, {
        jobId: "job-tea-shift",
        stage: "rush",
      }),
    ).toEqual({
      label: "Keep the lunch rush moving",
      detail:
        "The room is busy now. Rowan can keep clearing cups and watching Ada's rhythm.",
    });
    expect(
      objectiveRouteWorkStageWatchCopy(world, objective, {
        jobId: "job-tea-shift",
        stage: "counter",
      }),
    ).toEqual({
      label: "Finish the cup-and-counter shift",
      detail:
        "The rush is almost through. Rowan can finish the last counter pass and collect the pay.",
    });
  });

  it("keeps first-afternoon completion acknowledgement copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const acknowledgementCopy of [
      FIRST_AFTERNOON_COMPLETION_FEED,
      FIRST_AFTERNOON_COMPLETION_MEMORY,
      FIRST_AFTERNOON_COMPLETION_IDLE_LABEL,
      FIRST_AFTERNOON_COMPLETION_IDLE_DETAIL,
      FIRST_AFTERNOON_COMPLETION_RATIONALE,
      FIRST_AFTERNOON_COMPLETION_SUMMARY_TAIL,
    ]) {
      expect(scaffoldSource).toContain(acknowledgementCopy);
      expect(engineSource).not.toContain(acknowledgementCopy);
    }

    expect(engineSource).not.toContain(
      FIRST_AFTERNOON_COMPLETED_OBJECTIVE_BANNER_RATIONALE,
    );
    expect(scaffoldSource).toContain("completionIdleCopy");
    expect(scaffoldSource).toContain("completionRationale");
    expect(scaffoldSource).toContain("completionSummaryTail");
    expect(engineSource).toContain("objectiveRouteCompletionIdleCopy");
    expect(engineSource).toContain("objectiveRouteCompletionRationale");
    expect(engineSource).toContain("objectiveRouteCompletionSummaryTail");
  });

  it("resolves first-afternoon completion idle copy through scaffold data", () => {
    const world = seedStreetGame("game-first-afternoon-idle-copy-scaffold");
    const objective: ObjectiveScaffoldDirective = {
      focus: "settle",
      routeKey: "first-afternoon",
      text: "Make the first afternoon count.",
    };

    world.firstAfternoon = {
      ...world.firstAfternoon,
      completedAt: world.currentTime,
    };

    expect(objectiveRouteCompletionIdleCopy(world, objective)).toEqual({
      label: FIRST_AFTERNOON_COMPLETION_IDLE_LABEL,
      detail: FIRST_AFTERNOON_COMPLETION_IDLE_DETAIL,
    });
    expect(objectiveRouteCompletionRationale(world, objective)).toBe(
      FIRST_AFTERNOON_COMPLETION_RATIONALE,
    );
    expect(objectiveRouteCompletionSummaryTail(world, objective)).toContain(
      FIRST_AFTERNOON_COMPLETION_SUMMARY_TAIL,
    );

    expect(
      objectiveRouteCompletionIdleCopy(world, {
        ...objective,
        routeKey: "mara-ada-lead",
      }),
    ).toBeUndefined();
    expect(
      objectiveRouteCompletionRationale(world, {
        ...objective,
        routeKey: "mara-ada-lead",
      }),
    ).toBeUndefined();
    expect(
      objectiveRouteCompletionSummaryTail(world, {
        ...objective,
        routeKey: "mara-ada-lead",
      }),
    ).toBeUndefined();

    world.firstAfternoon.completedAt = undefined;
    expect(objectiveRouteCompletionIdleCopy(world, objective)).toBeUndefined();
    expect(objectiveRouteCompletionRationale(world, objective)).toBeUndefined();
    expect(objectiveRouteCompletionSummaryTail(world, objective)).toBeUndefined();
  });

  it("keeps first-afternoon completion player-thought copy in scaffold data, not thought control flow", () => {
    const thoughtsSource = readFileSync(
      new URL("../src/ai/streetThoughts.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain(FIRST_AFTERNOON_COMPLETION_PLAYER_THOUGHT);
    expect(thoughtsSource).not.toContain(
      FIRST_AFTERNOON_COMPLETION_PLAYER_THOUGHT,
    );
  });

  it("keeps first-afternoon completion outcome copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const outcomeCopy of [
      FIRST_AFTERNOON_COMPLETION_OUTCOME_PLAYER_THOUGHT,
      FIRST_AFTERNOON_COMPLETION_OUTCOME_FEED,
      FIRST_AFTERNOON_COMPLETION_OUTCOME_MEMORY,
    ]) {
      expect(scaffoldSource).toContain(outcomeCopy);
      expect(engineSource).not.toContain(outcomeCopy);
    }
    expect(engineSource).toContain(
      "world.player.currentThought = completionOutcome.playerThought",
    );
    expect(engineSource).toContain(
      'addFeed(world, "memory", completionOutcome.feedText)',
    );
    expect(engineSource).toContain(
      'remember(world, "self", completionOutcome.memoryText)',
    );
  });

  it("keeps outcome-label move rationale copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const outcomeMoveRationale of [
      ADA_LEAD_OUTCOME_MOVE_RATIONALE,
      FIRST_AFTERNOON_LOW_ENERGY_OUTCOME_MOVE_RATIONALE,
      FIRST_AFTERNOON_NORMAL_ENERGY_OUTCOME_MOVE_RATIONALE,
      TEA_SHIFT_OUTCOME_MOVE_RATIONALE,
    ]) {
      expect(scaffoldSource).toContain(outcomeMoveRationale);
    }
    expect(scaffoldSource).toContain("outcomeMoveRationales");
    expect(scaffoldSource).toContain("objectiveRouteMoveRationaleForOutcome");
    expect(engineSource).toContain("objectiveRouteMoveRationaleForOutcome");
    expect(engineSource).not.toContain("function moveRationaleForOutcome");
    expect(engineSource).not.toContain("moveRationaleForOutcome(world");
    expect(engineSource).not.toContain(
      FIRST_AFTERNOON_LOW_ENERGY_OUTCOME_MOVE_RATIONALE,
    );
    expect(engineSource).not.toContain(
      FIRST_AFTERNOON_NORMAL_ENERGY_OUTCOME_MOVE_RATIONALE,
    );
  });

  it("keeps player-facing autonomy rationale normalization copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const playerFacingCopy of [
      ADA_LEAD_OUTCOME_MOVE_RATIONALE,
      BAD_ADA_AT_MORROW_PLAYER_RATIONALE,
      ADA_AT_MORROW_ACTION_REASON,
      FIRST_AFTERNOON_LOW_ENERGY_PLAYER_RATIONALE,
      FIRST_AFTERNOON_NORMAL_ENERGY_PLAYER_RATIONALE,
      TEA_SHIFT_OUTCOME_MOVE_RATIONALE,
      NIA_RECOVERY_PLAYER_RATIONALE,
      NIA_STANDING_PLAYER_RATIONALE,
      MORROW_STANDING_LOW_ENERGY_PLAYER_RATIONALE,
      MORROW_STANDING_NORMAL_ENERGY_PLAYER_RATIONALE,
    ]) {
      expect(scaffoldSource).toContain(playerFacingCopy);
      expect(engineSource).not.toContain(playerFacingCopy);
    }

    expect(scaffoldSource).toContain("playerFacingRationaleNormalizations");
    expect(scaffoldSource).toContain("actionLocationReasons");
    expect(scaffoldSource).toContain("objectiveRouteHasNiaBlockLead");
    expect(engineSource).toContain(
      "objectiveRoutePlayerFacingAutonomyRationale",
    );
    expect(engineSource).toContain("objectiveRouteActionLocationReason");
    expect(engineSource).toContain("objectiveRouteHasNiaBlockLead");
    expect(engineSource).not.toContain("objectiveIsNiaBlockLead");
  });

  it("keeps home-return and current-opening move reason copy in scaffold data", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const moveReasonCopy of [
      ...HOME_RETURN_MOVE_REASON_COPY,
      ...CURRENT_OPENING_MOVE_REASON_COPY,
    ]) {
      expect(scaffoldSource).toContain(moveReasonCopy);
      expect(engineSource).not.toContain(moveReasonCopy);
    }

    expect(scaffoldSource).toContain("homeReturnMoveReasons");
    expect(scaffoldSource).toContain("currentOpeningMoveReasons");
    expect(scaffoldSource).toContain("objectiveRouteHomeReturnReason");
    expect(scaffoldSource).toContain("objectiveRouteCurrentOpeningMoveReason");
    expect(engineSource).toContain("objectiveRouteHomeReturnReason");
    expect(engineSource).toContain("objectiveRouteCurrentOpeningMoveReason");
    expect(engineSource).not.toContain("function groundedHomeReturnReason");
  });

  it("keeps Nia block-lead detection behind scaffold authority", () => {
    const world = seedStreetGame("game-nia-block-lead-scaffold-authority");
    const currentObjective = world.player.objective as PlayerObjective;

    const niaBlockLeadObjective: PlayerObjective = {
      ...currentObjective,
      focus: "help",
      routeKey: "people-nia",
      source: "conversation",
      text: "Ask Nia where the block is about to jam before the square feels it.",
      outcomes: [
        {
          authority: "predicate",
          id: "nia-block-lead",
          label: "Ask Nia where the block is about to jam",
          npcId: "npc-nia",
          status: "open",
          urgency: 86,
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      trail: [],
    };
    world.player.objective = niaBlockLeadObjective;

    expect(objectiveRouteHasNiaBlockLead(world)).toBe(true);

    world.player.objective = {
      ...niaBlockLeadObjective,
      text: "Ask Nia whether she has heard any cafe news.",
      outcomes: [
        {
          authority: "predicate",
          id: "nia-cafe-lead",
          label: "Ask Nia for cafe news",
          npcId: "npc-nia",
          status: "open",
          urgency: 40,
        },
      ],
    };

    expect(objectiveRouteHasNiaBlockLead(world)).toBe(false);
  });

  it("keeps Rowan notebook route and belief copy in scaffold helpers, not cognition narrative control flow", () => {
    const cognitionSource = readFileSync(
      new URL("../src/sim/rowanCognition.ts", import.meta.url),
      "utf8",
    );
    const narrativesSource = readFileSync(
      new URL("../src/sim/rowanCognitionNarratives.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );
    const modelSource = readFileSync(
      new URL("../src/sim/rowanCognitionModel.ts", import.meta.url),
      "utf8",
    );

    for (const notebookCopy of [
      ROWAN_NOTEBOOK_FIELD_NOTE_UNCERTAINTY,
      ROWAN_NOTEBOOK_JO_TOOLS_UNCERTAINTY,
      ROWAN_NOTEBOOK_NIA_UNCERTAINTY,
      ROWAN_NOTEBOOK_PUMP_UNCERTAINTY,
      ROWAN_NOTEBOOK_NIA_RECOVERY_PLAN,
      ROWAN_NOTEBOOK_RECOVERY_PLAN,
      ROWAN_NOTEBOOK_PUMP_PLAN,
      ROWAN_NOTEBOOK_YARD_PLAN,
      ROWAN_NOTEBOOK_STALE_ENTRY_FALLBACK,
      ROWAN_NOTEBOOK_FIELD_NOTE_CLUE,
      ROWAN_NOTEBOOK_YARD_CLUE,
      ROWAN_NOTEBOOK_PUMP_WITH_TOOL_CLUE,
    ]) {
      expect(scaffoldSource).toContain(notebookCopy);
      expect(narrativesSource).not.toContain(notebookCopy);
      expect(cognitionSource).not.toContain(notebookCopy);
    }

    expect(cognitionSource).toContain("rowanNotebookPlanText");
    expect(cognitionSource).toContain("rowanNotebookUncertaintyForBelief");
    expect(narrativesSource).toContain("objectiveRouteNotebookPlanFallback");
    expect(narrativesSource).toContain(
      "objectiveRouteNotebookBeliefUncertainty",
    );
    expect(scaffoldSource).toContain("notebookPlanFallback");
    expect(scaffoldSource).toContain("objectiveRouteNotebookBeliefClue");
    expect(narrativesSource).toContain("rowanNotebookUsesRecoveryRestNeed");
    expect(modelSource).toContain("rowanNotebookUsesRecoveryRestNeed");
    expect(narrativesSource).not.toContain('"help-pump"');
    expect(narrativesSource).not.toContain('"work-yard"');
    expect(cognitionSource).not.toContain("function notebookPlanText");
    expect(cognitionSource).not.toContain("function uncertaintyForBelief");
    expect(cognitionSource).not.toContain(
      "function isPostFirstAfternoonHomeRecoveryEntry",
    );
    expect(cognitionSource).not.toContain("function objectiveIsNiaBlockLead");
  });

  it("keeps Rowan cognition needs in the model and notebook belief catalog in scaffold data", () => {
    const cognitionSource = readFileSync(
      new URL("../src/sim/rowanCognition.ts", import.meta.url),
      "utf8",
    );
    const modelSource = readFileSync(
      new URL("../src/sim/rowanCognitionModel.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const modelCopyOrMarker of [
      "Keep a stable room",
      "Find steady income",
      "Stop feeling like a stranger",
      "Learn how South Quay fits together",
      "Keep enough energy to follow through",
    ]) {
      expect(modelSource).toContain(modelCopyOrMarker);
      expect(cognitionSource).not.toContain(modelCopyOrMarker);
    }

    for (const scaffoldCopyOrMarker of [
      "belief-first-afternoon-field-note",
      "belief-mara-room",
      "belief-ada-work",
      "belief-tomas-work",
      "belief-jo-tools",
      "belief-pump-standing",
      "belief-nia-current-lead",
      "belief-nia-people",
      "Ada has now seen Rowan ask directly, work through lunch, and record what changed; the opening room question is evidence, not the current plan.",
      "First afternoon field note",
      "Mara is the person most likely to tell Rowan what keeps a room at Morrow House from turning temporary again.",
      "Ada may have paid work at Kettle & Lamp if Rowan shows up before the lunch crowd fills the cafe.",
      "Tomas may have yard work when the freight window is open and Rowan sounds reliable enough to bother with.",
      "Jo is the clearest place to turn coins into the right tool when Rowan finally knows what he needs.",
      "The Morrow Yard pump is now a live house problem, not background noise Rowan can keep treating as later.",
      "Fixing the pump in Morrow Yard could turn house trouble into proof that Rowan notices what needs doing.",
      "Jo's clue points Rowan toward Nia before the block jam turns into someone else's problem.",
      "Jo at Mercer Repairs",
      "Nia seems like the kind of person who can explain who matters before Rowan wastes a whole afternoon guessing.",
    ]) {
      expect(scaffoldSource).toContain(scaffoldCopyOrMarker);
      expect(modelSource).not.toContain(scaffoldCopyOrMarker);
      expect(cognitionSource).not.toContain(scaffoldCopyOrMarker);
    }

    for (const scaffoldPolicyMarker of [
      "OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_TEMPLATES",
      "OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_RANKING_POLICIES",
      "stale-opening-shelter-after-first-afternoon",
      "settled-shelter-without-live-anchor",
    ]) {
      expect(scaffoldSource).toContain(scaffoldPolicyMarker);
      expect(modelSource).not.toContain(scaffoldPolicyMarker);
    }

    expect(cognitionSource).toContain("buildRowanNeeds");
    expect(cognitionSource).toContain("selectNotebookBelief");
    expect(modelSource).toContain("objectiveRouteNotebookBeliefs");
    expect(modelSource).toContain("objectiveRouteNotebookBeliefScoreAdjustment");
    expect(modelSource).toContain(
      "objectiveRouteNotebookBeliefMatchesObjective",
    );
    expect(cognitionSource).not.toContain("function buildRowanNeeds");
    expect(cognitionSource).not.toContain("function buildRowanBeliefs");
    expect(cognitionSource).not.toContain("function notebookBeliefScore");
    expect(cognitionSource).not.toContain("function objectiveMatchesBelief");
    expect(modelSource).not.toContain("staleOpeningShelter");
    expect(modelSource).not.toContain("score -= 220");
    expect(modelSource).not.toContain("score -= 90");
  });

  it("keeps poisoned first-afternoon Mara/Ada trail hints behind a current legal action", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-first-afternoon-poisoned-ada-route");
    const currentObjective = world.player.objective as PlayerObjective;
    const pumpProblem = world.problems.find(
      (problem) => problem.id === "problem-pump",
    );

    expect(pumpProblem).toBeDefined();

    if (!pumpProblem) {
      return;
    }

    world.player.currentLocationId = "courtyard";
    world.player.x = 3;
    world.player.y = 11;
    world.player.knownLocationIds = Array.from(
      new Set([...world.player.knownLocationIds, "courtyard", "tea-house"]),
    );
    world.player.inventory.push({
      description: "A worn wrench that can handle the yard pump.",
      id: "item-wrench",
      name: "Old wrench",
    });
    pumpProblem.discovered = true;
    pumpProblem.status = "active";
    pumpProblem.urgency = 7;
    pumpProblem.escalationLevel = 2;
    world.player.objective = {
      ...currentObjective,
      focus: "work",
      routeKey: "first-afternoon",
      source: "conversation",
      text: "Verify Mara's Kettle & Lamp lead before lunch gets busy.",
      outcomes: [
        {
          actionId: "solve:problem-pump",
          authority: "predicate",
          id: "live-pump-before-stale-ada-route",
          label:
            "Handle the live Morrow Yard pump before chasing stale Ada route hints",
          status: "open",
          targetLocationId: "courtyard",
          urgency: 99,
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      trail: [
        {
          actionId: "move:tea-house",
          detail:
            "This poisoned first-afternoon trail should explain old Mara/Ada context, not choose Rowan's current action.",
          done: false,
          id: "poisoned-mara-ada-route",
          targetLocationId: "tea-house",
          title:
            "Leave Morrow House, reach Kettle & Lamp, then ask Ada before lunch gets busy.",
        },
      ],
    };

    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 0,
      silent: true,
    });

    const selectedAutonomy = world.rowanAutonomy;
    const selectedTrace = selectedAutonomy.planningTrace;
    expect(selectedAutonomy.actionId).toBe("solve:problem-pump");
    expect(selectedAutonomy.targetLocationId).toBe("courtyard");
    expect(selectedTrace?.selectedActionId).toBe("solve:problem-pump");
    expect(selectedTrace?.selectedTargetLocationId).toBe("courtyard");
    expect(selectedTrace?.selectedPressureKind).toBe("problem");
    expect(selectedTrace?.selectedPressureLabel).toContain(
      "Leaking hand pump",
    );
    expect(selectedTrace?.selectedLegalBacking).toMatchObject({
      actionId: "solve:problem-pump",
      locationId: "courtyard",
      source: "current-legal-action-surface",
    });
    expect(
      selectedTrace?.considered.find(
        (option) => option.status === "selected",
      )?.provenance,
    ).toBe("live-pressure");
    expect(selectedTrace?.selectedTargetLocationId).not.toBe("tea-house");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(
      world.problems.find((problem) => problem.id === "problem-pump")?.status,
    ).toBe("solved");
    expect(world.player.currentLocationId).toBe("courtyard");
  });

  it("keeps first-afternoon route outcome and step metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      FIRST_AFTERNOON_ROUTE_OUTCOME_LABEL,
      FIRST_AFTERNOON_ROUTE_STEP_TITLE,
      FIRST_AFTERNOON_ROUTE_STEP_DETAIL,
      FIRST_AFTERNOON_ROUTE_COMPLETION_DETAIL,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("FIRST_AFTERNOON_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("FIRST_AFTERNOON_STEP_TEMPLATES");
    for (const outcomeCase of [
      "first-afternoon-room",
      "first-afternoon-choose-move",
      "first-afternoon-ada-lead",
      "first-afternoon-record-lead",
      "first-afternoon-take-shift",
      "first-afternoon-start-shift",
      "first-afternoon-finish-shift",
      "first-afternoon-take-stock",
    ]) {
      expect(scaffoldSource).toContain(`"${outcomeCase}"`);
      expect(objectiveStateSource).not.toContain(`case "${outcomeCase}"`);
    }
    for (const predicateCopy of [
      "Ada's lunch window has slipped; Rowan needs a current live alternative.",
      "The cup-and-counter shift window has slipped.",
      "Ada paid Rowan for the shift.",
      "Rowan is not back at Morrow House yet.",
    ]) {
      expect(scaffoldSource).toContain(predicateCopy);
      expect(objectiveStateSource).not.toContain(predicateCopy);
    }
    for (const routeConstructionSnippet of [
      'case "first-afternoon"',
      "buildFirstAfternoonRoute",
      "objectiveRouteFirstAfternoonRouteScaffold",
      "wrappedFirstAfternoon",
      "hasStartedTeaShift",
    ]) {
      expect(objectiveStateSource).not.toContain(routeConstructionSnippet);
    }
    expect(scaffoldSource).toContain("objectiveRouteScaffoldRouteForRouteKey");
    expect(objectiveStateSource).toContain(
      "objectiveRouteScaffoldRouteForRouteKey",
    );
    expect(objectiveStateSource).toContain(
      "objectiveRouteScaffoldOutcomeEvaluation",
    );
  });

  it("keeps Mara/Ada lead route outcome and step metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      MARA_ADA_ROUTE_OUTCOME_LABEL,
      MARA_ADA_ROUTE_STEP_TITLE,
      MARA_ADA_ROUTE_STEP_DETAIL,
      MARA_ADA_ROUTE_COMPLETION_DETAIL,
      MARA_ADA_ROUTE_HEADLINE,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("MARA_ADA_LEAD_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("MARA_ADA_LEAD_STEP_TEMPLATES");
    for (const outcomeCase of [
      "mara-ada-hear-lead",
      "mara-ada-form-intent",
      "mara-ada-walk-route",
      "mara-ada-ask-directly",
      "mara-ada-record-evidence",
      "mara-ada-open-choice",
    ]) {
      expect(scaffoldSource).toContain(`"${outcomeCase}"`);
      expect(objectiveStateSource).not.toContain(`case "${outcomeCase}"`);
    }
    for (const predicateCopy of [
      "The current objective is explicitly to verify Mara's Ada lead.",
      "Ada's lunch work is no longer a live lead.",
      "The lead has not opened a legal work choice yet.",
      "Cup-and-counter shift is available.",
    ]) {
      expect(scaffoldSource).toContain(predicateCopy);
      expect(objectiveStateSource).not.toContain(predicateCopy);
    }
    for (const routeConstructionSnippet of [
      'case "mara-ada-lead"',
      "buildMaraAdaLeadRoute",
      "objectiveRouteMaraAdaLeadRouteScaffold",
      "hasFormedVerificationIntent",
      "hasOpenWorkChoice",
    ]) {
      expect(objectiveStateSource).not.toContain(routeConstructionSnippet);
    }
    expect(scaffoldSource).toContain("objectiveRouteScaffoldRouteForRouteKey");
    expect(objectiveStateSource).toContain(
      "objectiveRouteScaffoldRouteForRouteKey",
    );
    expect(objectiveStateSource).toContain(
      "objectiveRouteScaffoldOutcomeEvaluation",
    );
  });

  it("keeps work route outcome, step, and headline metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      WORK_ROUTE_COMMIT_OUTCOME_LABEL,
      WORK_ROUTE_YARD_STEP_TITLE,
      WORK_ROUTE_TEA_STEP_DETAIL,
      WORK_ROUTE_PAY_STEP_DETAIL,
      WORK_ROUTE_TEA_HEADLINE,
      WORK_ROUTE_YARD_HEADLINE,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("WORK_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("WORK_STEP_TEMPLATES");
    expect(objectiveStateSource).toContain("objectiveRouteWorkRouteScaffold");
    expect(objectiveStateSource).toContain('case "work-commit"');
  });

  it("keeps settle route outcome and step metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      SETTLE_ROUTE_TERMS_OUTCOME_LABEL,
      SETTLE_ROUTE_STANDING_OUTCOME_LABEL,
      SETTLE_ROUTE_LEAD_OUTCOME_LABEL,
      SETTLE_ROUTE_TERMS_STEP_TITLE_ANCHOR,
      SETTLE_ROUTE_TERMS_STEP_DETAIL,
      SETTLE_ROUTE_STANDING_STEP_DETAIL,
      SETTLE_ROUTE_YARD_STEP_TITLE,
      SETTLE_ROUTE_INCOME_STEP_TITLE,
      SETTLE_ROUTE_PEOPLE_STEP_TITLE,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("SETTLE_ROUTE_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("SETTLE_ROUTE_STEP_TEMPLATES");
    expect(scaffoldSource).toContain('routeKeys: ["settle-core"]');
    expect(scaffoldSource).toContain(SETTLE_ROUTE_HEADLINE);
    expect(objectiveStateSource).toContain("objectiveRouteSettleRouteScaffold");
    expect(objectiveStateSource).toContain('case "settle-standing"');
  });

  it("keeps people and explore route metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      PEOPLE_ROUTE_OUTCOME_LABEL,
      PEOPLE_ROUTE_STEP_TITLE,
      PEOPLE_ROUTE_STEP_DETAIL,
      PEOPLE_ROUTE_HEADLINE,
      EXPLORE_ROUTE_OUTCOME_LABEL,
      EXPLORE_ROUTE_STEP_TITLE,
      EXPLORE_ROUTE_STEP_DETAIL,
      EXPLORE_ROUTE_HEADLINE,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("PEOPLE_ROUTE_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("PEOPLE_ROUTE_STEP_TEMPLATES");
    expect(scaffoldSource).toContain("EXPLORE_ROUTE_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("EXPLORE_ROUTE_STEP_TEMPLATES");
    expect(scaffoldSource).toContain('routeKeyPrefixes: ["people-"]');
    expect(scaffoldSource).toContain('routeKeyPrefixes: ["explore-"]');
    expect(objectiveStateSource).toContain("objectiveRoutePeopleRouteScaffold");
    expect(objectiveStateSource).toContain(
      "objectiveRouteExploreRouteScaffold",
    );
    expect(objectiveStateSource).toContain('case "people-talk"');
    expect(objectiveStateSource).toContain('case "explore-go"');
  });

  it("keeps problem and tool outcome policy copy in scaffold helpers, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const outcomeCopy of PROBLEM_TOOL_OUTCOME_COPY) {
      expect(scaffoldSource).toContain(outcomeCopy);
      expect(objectiveStateSource).not.toContain(outcomeCopy);
    }

    for (const outcomeCase of [
      "help-cart-inspect",
      "cart-discovered",
      "help-cart-solve",
      "cart-solved",
      "help-pump-inspect",
      "pump-discovered",
      "help-pump-tool",
      "tool-buy",
      "wrench-in-inventory",
      "help-pump-fix",
      "pump-solved",
      "tool-return",
      "tool-use",
    ]) {
      expect(objectiveStateSource).not.toContain(`case "${outcomeCase}"`);
    }

    expect(scaffoldSource).toContain(
      "objectiveRouteProblemToolOutcomeEvaluation",
    );
    expect(scaffoldSource).toContain(
      "CART_PROBLEM_OUTCOME_EVALUATION_TEMPLATES",
    );
    expect(scaffoldSource).toContain(
      "PUMP_PROBLEM_OUTCOME_EVALUATION_TEMPLATES",
    );
    expect(scaffoldSource).toContain(
      "TOOL_PROBLEM_OUTCOME_EVALUATION_TEMPLATES",
    );
    expect(objectiveStateSource).toContain(
      "objectiveRouteProblemToolOutcomeEvaluation",
    );
  });

  it("keeps route-derived semantic, intent, bonus, and pressure rules scaffold-owned", () => {
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );
    const scaffoldDataSource = scaffoldSource.slice(
      scaffoldSource.indexOf("const OBJECTIVE_ROUTE_SCAFFOLDS"),
      scaffoldSource.indexOf("export function objectiveRouteSemanticHints"),
    );
    const semanticHintsSource = scaffoldSource.slice(
      scaffoldSource.indexOf("export function objectiveRouteSemanticHints"),
      scaffoldSource.indexOf("export function objectiveRouteCompletionAcknowledgement"),
    );
    const moveIntentSource = scaffoldSource.slice(
      scaffoldSource.indexOf("export function objectiveRouteMoveIntent"),
      scaffoldSource.indexOf("function resolveScaffoldString"),
    );
    const semanticBonusSource = scaffoldSource.slice(
      scaffoldSource.indexOf("export function objectiveRouteSemanticMoveBonus"),
      scaffoldSource.indexOf("export function objectiveRouteActionPressureScore"),
    );
    const actionPressureSource = scaffoldSource.slice(
      scaffoldSource.indexOf("export function objectiveRouteActionPressureScore"),
      scaffoldSource.indexOf("export function objectiveRouteSpeech"),
    );

    expect(scaffoldSource).not.toContain("function addRouteDerivedSemanticHints");
    expect(scaffoldSource).not.toContain("function routeDerivedMoveIntent");
    expect(scaffoldSource).not.toContain(
      "function routeDerivedSemanticMoveBonus",
    );

    for (const helperSource of [
      semanticHintsSource,
      moveIntentSource,
      semanticBonusSource,
      actionPressureSource,
    ]) {
      expect(helperSource).not.toContain('startsWith("people-")');
      expect(helperSource).not.toContain('startsWith("explore-")');
      expect(helperSource).not.toContain('startsWith("commitment-")');
      expect(helperSource).not.toContain('includes("pump")');
      expect(helperSource).not.toContain('includes("cart")');
      expect(helperSource).not.toContain('includes("tool")');
      expect(helperSource).not.toContain("objectiveTextMentionsTool");
    }

    for (const scaffoldOwnedRule of [
      "actionPressureRules",
      "semanticMoveBonuses",
      "moveIntents",
      "objectiveFocuses",
      "objectiveMatches",
      "peopleRouteNpcLocationId",
      "exploreRouteSemanticLocationId",
      "commitmentRouteJobLocationId",
      "problemRouteLocationId",
      "objectiveTextMentionsTool",
    ]) {
      expect(scaffoldDataSource).toContain(scaffoldOwnedRule);
    }
  });

  it("preserves scaffold-owned route semantics at the exported helper boundary", () => {
    const world = seedStreetGame("route-scaffold-owned-semantics");
    const ada = world.npcs.find((npc) => npc.id === "npc-ada");
    const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    const cart = world.problems.find((problem) => problem.id === "problem-cart");

    expect(ada?.currentLocationId).toBe("tea-house");
    expect(teaJob?.locationId).toBe("tea-house");
    expect(pump?.locationId).toBeDefined();
    expect(cart?.locationId).toBeDefined();
    if (!ada || !teaJob || !pump || !cart) {
      return;
    }

    const peopleObjective: ObjectiveScaffoldDirective = {
      focus: "people",
      routeKey: "people-npc-ada",
      text: "Meet Ada and make a real introduction.",
    };
    const peopleHints = objectiveRouteSemanticHints(world, peopleObjective);
    expect(peopleHints.npcIds).toContain("npc-ada");
    expect(
      objectiveRouteMoveIntent(world, peopleObjective, ada.currentLocationId),
    ).toMatchObject({
      npcId: "npc-ada",
      rationale:
        "Walk to Kettle & Lamp and make a real introduction with Ada.",
    });
    expect(
      objectiveRouteSemanticMoveBonus(
        world,
        peopleObjective,
        ada.currentLocationId,
        { predicateAuthority: false },
      ),
    ).toBe(24);

    const exploreObjective: ObjectiveScaffoldDirective = {
      focus: "explore",
      routeKey: "explore-tea-house",
      text: "Explore Kettle & Lamp and get your bearings.",
    };
    expect(
      objectiveRouteSemanticHints(world, exploreObjective).locationIds,
    ).toContain("tea-house");
    expect(
      objectiveRouteSemanticMoveBonus(world, exploreObjective, "tea-house", {
        predicateAuthority: false,
      }),
    ).toBe(22);
    expect(
      objectiveRouteActionPressureScore(exploreObjective, {
        actionId: "move:freight-yard",
        actionKind: "move",
        currentLocationId: "boarding-house",
        planTargetLocationId: "freight-yard",
        predicateAuthority: false,
      }),
    ).toBe(-58);
    expect(
      objectiveRouteActionPressureScore(exploreObjective, {
        actionId: "move:tea-house",
        actionKind: "move",
        currentLocationId: "boarding-house",
        planTargetLocationId: "tea-house",
        predicateAuthority: false,
      }),
    ).toBe(0);

    const commitmentObjective: ObjectiveScaffoldDirective = {
      focus: "work",
      routeKey: "commitment-job-tea-shift",
      text: "Follow through on accepted work before the window closes.",
    };
    expect(
      objectiveRouteSemanticHints(world, commitmentObjective).locationIds,
    ).toContain(teaJob.locationId);

    const toolObjective: ObjectiveScaffoldDirective = {
      focus: "tool",
      routeKey: "tool-pump",
      text: "Buy a wrench for the pump and bring it back.",
    };
    const toolHints = objectiveRouteSemanticHints(world, toolObjective);
    expect(toolHints.locationIds).toEqual(
      expect.arrayContaining([pump.locationId, "repair-stall"]),
    );
    expect(toolHints.npcIds).toContain("npc-jo");
    expect(
      objectiveRouteMoveIntent(world, toolObjective, "repair-stall"),
    ).toMatchObject({
      actionId: "buy:item-wrench",
      rationale:
        "Walk to Jo's repair stall and buy the wrench the problem needs.",
    });
    expect(
      objectiveRouteSemanticMoveBonus(world, toolObjective, "repair-stall", {
        predicateAuthority: true,
      }),
    ).toBe(28);
    expect(
      objectiveRouteActionPressureScore(toolObjective, {
        actionId: "buy:item-wrench",
        actionKind: "buy",
        currentLocationId: "repair-stall",
        planTargetLocationId: "repair-stall",
        predicateAuthority: false,
      }),
    ).toBe(36);
    expect(
      objectiveRouteActionPressureScore(toolObjective, {
        actionId: "talk:npc-jo",
        actionKind: "talk",
        currentLocationId: "repair-stall",
        planTargetLocationId: "repair-stall",
        predicateAuthority: false,
      }),
    ).toBe(-18);

    world.player.inventory.push({
      description: "A worn wrench that can handle the yard pump.",
      id: "item-wrench",
      name: "Old wrench",
    });
    const helpPumpObjective: ObjectiveScaffoldDirective = {
      focus: "help",
      routeKey: "help-pump",
      text: "Fix the leaking pump in Morrow Yard.",
    };
    expect(
      objectiveRouteSemanticMoveBonus(
        world,
        helpPumpObjective,
        pump.locationId,
        { predicateAuthority: false },
      ),
    ).toBe(20);

    const helpCartObjective: ObjectiveScaffoldDirective = {
      focus: "help",
      routeKey: "help-cart",
      text: "Clear the jammed cart before it snarls the square.",
    };
    expect(
      objectiveRouteSemanticHints(world, helpCartObjective).locationIds,
    ).toContain(cart.locationId);
  });

  it("keeps committed-job and rest route metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      COMMITTED_JOB_ROUTE_OUTCOME_LABEL_SUFFIX,
      COMMITTED_JOB_ROUTE_STEP_DETAIL,
      COMMITTED_JOB_ROUTE_WINDOW_DETAIL,
      COMMITTED_JOB_ROUTE_HEADLINE,
      REST_ROUTE_OUTCOME_LABEL,
      REST_ROUTE_RETURN_DETAIL,
      REST_ROUTE_HOUR_DETAIL,
      REST_ROUTE_HEADLINE,
      REST_ROUTE_DEFAULT_TEXT,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("COMMITTED_JOB_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("COMMITTED_JOB_STEP_TEMPLATES");
    expect(scaffoldSource).toContain("REST_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("REST_STEP_TEMPLATES");
    expect(scaffoldSource).toContain('routeKeyPrefixes: ["commitment-"]');
    expect(scaffoldSource).toContain('routeKeys: ["rest-home"]');
    expect(objectiveStateSource).toContain(
      "objectiveRouteCommittedJobRouteScaffold",
    );
    expect(objectiveStateSource).toContain("objectiveRouteRestRouteScaffold");
    expect(objectiveStateSource).toContain(
      'definition.id.startsWith("commitment-finish-")',
    );
    expect(objectiveStateSource).toContain('case "rest-hour"');
  });

  it("does not turn stale trail titles into Rowan's deterministic thought", () => {
    const world = worldWithPoisonedTrail();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toMatch(/Mara/i);
    expect(thoughts.playerThought).not.toMatch(
      /stale|old pier|poisoned|route/i,
    );
  });

  it("labels unfinished trail items as supporting hints in the thought prompt", () => {
    const world = worldWithPoisonedTrail();

    const prompt = buildGenerateStreetThoughtsPrompt(world);

    expect(prompt).toContain("Rowan's objective authority");
    expect(prompt).toContain("desiredOutcomes");
    expect(prompt).toContain("currentAutonomy");
    expect(prompt).toContain("supporting_hint");
    expect(prompt).toContain("supportingRouteHints");
    expect(prompt).toContain("Follow the stale route to the old pier");
    expect(prompt).not.toContain("Rowan's current plan");
    expect(prompt).not.toContain('"nextSteps"');
    expect(prompt).not.toContain('"trail"');
  });

  it("exposes conversation authority as outcomes, autonomy, and legal actions first", () => {
    const world = worldWithPoisonedTrail();

    const context = buildStreetConversationContext({
      game: world,
      npcId: "npc-mara",
      playerText:
        "What should I do first if I want to keep the room and find honest work?",
    });
    const rowan = buildPlainRowanContext(context);
    const rowanText = JSON.stringify(rowan);
    const rowanRecord = rowan as Record<string, unknown>;

    expect(rowanRecord.currentPlan).toBeUndefined();
    expect(rowanText).toContain("objectiveAuthority");
    expect(rowanText).toContain("desiredOutcomes");
    expect(rowanText).toContain("openDesiredOutcomes");
    expect(rowanText).toContain(
      "Ask Mara what keeps the Morrow House room stable",
    );
    expect(rowanText).toContain("currentAutonomy");
    expect(rowanText).toContain(
      "Mara is here, so Rowan can ask the question in person.",
    );
    expect(rowanText).toContain("availableLegalActions");
    expect(rowanText).toContain("talk:npc-mara");
    expect(rowanText).toContain("supportingRouteHints");
    expect(rowanText).toContain("supporting_hint");
    expect(rowanText).toContain("Follow the stale route to the old pier");
    expect(rowanText).not.toContain("nextSteps");
  });

  it("keeps stale route hints out of authoritative dialogue prompt fields", () => {
    const world = worldWithPoisonedTrail();

    const prompt = buildGenerateStreetReplyPrompt({
      game: world,
      npcId: "npc-mara",
      playerText:
        "What should I do first if I want to keep the room and find honest work?",
    });

    expect(prompt).toContain("rowan.objectiveAuthority");
    expect(prompt).toContain("currentAutonomy");
    expect(prompt).toContain("availableLegalActions");
    expect(prompt).toContain("supportingRouteHints");
    expect(prompt).toContain("supporting_hint");
    expect(prompt).toContain("Follow the stale route to the old pier");
    expect(prompt).not.toContain('"currentPlan"');
    expect(prompt).not.toContain('"nextSteps"');
    expect(prompt).not.toContain('"trail"');
  });

  it("uses the same objective authority contract for Rowan speech and conversation interpretation", () => {
    const world = worldWithPoisonedTrail();
    const objective = {
      focus: world.player.objective?.focus ?? "settle",
      routeKey: world.player.objective?.routeKey ?? "first-afternoon",
      text:
        world.player.objective?.text ?? "Ask Mara what keeps the room stable",
    };

    const autonomousPrompt = buildGenerateStreetAutonomousLinePrompt({
      game: world,
      npcId: "npc-mara",
      objective,
      purpose: "opener",
    });
    const interpretPrompt = buildInterpretStreetConversationPrompt({
      closingReply:
        "Ask Ada at Kettle & Lamp before lunch if you need work today.",
      discussedTopics: ["room", "work", "Ada"],
      game: world,
      npcId: "npc-mara",
      objective,
    });

    for (const prompt of [autonomousPrompt, interpretPrompt]) {
      expect(prompt).toContain("rowan.objectiveAuthority");
      expect(prompt).toContain("currentAutonomy");
      expect(prompt).toContain("availableLegalActions");
      expect(prompt).toContain("supportingRouteHints");
      expect(prompt).toContain("supporting_hint");
      expect(prompt).not.toContain('"currentPlan"');
      expect(prompt).not.toContain('"nextSteps"');
      expect(prompt).not.toContain('"trail"');
    }
  });

  it("does not let poisoned trail text dominate deterministic dialogue selection", () => {
    const world = worldWithPoisonedTrail();

    const reply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-mara",
      playerText:
        "What should I do first if I want to keep the room and find honest work?",
    });

    expect(reply.reply).toMatch(
      /Ada|Kettle|Lamp|lunch|work|shift|counter|pay/i,
    );
    expect(reply.reply).not.toMatch(/old pier|poisoned|stale route/i);
  });

  it("lets a current Mara predicate outrank first-afternoon route-key fallback dialogue", () => {
    const world = worldWithPoisonedTrail();

    const reply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-mara",
      playerText: "What matters most right now?",
    });

    expect(reply.reply).toMatch(/room|Morrow House|shared spaces|pay|house/i);
    expect(reply.reply).not.toMatch(
      /Ada|Kettle|Lamp|lunch|old pier|poisoned|route/i,
    );
  });

  it("lets live autonomy and discovered problems outrank stale first-afternoon thought copy", () => {
    const world = worldWithStaleFirstAfternoonThoughtAndLivePump();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toMatch(/pump/i);
    expect(thoughts.playerThought).not.toMatch(
      /bed|tomorrow|lead|Morrow House|let today land/i,
    );
  });

  it("keeps live problem-route pump and cart thoughts visible through street-sim data", () => {
    const pumpWorld = worldWithStaleFirstAfternoonThoughtAndLivePump();
    const cartWorld = seedStreetGame("game-reasoning-live-cart-thought");
    const cart = cartWorld.problems.find(
      (problem) => problem.id === "problem-cart",
    );

    cartWorld.rowanAutonomy = {
      actionId: "solve:problem-cart",
      autoContinue: true,
      detail: "The cart is active, so moving it is the live useful move.",
      intent: {
        reason: "The cart is active, so moving it is the live useful move.",
        signals: ["Problem: cart active"],
      },
      key: "objective:solve:cart",
      label: "Move the cart",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "quay-square",
    };
    if (cart) {
      cart.discovered = true;
      cart.status = "active";
    }

    expect(buildDeterministicStreetThoughts(pumpWorld).playerThought).toBe(
      "I should go fix that pump.",
    );
    expect(buildDeterministicStreetThoughts(cartWorld).playerThought).toBe(
      "I need to move that cart.",
    );
  });

  it("keeps recent conversation lead thoughts visible through street-sim data", () => {
    const maraWorld = worldWithRecentConversationLead(
      "npc-mara",
      "Buy a wrench and fix the pump.",
      "get to Mercer Repairs for a wrench, then come back to the pump.",
    );
    const adaWorld = worldWithRecentConversationLead(
      "npc-ada",
      "Take the cup-and-counter shift at Kettle & Lamp.",
      "stay with Ada and take the tea-house shift if the room still needs the hands.",
    );

    expect([
      "Mercer Repairs is the next stop if Rowan wants to handle the pump.",
      "The pump talk only matters if Rowan comes back with a tool.",
      "Rowan has a clear next errand now.",
    ].map(sanitizeThought)).toContain(
      buildDeterministicStreetThoughts(maraWorld).npcThoughts["npc-mara"],
    );
    expect([
      "If Rowan wants the shift, he can start with the cups.",
      "The room is busy, but there is space for steady hands.",
      "I gave Rowan the terms. Now he can decide.",
    ].map(sanitizeThought)).toContain(
      buildDeterministicStreetThoughts(adaWorld).npcThoughts["npc-ada"],
    );
  });

  it("keeps NPC problem-state reactions visible through street-sim data", () => {
    const world = seedStreetGame("game-reasoning-npc-problem-thoughts");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    const cart = world.problems.find((problem) => problem.id === "problem-cart");

    if (pump) {
      pump.discovered = true;
      pump.status = "active";
    }
    if (cart) {
      cart.discovered = true;
      cart.status = "active";
    }

    const thoughts = buildDeterministicStreetThoughts(world);

    expect([
      "That pump is making the yard harder than it needs to be.",
      "I need that pump sorted before supper.",
      "A small leak becomes everyone's problem fast.",
    ].map(sanitizeThought)).toContain(thoughts.npcThoughts["npc-mara"]);
    expect([
      "That cart is going to jam the square.",
      "Somebody needs to move that cart early.",
      "That bad wheel is going to jam things up.",
    ].map(sanitizeThought)).toContain(thoughts.npcThoughts["npc-nia"]);
  });

  it("keeps first-afternoon cafe-stage thoughts when the tea shift is the active commitment", () => {
    const world = worldWithActiveTeaCommitment();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toBe(FIRST_AFTERNOON_TEA_RUSH_THOUGHT);
    expect(thoughts.playerThought).not.toMatch(/pump|wrench|Morrow House/i);
  });

  it("keeps first-afternoon counter-stage thoughts when the tea shift reaches the counter", () => {
    const world = worldWithActiveTeaCommitment("counter");

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toBe(FIRST_AFTERNOON_TEA_COUNTER_THOUGHT);
    expect(thoughts.playerThought).not.toMatch(/pump|wrench|Morrow House/i);
  });

  it("keeps first-afternoon return-home thought visible through scaffold data", () => {
    const world = worldWithPaidFirstAfternoonReturnThought();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toBe(FIRST_AFTERNOON_RETURN_HOME_THOUGHT);
  });

  it("keeps completed first-afternoon player thought visible through scaffold data", () => {
    const world = worldWithCompletedFirstAfternoonPlayerThought();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toBe(
      FIRST_AFTERNOON_COMPLETION_PLAYER_THOUGHT,
    );
  });
});
