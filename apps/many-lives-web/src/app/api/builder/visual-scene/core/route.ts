import { writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  buildVisualSceneModuleSource,
  parseVisualSceneDocument,
} from "@/lib/street/visualScenes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORE_SCENE_ID = "south-quay-v2";
const CORE_SCENE_CONSTANT_NAME = "SOUTH_QUAY_V2_DOCUMENT";
const CORE_SCENE_RELATIVE_PATH = "src/lib/street/visual-scene-documents/southQuayV2Document.ts";

function canWriteCoreSceneFile() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_SCENE_BUILDER_FILE_WRITES === "true"
  );
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      message,
    },
    { status },
  );
}

export async function POST(request: Request) {
  if (!canWriteCoreSceneFile()) {
    return jsonError(
      "Saving the core scene file is disabled outside development.",
      403,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object" || !("scene" in body)) {
    return jsonError("Expected a JSON body with a `scene` field.", 400);
  }

  const payload = body as { scene: unknown };

  let scene;
  try {
    scene = parseVisualSceneDocument(JSON.stringify(payload.scene));
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not parse the scene payload.",
      400,
    );
  }

  if (scene.id !== CORE_SCENE_ID) {
    return jsonError(
      `Expected scene id ${CORE_SCENE_ID}, received ${scene.id}.`,
      400,
    );
  }

  const source = buildVisualSceneModuleSource(CORE_SCENE_CONSTANT_NAME, scene);
  const filePath = path.resolve(process.cwd(), CORE_SCENE_RELATIVE_PATH);

  try {
    await writeFile(filePath, source, "utf8");
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to write the core scene file.",
      500,
    );
  }

  return NextResponse.json({
    message: "Saved core scene file.",
    path: CORE_SCENE_RELATIVE_PATH,
    sceneId: scene.id,
    savedAt: new Date().toISOString(),
  });
}
