import { NextResponse } from "next/server";
import type {
  CreateGameRequest,
  GameCommand,
  TickGameRequest,
  UpdatePolicyRequest,
} from "../../../../../sim-server/src/types/api";
import { STEP_MINUTES } from "../../../../../sim-server/src/sim/engine";
import { projectStreetGameForPlayer } from "../../../../../sim-server/src/street-sim/playerView";
import type { StreetGameState } from "../../../../../sim-server/src/street-sim/types";
import { getStreetRuntime } from "./runtime";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function getExternalSimBaseUrl() {
  const rawBaseUrl = process.env.MANY_LIVES_API_BASE_URL?.trim();
  if (rawBaseUrl) {
    return rawBaseUrl.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:3000";
  }

  return null;
}

export function allowInProcessSimFallback() {
  const rawValue = process.env.MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK?.trim();
  if (rawValue) {
    return !["0", "false", "no", "off"].includes(rawValue.toLowerCase());
  }

  return process.env.NODE_ENV !== "production";
}

function buildExternalSimErrorMessage(baseUrl: string, error: unknown) {
  if (error instanceof Error) {
    return `Could not reach sim server at ${baseUrl}: ${error.message}`;
  }

  return `Could not reach sim server at ${baseUrl}.`;
}

type ProxyExternalSimOptions = {
  projectGameResponse?: boolean;
};

async function proxyExternalSim(
  path: string,
  init?: RequestInit,
  options: ProxyExternalSimOptions = {},
) {
  const baseUrl = getExternalSimBaseUrl();
  if (!baseUrl) {
    return {
      baseUrl: null,
      errorMessage: null,
      response: null,
      unavailable: false,
    };
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const contentType =
      response.headers.get("content-type") ?? "application/json; charset=utf-8";
    const text = await response.text();
    const responseText = options.projectGameResponse
      ? projectGameResponseText(text, contentType, response.ok)
      : text;

    return {
      baseUrl,
      errorMessage: null,
      response: new NextResponse(responseText, {
        headers: {
          "content-type": contentType,
          "x-many-lives-sim-source": "external",
        },
        status: response.status,
      }),
      unavailable: false,
    };
  } catch (error) {
    return {
      baseUrl,
      errorMessage: buildExternalSimErrorMessage(baseUrl, error),
      response: null,
      unavailable: true,
    };
  }
}

function projectGameResponseText(
  text: string,
  contentType: string,
  ok: boolean,
) {
  if (!ok || !contentType.includes("application/json") || !text.trim()) {
    return text;
  }

  try {
    const data = JSON.parse(text) as { game?: StreetGameState };
    if (!data.game) {
      return text;
    }

    return JSON.stringify({
      ...data,
      game: projectStreetGameForPlayer(data.game),
    });
  } catch {
    return text;
  }
}

function externalSimUnavailableResponse(baseUrl: string | null, errorMessage: string | null) {
  return json(
    {
      message:
        errorMessage ??
        (baseUrl
          ? `Could not reach sim server at ${baseUrl}.`
          : "Could not reach the configured sim server."),
    },
    { status: 502 },
  );
}

export function notFoundResponse(id: string) {
  return json(
    {
      message: `Game ${id} was not found.`,
    },
    { status: 404 },
  );
}

export async function createGame(body?: CreateGameRequest) {
  const proxied = await proxyExternalSim("/game/new", {
    body: JSON.stringify(body ?? {}),
    method: "POST",
  }, { projectGameResponse: true });
  if (proxied.response) {
    return proxied.response;
  }
  if (proxied.unavailable && !allowInProcessSimFallback()) {
    return externalSimUnavailableResponse(proxied.baseUrl, proxied.errorMessage);
  }

  void body;
  const { engine, store } = getStreetRuntime();
  const gameId = store.createGameId();
  const game = await engine.createGame(gameId);
  const savedGame = store.save(game);
  return json({
    game: projectStreetGameForPlayer(savedGame),
  });
}

export async function tickGame(id: string, body?: TickGameRequest) {
  const proxied = await proxyExternalSim(`/game/${id}/tick`, {
    body: JSON.stringify(body ?? {}),
    method: "POST",
  }, { projectGameResponse: true });
  if (proxied.response) {
    return proxied.response;
  }
  if (proxied.unavailable && !allowInProcessSimFallback()) {
    return externalSimUnavailableResponse(proxied.baseUrl, proxied.errorMessage);
  }

  const { engine, store } = getStreetRuntime();
  const existing = store.get(id);
  if (!existing) {
    return notFoundResponse(id);
  }

  const nextGame = await engine.tick(existing, normalizeTickCount(body));
  const savedGame = store.save(nextGame);
  return json({
    game: projectStreetGameForPlayer(savedGame),
  });
}

export async function runCommand(id: string, body: GameCommand) {
  if (isPublicFreeTextCommand(body) && !allowPublicFreeTextCommands()) {
    return json(
      {
        message: "Free-text commands are disabled on this public build.",
      },
      { status: 403 },
    );
  }

  const proxied = await proxyExternalSim(`/game/${id}/command`, {
    body: JSON.stringify(body),
    method: "POST",
  }, { projectGameResponse: true });
  if (proxied.response) {
    return proxied.response;
  }
  if (proxied.unavailable && !allowInProcessSimFallback()) {
    return externalSimUnavailableResponse(proxied.baseUrl, proxied.errorMessage);
  }

  const { engine, store } = getStreetRuntime();
  const existing = store.get(id);
  if (!existing) {
    return notFoundResponse(id);
  }

  const nextGame = await engine.runCommand(existing, body);
  const savedGame = store.save(nextGame);
  return json({
    game: projectStreetGameForPlayer(savedGame),
  });
}

export async function updatePolicy(id: string, body?: UpdatePolicyRequest) {
  return runCommand(id, {
    type: "update_policy",
    characterId: body?.characterId,
    policy: body?.policy,
  });
}

export async function loadGameState(id: string) {
  const proxied = await proxyExternalSim(`/game/${id}/state`, undefined, {
    projectGameResponse: true,
  });
  if (proxied.response) {
    return proxied.response;
  }
  if (proxied.unavailable && !allowInProcessSimFallback()) {
    return externalSimUnavailableResponse(proxied.baseUrl, proxied.errorMessage);
  }

  const game = getStreetRuntime().store.get(id);
  if (!game) {
    return notFoundResponse(id);
  }

  return json({ game: projectStreetGameForPlayer(game) });
}

function normalizeTickCount(body: TickGameRequest = {}): number {
  if (body.ticks && body.ticks > 0) {
    return Math.max(1, Math.floor(body.ticks));
  }

  if (body.minutes && body.minutes > 0) {
    return Math.max(1, Math.round(body.minutes / STEP_MINUTES));
  }

  return 1;
}

function isPublicFreeTextCommand(command: GameCommand | undefined) {
  return command?.type === "speak" || command?.type === "set_objective";
}

function allowPublicFreeTextCommands() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.SIM_ALLOW_FREE_TEXT_COMMANDS === "true"
  );
}
