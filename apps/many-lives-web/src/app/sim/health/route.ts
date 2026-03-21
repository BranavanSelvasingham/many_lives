import { json } from "../_server/http";
import { getStreetRuntime } from "../_server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    status: "ok",
    aiProvider: getStreetRuntime().engine.providerName,
    checkedAt: new Date().toISOString(),
  });
}
