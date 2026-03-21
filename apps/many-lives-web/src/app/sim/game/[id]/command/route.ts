import type { GameCommand } from "../../../../../../../sim-server/src/types/api";
import { json, runCommand } from "../../../_server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await parseJson<GameCommand>(request);
  if (!body) {
    return json(
      {
        message: "A command payload is required.",
      },
      { status: 400 },
    );
  }

  return runCommand(id, body);
}

async function parseJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}
