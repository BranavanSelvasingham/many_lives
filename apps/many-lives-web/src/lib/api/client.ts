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
    throw new Error(text || `Request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}
