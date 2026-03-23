import { NextResponse } from "next/server";

type RateLimitScope = "game_new" | "command" | "tick" | "policy";

type RateLimitBucket = {
  count: number;
  expiresAt: number;
};

declare global {
  var __manyLivesRateLimitBuckets: Map<string, RateLimitBucket> | undefined;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_LIMITS: Record<RateLimitScope, number> = {
  game_new: 12,
  command: 90,
  tick: 45,
  policy: 30,
};

export function enforceSimRateLimit(
  request: Request,
  scope: RateLimitScope,
): Response | null {
  if (!isRateLimitEnabled()) {
    return null;
  }

  const ip = clientIpFrom(request);
  const limit = configuredLimit(scope);
  if (limit <= 0) {
    return null;
  }

  const windowMs = configuredWindowMs();
  const buckets = getBuckets();
  const now = Date.now();
  const key = `${scope}:${ip}`;
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt <= now) {
    buckets.set(key, {
      count: 1,
      expiresAt: now + windowMs,
    });
    pruneBuckets(buckets, now);
    return null;
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.expiresAt - now) / 1000),
    );
    return NextResponse.json(
      {
        message: "Rate limit exceeded for this IP. Try again shortly.",
        scope,
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(existing.expiresAt),
        },
      },
    );
  }

  existing.count += 1;
  buckets.set(key, existing);
  return null;
}

function isRateLimitEnabled() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.SIM_RATE_LIMIT_DISABLED !== "true"
  );
}

function configuredWindowMs() {
  const raw = Number(process.env.SIM_RATE_LIMIT_WINDOW_MS);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  return DEFAULT_WINDOW_MS;
}

function configuredLimit(scope: RateLimitScope) {
  const envKey = {
    game_new: "SIM_RATE_LIMIT_GAME_NEW_MAX",
    command: "SIM_RATE_LIMIT_COMMAND_MAX",
    tick: "SIM_RATE_LIMIT_TICK_MAX",
    policy: "SIM_RATE_LIMIT_POLICY_MAX",
  }[scope];

  const raw = Number(process.env[envKey]);
  if (Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }

  return DEFAULT_LIMITS[scope];
}

function clientIpFrom(request: Request) {
  const candidates = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-client-ip"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-azure-clientip"),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const first = candidate
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);

    if (first) {
      return first;
    }
  }

  return "unknown";
}

function getBuckets() {
  globalThis.__manyLivesRateLimitBuckets ??= new Map();
  return globalThis.__manyLivesRateLimitBuckets;
}

function pruneBuckets(buckets: Map<string, RateLimitBucket>, now: number) {
  if (buckets.size < 1_000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.expiresAt <= now) {
      buckets.delete(key);
    }
  }
}
