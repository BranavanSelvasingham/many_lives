import type { UpdatePolicyRequest } from "../../../../../../../sim-server/src/types/api";
import { updatePolicy } from "../../../_server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await parseJson<UpdatePolicyRequest>(request)) ?? {};
  return updatePolicy(id, body);
}

async function parseJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}
