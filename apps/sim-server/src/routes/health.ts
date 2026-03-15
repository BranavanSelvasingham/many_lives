import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(
  app: FastifyInstance,
  aiProviderName: string,
): void {
  app.get("/health", async () => ({
    status: "ok",
    aiProvider: aiProviderName,
    checkedAt: new Date().toISOString(),
  }));
}
