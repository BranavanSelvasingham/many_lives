import type { CreateGameRequest } from "../../../../../../sim-server/src/types/api";
import { createGame } from "../../_server/http";
import { enforceSimRateLimit } from "../../_server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimited = enforceSimRateLimit(request, "game_new");
  if (rateLimited) {
    return rateLimited;
  }

  const body = (await parseJson<CreateGameRequest>(request)) ?? {};
  return createGame(body);
}

async function parseJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}
