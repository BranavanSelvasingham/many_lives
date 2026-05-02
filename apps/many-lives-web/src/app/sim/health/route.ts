import {
  allowInProcessSimFallback,
  getExternalSimBaseUrl,
  json,
} from "../_server/http";
import { getStreetRuntime } from "../_server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const externalBaseUrl = getExternalSimBaseUrl();
  if (externalBaseUrl) {
    try {
      const response = await fetch(`${externalBaseUrl}/health`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });
      const health = (await response.json()) as Record<string, unknown>;

      return json(
        {
          ...health,
          source: "external",
        },
        { status: response.status },
      );
    } catch (error) {
      if (allowInProcessSimFallback()) {
        return json({
          status: "ok",
          aiProvider: getStreetRuntime().engine.providerName,
          checkedAt: new Date().toISOString(),
          source: "in-process-fallback",
          externalError:
            error instanceof Error
              ? `Could not reach sim server at ${externalBaseUrl}: ${error.message}`
              : `Could not reach sim server at ${externalBaseUrl}.`,
        });
      }

      return json(
        {
          message:
            error instanceof Error
              ? `Could not reach sim server at ${externalBaseUrl}: ${error.message}`
              : `Could not reach sim server at ${externalBaseUrl}.`,
          source: "external",
          status: "error",
        },
        { status: 502 },
      );
    }
  }

  return json({
    status: "ok",
    aiProvider: getStreetRuntime().engine.providerName,
    checkedAt: new Date().toISOString(),
    source: "in-process",
  });
}
