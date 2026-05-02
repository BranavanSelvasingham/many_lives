import type { NpcState } from "@/lib/street/types";

export type CharacterMotionStyle = {
  armLift: number;
  armSwing: number;
  bodyBob: number;
  headBob: number;
  headTilt: number;
  idleWave: number;
  legLift: number;
  legSwing: number;
  shadowPulse: number;
  squash: number;
  stepPower: number;
  torsoLean: number;
  torsoLift: number;
};

export type NpcPersonalityProfile = {
  badge: string;
  chatSubtitle: string;
  labelBackground: string;
  labelColor: string;
  listLine: string;
  motion: CharacterMotionStyle;
  pace: number;
  scale: number;
  signature: string;
  stepStrength: number;
  sway: number;
  swayRate: number;
};

export const DEFAULT_CHARACTER_MOTION_STYLE: CharacterMotionStyle = {
  armLift: 1,
  armSwing: 1,
  bodyBob: 1,
  headBob: 1,
  headTilt: 1,
  idleWave: 1,
  legLift: 1,
  legSwing: 1,
  shadowPulse: 1,
  squash: 1,
  stepPower: 1,
  torsoLean: 0,
  torsoLift: 1,
};

export function npcPersonalityProfile(
  npc: NpcState,
): NpcPersonalityProfile {
  switch (npc.id) {
    case "npc-mara":
      return {
        badge: "Hearth-Eyed Keeper",
        chatSubtitle:
          "Keeps the house steady with one look and two quiet steps.",
        labelBackground: "rgba(54, 41, 29, 0.92)",
        labelColor: "#f3dec0",
        listLine:
          "Grounded, observant, and warmer than she lets on at first glance.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armSwing: 0.76,
          bodyBob: 0.82,
          headTilt: 0.74,
          idleWave: 1.08,
          stepPower: 0.8,
          torsoLean: 0.05,
          torsoLift: 0.82,
        },
        pace: 0.88,
        scale: 1.03,
        signature:
          "She moves like she already knows who needs help before they ask.",
        stepStrength: 0.72,
        sway: 0.02,
        swayRate: 0.72,
      };
    case "npc-ada":
      return {
        badge: "Clockwork Hostess",
        chatSubtitle:
          "Every gesture is quick, practiced, and somehow still welcoming.",
        labelBackground: "rgba(28, 63, 61, 0.92)",
        labelColor: "#d9f2ef",
        listLine:
          "Brisk and bright, always half a beat ahead of the room around her.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armSwing: 1.08,
          bodyBob: 0.92,
          headTilt: 0.86,
          idleWave: 0.88,
          stepPower: 1,
          torsoLean: 0.18,
          torsoLift: 0.96,
        },
        pace: 1.15,
        scale: 1,
        signature:
          "She cuts through the street like she has six tasks balanced in one hand.",
        stepStrength: 0.96,
        sway: 0.014,
        swayRate: 1.22,
      };
    case "npc-jo":
      return {
        badge: "Grease-Stained Fixer",
        chatSubtitle:
          "Loose shoulders, sharp eyes, and the kind of stillness that means thinking.",
        labelBackground: "rgba(32, 39, 45, 0.92)",
        labelColor: "#dde5ec",
        listLine:
          "A little slouched, a little guarded, but impossible to mistake for anyone else.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armLift: 0.84,
          armSwing: 0.7,
          bodyBob: 0.74,
          headBob: 0.84,
          headTilt: 0.62,
          idleWave: 1.26,
          legLift: 0.88,
          legSwing: 0.82,
          stepPower: 0.86,
          torsoLean: -0.12,
          torsoLift: 0.72,
        },
        pace: 0.95,
        scale: 0.99,
        signature: "He walks like a person who trusts tools more than noise.",
        stepStrength: 0.8,
        sway: 0.026,
        swayRate: 0.96,
      };
    case "npc-tomas":
      return {
        badge: "Dock-Bell Foreman",
        chatSubtitle:
          "Practical, busy, and easier to talk to when the cart lane is clear.",
        labelBackground: "rgba(67, 46, 26, 0.94)",
        labelColor: "#f0d8b0",
        listLine:
          "Broad, deliberate, and usually thinking three crates ahead.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armLift: 0.72,
          armSwing: 0.62,
          bodyBob: 0.7,
          headBob: 0.76,
          headTilt: 0.54,
          idleWave: 0.8,
          legLift: 0.82,
          legSwing: 0.72,
          shadowPulse: 1.18,
          squash: 0.84,
          stepPower: 0.9,
          torsoLean: 0.08,
          torsoLift: 0.62,
        },
        pace: 0.84,
        scale: 1.08,
        signature: "Even at rest, he reads like a warning nailed to a post.",
        stepStrength: 0.9,
        sway: 0.012,
        swayRate: 0.8,
      };
    case "npc-nia":
      return {
        badge: "Street-Swift Spark",
        chatSubtitle:
          "Every stop looks temporary, like she might launch into a sprint mid-sentence.",
        labelBackground: "rgba(34, 68, 49, 0.92)",
        labelColor: "#e3f6d4",
        listLine:
          "Quick, spring-loaded, and already halfway into the next idea.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armSwing: 1.16,
          bodyBob: 1.24,
          headBob: 1.22,
          headTilt: 1.08,
          idleWave: 1.42,
          legLift: 1.08,
          legSwing: 1.18,
          stepPower: 1.14,
          torsoLean: 0.14,
          torsoLift: 1.08,
        },
        pace: 1.28,
        scale: 0.98,
        signature:
          "She crosses the square like the air itself is hurrying her along.",
        stepStrength: 1.12,
        sway: 0.032,
        swayRate: 1.78,
      };
    default:
      return {
        badge: "Neighborhood Regular",
        chatSubtitle:
          "A familiar shape in the district, easy to place even before you know the details.",
        labelBackground: "rgba(34, 43, 49, 0.92)",
        labelColor: "#e1e8ed",
        listLine:
          "Distinct enough to notice, still holding most of their story close.",
        motion: DEFAULT_CHARACTER_MOTION_STYLE,
        pace: 1,
        scale: 1,
        signature: "They carry themselves like they belong to these lanes.",
        stepStrength: 0.86,
        sway: 0.018,
        swayRate: 1,
      };
  }
}
