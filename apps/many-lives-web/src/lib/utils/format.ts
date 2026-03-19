export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function parseDate(raw: string) {
  if (!raw) return null;

  const normalized = raw.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatClock(raw: string) {
  const date = parseDate(raw);
  if (!date) return raw || "No time";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatShortTime(raw: string) {
  const date = parseDate(raw);
  if (!date) return raw || "No time";

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatWorldTime(raw: string) {
  const date = parseDate(raw);
  if (!date) return raw || "No time";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatTimeAgo(raw: string, currentRaw: string) {
  const date = parseDate(raw);
  const currentDate = parseDate(currentRaw);
  if (!date || !currentDate) return formatShortTime(raw);

  const diffMinutes = Math.max(
    0,
    Math.round((currentDate.getTime() - date.getTime()) / 60_000),
  );

  if (diffMinutes <= 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function humanizeToken(token: string) {
  return token.replaceAll("_", " ").replaceAll("-", " ");
}

export function titleCase(value: string) {
  return humanizeToken(value).replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatCurrencyLimit(amount: number) {
  if (amount <= 0) {
    return "$0";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toActionId(label: string) {
  return label.toLowerCase().replaceAll(/\s+/g, "_").replaceAll("-", "_");
}

export function previewText(body: string, max = 108) {
  if (body.length <= max) return body;
  return `${body.slice(0, max - 3)}...`;
}
