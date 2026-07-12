import type { NpcScheduleStop } from "./types.js";

const MINUTES_PER_DAY = 24 * 60;

export interface NpcScheduleOccurrence {
  endTotalMinutes: number;
  startTotalMinutes: number;
  stop: NpcScheduleStop;
  stopIndex: number;
}

export interface NpcScheduleResolution {
  active: NpcScheduleOccurrence | undefined;
  evaluatedAtTotalMinutes: number;
  nextOpening: NpcScheduleOccurrence | undefined;
  status: "active" | "unavailable" | "unscheduled";
}

export function resolveNpcSchedule(
  schedule: NpcScheduleStop[],
  totalMinutes: number,
): NpcScheduleResolution {
  const now = Math.max(0, Math.round(totalMinutes));
  const dayIndex = Math.floor(now / MINUTES_PER_DAY);
  const occurrences = scheduleOccurrences(schedule, dayIndex - 1, dayIndex + 2);
  const active = occurrences.find(
    (occurrence) =>
      now >= occurrence.startTotalMinutes && now < occurrence.endTotalMinutes,
  );
  const nextOpening = occurrences.find(
    (occurrence) => occurrence.startTotalMinutes > now,
  );

  return {
    active,
    evaluatedAtTotalMinutes: now,
    nextOpening,
    status: active
      ? "active"
      : schedule.length === 0
        ? "unscheduled"
        : "unavailable",
  };
}

export function npcScheduleUnavailableReason(
  npcName: string,
  resolution: NpcScheduleResolution,
) {
  if (resolution.active) {
    return undefined;
  }

  const next = resolution.nextOpening;
  if (!next) {
    return `${npcName} has no scheduled opening to wait for.`;
  }

  const waitMinutes = Math.max(
    0,
    next.startTotalMinutes - resolution.evaluatedAtTotalMinutes,
  );
  return `${npcName} is unavailable now. The next opening is ${formatScheduleMinute(next.startTotalMinutes)} at ${next.stop.locationId}, in ${waitMinutes} minutes.`;
}

export function formatScheduleMinute(totalMinutes: number) {
  const normalized = Math.max(0, Math.round(totalMinutes));
  const day = Math.floor(normalized / MINUTES_PER_DAY) + 1;
  const minuteOfDay = normalized % MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `day ${day} at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function scheduleOccurrences(
  schedule: NpcScheduleStop[],
  firstDayIndex: number,
  lastDayIndex: number,
) {
  const occurrences: NpcScheduleOccurrence[] = [];

  for (let dayIndex = firstDayIndex; dayIndex <= lastDayIndex; dayIndex += 1) {
    if (dayIndex < 0) {
      continue;
    }

    for (const [stopIndex, stop] of schedule.entries()) {
      const occurrence = occurrenceForDay(stop, stopIndex, dayIndex);
      if (occurrence) {
        occurrences.push(occurrence);
      }
    }
  }

  return occurrences.sort((left, right) => {
    if (left.startTotalMinutes !== right.startTotalMinutes) {
      return left.startTotalMinutes - right.startTotalMinutes;
    }
    return left.stopIndex - right.stopIndex;
  });
}

function occurrenceForDay(
  stop: NpcScheduleStop,
  stopIndex: number,
  dayIndex: number,
): NpcScheduleOccurrence | undefined {
  if (!Number.isFinite(stop.fromHour) || !Number.isFinite(stop.toHour)) {
    return undefined;
  }

  const fromMinute = Math.round(stop.fromHour * 60);
  const toMinute = Math.round(stop.toHour * 60);
  if (
    fromMinute < 0 ||
    fromMinute >= MINUTES_PER_DAY ||
    toMinute < 0 ||
    toMinute > MINUTES_PER_DAY
  ) {
    return undefined;
  }

  const startTotalMinutes = dayIndex * MINUTES_PER_DAY + fromMinute;
  const durationMinutes =
    toMinute === fromMinute
      ? MINUTES_PER_DAY
      : toMinute > fromMinute
        ? toMinute - fromMinute
        : MINUTES_PER_DAY - fromMinute + toMinute;

  return {
    endTotalMinutes: startTotalMinutes + durationMinutes,
    startTotalMinutes,
    stop,
    stopIndex,
  };
}
