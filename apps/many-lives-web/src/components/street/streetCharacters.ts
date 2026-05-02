import type PhaserType from "phaser";

import { DEFAULT_CHARACTER_MOTION_STYLE } from "@/lib/street/npcPersonality";
import type { CharacterMotionStyle } from "@/lib/street/npcPersonality";
import { blendColor } from "@/lib/street/renderColor";
import type { NpcState } from "@/lib/street/types";

export type CharacterAppearance = {
  accent: number;
  accessory?: "apron" | "satchel" | "scarf" | "shawl" | "vest";
  coat: number;
  face: number;
  hair: number;
  hairStyle: "beard-cap" | "bun" | "cap" | "cropped" | "ponytail" | "scarf";
  outline: number;
};

export type CharacterRig = {
  accent: PhaserType.GameObjects.Rectangle;
  avatar: PhaserType.GameObjects.Container;
  head: PhaserType.GameObjects.Container;
  leftArm: PhaserType.GameObjects.Container;
  leftLeg: PhaserType.GameObjects.Container;
  rightArm: PhaserType.GameObjects.Container;
  rightLeg: PhaserType.GameObjects.Container;
  shadow: PhaserType.GameObjects.Ellipse;
  torso: PhaserType.GameObjects.Ellipse;
};

export function playerCharacterAppearance(): CharacterAppearance {
  return {
    accent: 0xf4d6a1,
    accessory: "scarf",
    coat: 0x4f78c9,
    face: 0xd7a476,
    hair: 0x4f3d31,
    hairStyle: "cropped",
    outline: 0x101820,
  };
}

export function characterAppearanceForNpc(npc: NpcState): CharacterAppearance {
  const knownAppearance: CharacterAppearance =
    npc.id === "npc-mara"
      ? {
          accent: 0xd9ceb7,
          accessory: "apron",
          coat: 0x837058,
          face: 0xbf8466,
          hair: 0x7c796f,
          hairStyle: "bun",
          outline: 0x13181c,
        }
      : npc.id === "npc-ada"
        ? {
            accent: 0xdcbfa0,
            accessory: "shawl",
            coat: 0x567776,
            face: 0xe4bb99,
            hair: 0xcd945f,
            hairStyle: "scarf",
            outline: 0x13181c,
          }
        : npc.id === "npc-jo"
          ? {
              accent: 0xb2bec6,
              accessory: "satchel",
              coat: 0x596771,
              face: 0x9f6c54,
              hair: 0x3b4043,
              hairStyle: "cap",
              outline: 0x13181c,
            }
          : npc.id === "npc-tomas"
            ? {
                accent: 0xbeb085,
                accessory: "vest",
                coat: 0x77684a,
                face: 0x684531,
                hair: 0x292420,
                hairStyle: "beard-cap",
                outline: 0x13181c,
              }
            : npc.id === "npc-nia"
              ? {
                  accent: 0xc0daaf,
                  accessory: "scarf",
                  coat: 0x4f8370,
                  face: 0xcf926c,
                  hair: 0x62452e,
                  hairStyle: "ponytail",
                  outline: 0x13181c,
                }
              : {
                  accent: 0xc4b28f,
                  coat: 0x6e6452,
                  face: 0xcd9e79,
                  hair: 0x43392d,
                  hairStyle: "cropped",
                  outline: 0x13181c,
                };

  if (npc.known) {
    return knownAppearance;
  }

  return {
    ...knownAppearance,
    accent: blendColor(knownAppearance.accent, 0x49515a, 0.36),
    coat: blendColor(knownAppearance.coat, 0x434a51, 0.34),
    face: blendColor(knownAppearance.face, 0x927964, 0.24),
    hair: blendColor(knownAppearance.hair, 0x555d64, 0.28),
  };
}

export function createCharacterAvatar(
  scene: PhaserType.Scene,
  appearance: CharacterAppearance,
): CharacterRig {
  const shadow = scene.add.ellipse(0, 13.5, 18, 5.6, 0x091015, 0.46);
  const leftLeg = createCharacterLeg(scene, -4.5, 8.5, appearance);
  const rightLeg = createCharacterLeg(scene, 4.5, 8.5, appearance);
  const leftArm = createCharacterArm(scene, -8.5, -1.5, appearance);
  const rightArm = createCharacterArm(scene, 8.5, -1.5, appearance);
  const torsoOutline = scene.add.ellipse(
    0,
    2.5,
    21.5,
    24,
    appearance.outline,
    0.92,
  );
  const torso = scene.add.ellipse(0, 2.5, 19, 21.5, appearance.coat, 0.98);
  const torsoHighlight = scene.add.ellipse(
    -2.4,
    -1.6,
    8,
    6,
    blendColor(appearance.coat, 0xffffff, 0.18),
    0.12,
  );
  const torsoShade = scene.add.ellipse(
    3.2,
    6.2,
    10.5,
    9.5,
    blendColor(appearance.coat, 0x10161b, 0.24),
    0.28,
  );
  const accent = scene.add.rectangle(0, 5.3, 9, 12.5, appearance.accent, 0.98);
  const accessoryNodes = createCharacterAccessoryNodes(scene, appearance);
  const headOutline = scene.add.circle(0, 0, 9.9, appearance.outline, 0.94);
  const headBase = scene.add.circle(0, 0, 8.9, appearance.face, 0.99);
  const headHighlight = scene.add.ellipse(-2.2, -2.5, 5.2, 3.6, 0xffffff, 0.14);
  const faceNodes = [
    scene.add.circle(-2.5, -0.6, 0.8, appearance.outline, 0.9),
    scene.add.circle(2.5, -0.6, 0.8, appearance.outline, 0.9),
    scene.add.circle(
      0.8,
      1.3,
      0.9,
      blendColor(appearance.face, 0xca8455, 0.25),
      0.74,
    ),
    scene.add.ellipse(0, 3, 4, 1.2, appearance.outline, 0.22),
  ] as PhaserType.GameObjects.GameObject[];
  const hairNodes = createCharacterHairNodes(scene, appearance);
  const head = scene.add.container(0, -10.5, [
    headOutline,
    headBase,
    headHighlight,
    ...hairNodes,
    ...faceNodes,
  ]);

  const avatar = scene.add.container(0, 0, [
    shadow,
    leftLeg.container,
    rightLeg.container,
    leftArm.container,
    torsoOutline,
    torso,
    torsoShade,
    torsoHighlight,
    accent,
    ...accessoryNodes,
    head,
    rightArm.container,
  ]);
  avatar.setSize(34, 46);

  return {
    accent,
    avatar,
    head,
    leftArm: leftArm.container,
    leftLeg: leftLeg.container,
    rightArm: rightArm.container,
    rightLeg: rightLeg.container,
    shadow,
    torso,
  };
}

export function poseCharacterRig(
  rig: CharacterRig,
  {
    facing,
    now,
    style = DEFAULT_CHARACTER_MOTION_STYLE,
    stride,
  }: {
    facing: 1 | -1;
    now: number;
    style?: CharacterMotionStyle;
    stride: number;
  },
) {
  const swing = clamp(stride * style.stepPower, -1, 1);
  const bob =
    Math.abs(swing) * 2.1 * style.bodyBob +
    Math.sin(now / 240) * 0.22 * style.idleWave;
  const armSwing = swing * 0.52 * style.armSwing;
  const legSwing = swing * 0.36 * style.legSwing;
  const squashX = 1 + Math.abs(swing) * 0.03 * style.squash;
  const squashY = 1 - Math.abs(swing) * 0.035 * style.squash;
  const lean = swing * 0.08 * style.torsoLean;

  rig.avatar.setScale(facing * squashX, squashY);
  rig.avatar.setY(-bob);
  rig.torso.setY(2.5 - Math.abs(swing) * 0.45 * style.torsoLift);
  rig.torso.setRotation(lean);
  rig.accent.setY(5.5 - Math.abs(swing) * 0.45 * style.torsoLift);
  rig.accent.setRotation(lean * 0.65);
  rig.head.setX(Math.sin(now / 340) * 0.3 * style.idleWave);
  rig.head.setY(
    -10.5 -
      Math.abs(swing) * 0.8 * style.headBob +
      Math.sin(now / 200) * 0.35 * style.idleWave,
  );
  rig.head.setRotation(swing * 0.06 * style.headTilt + lean * 0.35);
  rig.shadow.setScale(
    1 - Math.abs(swing) * 0.1 * style.shadowPulse,
    1 - Math.abs(swing) * 0.03 * style.shadowPulse,
  );
  rig.leftArm.setRotation(armSwing + lean * 0.6);
  rig.rightArm.setRotation(-armSwing + lean * 0.6);
  rig.leftArm.setY(
    -1.5 +
      Math.max(0, swing) * 0.6 * style.armLift +
      Math.sin(now / 310) * 0.08 * style.idleWave,
  );
  rig.rightArm.setY(
    -1.5 +
      Math.max(0, -swing) * 0.6 * style.armLift -
      Math.sin(now / 310) * 0.08 * style.idleWave,
  );
  rig.leftLeg.setRotation(-legSwing - lean * 0.2);
  rig.rightLeg.setRotation(legSwing - lean * 0.2);
  rig.leftLeg.setY(8.5 + Math.max(0, -swing) * 0.4 * style.legLift);
  rig.rightLeg.setY(8.5 + Math.max(0, swing) * 0.4 * style.legLift);
}

function createCharacterAccessoryNodes(
  scene: PhaserType.Scene,
  appearance: CharacterAppearance,
) {
  switch (appearance.accessory) {
    case "apron":
      return [
        scene.add.rectangle(0, 12, 8, 13, 0xe9deca, 0.72),
      ] as PhaserType.GameObjects.GameObject[];
    case "shawl":
      return [
        scene.add.ellipse(
          0,
          2,
          22,
          11,
          blendColor(appearance.accent, 0x1f2930, 0.1),
          0.92,
        ),
      ] as PhaserType.GameObjects.GameObject[];
    case "satchel":
      return [
        scene.add.rectangle(6.5, 10, 6, 6, 0x6a4e36, 0.92),
      ] as PhaserType.GameObjects.GameObject[];
    case "vest":
      return [
        scene.add.rectangle(
          -4,
          8,
          4,
          13,
          blendColor(appearance.coat, 0x261d15, 0.45),
          0.8,
        ),
        scene.add.rectangle(
          4,
          8,
          4,
          13,
          blendColor(appearance.coat, 0x261d15, 0.45),
          0.8,
        ),
      ] as PhaserType.GameObjects.GameObject[];
    case "scarf":
      return [
        scene.add.ellipse(0, 1, 15, 5, 0xe0c193, 0.92),
        scene.add.rectangle(5, 8, 3, 9, 0xe0c193, 0.86),
      ] as PhaserType.GameObjects.GameObject[];
    default:
      return [] as PhaserType.GameObjects.GameObject[];
  }
}

function createCharacterHairNodes(
  scene: PhaserType.Scene,
  appearance: CharacterAppearance,
) {
  switch (appearance.hairStyle) {
    case "bun":
      return [
        scene.add.ellipse(0, -4.5, 16, 8, appearance.hair, 0.98),
        scene.add.circle(6.4, -7.8, 3.1, appearance.hair, 0.98),
      ] as PhaserType.GameObjects.GameObject[];
    case "scarf":
      return [
        scene.add.ellipse(0, -4.5, 18, 9, appearance.hair, 0.98),
        scene.add.rectangle(6.5, -1.5, 3, 8, appearance.hair, 0.94),
      ] as PhaserType.GameObjects.GameObject[];
    case "cap":
      return [
        scene.add.ellipse(0, -4.8, 18, 8, appearance.hair, 0.98),
        scene.add.rectangle(4.8, -2.4, 5, 2.4, appearance.hair, 0.98),
      ] as PhaserType.GameObjects.GameObject[];
    case "beard-cap":
      return [
        scene.add.ellipse(0, -4.8, 18, 8, appearance.hair, 0.98),
        scene.add.ellipse(0, 5.4, 10, 7, appearance.hair, 0.86),
      ] as PhaserType.GameObjects.GameObject[];
    case "ponytail":
      return [
        scene.add.ellipse(0, -4.5, 17, 8, appearance.hair, 0.98),
        scene.add.ellipse(7.5, 0, 4, 10, appearance.hair, 0.94),
      ] as PhaserType.GameObjects.GameObject[];
    default:
      return [
        scene.add.ellipse(0, -4.5, 16, 8, appearance.hair, 0.98),
      ] as PhaserType.GameObjects.GameObject[];
  }
}

function createCharacterArm(
  scene: PhaserType.Scene,
  x: number,
  y: number,
  appearance: CharacterAppearance,
) {
  const sleeve = scene.add.ellipse(
    0,
    4.5,
    6.4,
    13,
    blendColor(appearance.coat, 0x0f1419, 0.08),
    0.98,
  );
  const hand = scene.add.circle(0, 10.5, 2.2, appearance.face, 0.98);
  return {
    container: scene.add.container(x, y, [sleeve, hand]),
  };
}

function createCharacterLeg(
  scene: PhaserType.Scene,
  x: number,
  y: number,
  appearance: CharacterAppearance,
) {
  const trouser = scene.add.ellipse(
    0,
    4.5,
    7,
    14,
    blendColor(appearance.coat, 0x11161c, 0.14),
    0.98,
  );
  const boot = scene.add.ellipse(
    0,
    10.8,
    8.5,
    4.4,
    blendColor(appearance.outline, 0x2d251d, 0.18),
    0.98,
  );
  return {
    container: scene.add.container(x, y, [trouser, boot]),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
