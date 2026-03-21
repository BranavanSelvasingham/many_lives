import type { CreateGameRequest } from "../../../../../../sim-server/src/types/api";
import { createGame } from "../../_server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
