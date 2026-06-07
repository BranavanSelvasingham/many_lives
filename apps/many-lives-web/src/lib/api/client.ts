const backendBase = "/sim";

export async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${backendBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      formatRequestErrorMessage(text) ??
        `Request failed with HTTP ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export function formatRequestErrorMessage(text: string) {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return null;
  }

  try {
    const payload = JSON.parse(trimmedText) as unknown;
    if (
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string" &&
      payload.message.trim()
    ) {
      return payload.message.trim();
    }
  } catch {
    // Keep non-JSON server details readable for diagnostics.
  }

  return trimmedText;
}
