import { json } from "../../../_server/http";
import { getStreetRuntime } from "../../../_server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const game = getStreetRuntime().store.get(id);
  if (!game) {
    return json(
      {
        message: `Game ${id} was not found.`,
      },
      { status: 404 },
    );
  }

  return json({ game });
}
