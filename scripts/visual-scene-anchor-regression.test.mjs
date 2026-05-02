import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOUTH_QUAY_V2_PATH =
  new URL(
    "../apps/many-lives-web/src/lib/street/visual-scene-documents/southQuayV2Document.ts",
    import.meta.url,
  );

test("tea-house anchors stay on the cafe frontage in South Quay v2", async () => {
  const source = await readFile(SOUTH_QUAY_V2_PATH, "utf8");

  assert.match(
    source,
    /"tea-house": \{\s+"door": \{\s+"x": 1342,\s+"y": 580/s,
  );
  assert.match(
    source,
    /"tea-house": \{[\s\S]*?"frontage": \{\s+"x": 1342,\s+"y": 596/s,
  );
  assert.match(
    source,
    /"tea-house": \{[\s\S]*?"npcStands": \[[\s\S]*?"x": 1288,\s+"y": 612[\s\S]*?"x": 1342,\s+"y": 606[\s\S]*?"x": 1396,\s+"y": 612/s,
  );
  assert.match(
    source,
    /"npc-ada": \{\s+"x": 1342,\s+"y": 606/s,
  );
  assert.match(
    source,
    /"freight-yard": \{\s+"door": \{\s+"x": 698,\s+"y": 952/s,
  );
  assert.match(
    source,
    /"freight-yard": \{[\s\S]*?"npcStands": \[[\s\S]*?"x": 646,\s+"y": 890[\s\S]*?"x": 752,\s+"y": 890/s,
  );
  assert.match(
    source,
    /"npc-tomas": \{\s+"x": 752,\s+"y": 890/s,
  );
  assert.match(
    source,
    /"npc-jo": \{\s+"x": 1306,\s+"y": 634/s,
  );
});
