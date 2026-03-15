export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatClock(raw: string) {
  if (!raw) return "No time";

  const normalized = raw.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatShortTime(raw: string) {
  if (!raw) return "No time";

  const normalized = raw.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
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
