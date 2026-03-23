import type { TickGameRequest } from "../../../../../../../sim-server/src/types/api";
import { tickGame } from "../../../_server/http";
import { enforceSimRateLimit } from "../../../_server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimited = enforceSimRateLimit(request, "tick");
  if (rateLimited) {
    return rateLimited;
  }

  const { id } = await context.params;
  const body = (await parseJson<TickGameRequest>(request)) ?? {};
  return tickGame(id, body);
}

async function parseJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}
