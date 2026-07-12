import { describe, expect, it } from "vitest";
import { resolveNpcSchedule } from "../src/street-sim/npcSchedule.js";
import type { NpcScheduleStop } from "../src/street-sim/types.js";

const daytimeWithGap: NpcScheduleStop[] = [
  { locationId: "morning", fromHour: 8, toHour: 10 },
  { locationId: "afternoon", fromHour: 13, toHour: 17 },
];

describe("NPC daily schedule resolution", () => {
  it("uses half-open boundaries and leaves schedule gaps unavailable", () => {
    expect(
      resolveNpcSchedule(daytimeWithGap, 8 * 60).active?.stop.locationId,
    ).toBe("morning");
    expect(resolveNpcSchedule(daytimeWithGap, 10 * 60 - 1).status).toBe(
      "active",
    );

    const gap = resolveNpcSchedule(daytimeWithGap, 10 * 60);
    expect(gap.active).toBeUndefined();
    expect(gap.status).toBe("unavailable");
    expect(gap.nextOpening).toMatchObject({
      startTotalMinutes: 13 * 60,
      stop: { locationId: "afternoon" },
    });
  });

  it("rolls the next opening into the following day without a final-stop fallback", () => {
    const afterClose = resolveNpcSchedule(daytimeWithGap, 20 * 60);

    expect(afterClose.active).toBeUndefined();
    expect(afterClose.nextOpening).toMatchObject({
      startTotalMinutes: 24 * 60 + 8 * 60,
      stop: { locationId: "morning" },
    });
  });

  it("keeps overnight windows active across midnight and closes at the end boundary", () => {
    const overnight: NpcScheduleStop[] = [
      { locationId: "night-desk", fromHour: 22, toHour: 2 },
    ];

    expect(resolveNpcSchedule(overnight, 23 * 60).active).toMatchObject({
      startTotalMinutes: 22 * 60,
      endTotalMinutes: 26 * 60,
    });
    expect(resolveNpcSchedule(overnight, 24 * 60 + 60).status).toBe("active");

    const closed = resolveNpcSchedule(overnight, 24 * 60 + 2 * 60);
    expect(closed.active).toBeUndefined();
    expect(closed.nextOpening?.startTotalMinutes).toBe(24 * 60 + 22 * 60);
  });

  it("reports unscheduled NPCs without inventing an opening", () => {
    expect(resolveNpcSchedule([], 12 * 60)).toEqual({
      active: undefined,
      evaluatedAtTotalMinutes: 12 * 60,
      nextOpening: undefined,
      status: "unscheduled",
    });
  });
});
