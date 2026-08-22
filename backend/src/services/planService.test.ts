import { describe, it, expect } from "vitest";
import { calculateAcwr, getPrescribedType, WorkoutLike } from "./planService";
import { WorkoutType, RiderLevel } from "../generated/prisma/enums";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY);
}

function workout(type: WorkoutType, ageInDays: number, durationMinutes = 60): WorkoutLike {
  return { date: daysAgo(ageInDays), type, durationMinutes };
}

// Steady-state history: four ENDURANCE rides spaced across 28 days, only the
// most recent one falls inside the 7-day acute window. Chronic weekly
// average and acute load land on the same number, so ACWR == 1.0 — normal
// training load, nothing anomalous.
const STEADY_STATE_HISTORY: WorkoutLike[] = [
  workout(WorkoutType.ENDURANCE, 25),
  workout(WorkoutType.ENDURANCE, 18),
  workout(WorkoutType.ENDURANCE, 11),
  workout(WorkoutType.ENDURANCE, 4),
];

// Same base as above, plus a hard recent spike, which pushes ACWR to 2.0 —
// well over the 1.3 overreaching threshold.
const OVERREACHING_HISTORY: WorkoutLike[] = [
  ...STEADY_STATE_HISTORY,
  workout(WorkoutType.INTERVAL, 2),
];

describe("calculateAcwr", () => {
  it("returns null when there is no workout history at all", () => {
    expect(calculateAcwr([])).toBeNull();
  });

  it("returns null when the synced history spans fewer than MIN_HISTORY_DAYS", () => {
    const thinHistory: WorkoutLike[] = [
      workout(WorkoutType.INTERVAL, 1),
      workout(WorkoutType.INTERVAL, 2),
    ];
    expect(calculateAcwr(thinHistory)).toBeNull();
  });

  it("computes acute:chronic ratio once history spans at least MIN_HISTORY_DAYS", () => {
    expect(calculateAcwr(STEADY_STATE_HISTORY)).toBeCloseTo(1.0);
  });

  it("reflects a recent load spike as an elevated ratio", () => {
    expect(calculateAcwr(OVERREACHING_HISTORY)).toBeCloseTo(2.0);
  });
});

describe("getPrescribedType", () => {
  it("branch 1: CASUAL always gets ENDURANCE, even with an overreaching history", () => {
    const result = getPrescribedType(RiderLevel.CASUAL, OVERREACHING_HISTORY, null);
    expect(result).toBe(WorkoutType.ENDURANCE);
  });

  it("branch 1: a rider with no level set (null) defaults to ENDURANCE", () => {
    const result = getPrescribedType(null, STEADY_STATE_HISTORY, null);
    expect(result).toBe(WorkoutType.ENDURANCE);
  });

  it("branch 2: forces RECOVERY inside the taper window ahead of a race, overriding what load alone would prescribe", () => {
    const raceGoal = { date: daysAgo(-2) }; // 2 days from now
    // Without the race goal, RACING + steady-state load would prescribe INTERVAL (branch 5).
    const result = getPrescribedType(RiderLevel.RACING, STEADY_STATE_HISTORY, raceGoal);
    expect(result).toBe(WorkoutType.RECOVERY);
  });

  it("branch 3: forces RECOVERY when ACWR is at or above the overreaching threshold", () => {
    const result = getPrescribedType(RiderLevel.RACING, OVERREACHING_HISTORY, null);
    expect(result).toBe(WorkoutType.RECOVERY);
  });

  it("branch 4: with thin history, 2+ recent INTERVAL workouts trigger the RECOVERY fallback", () => {
    const thinHistory: WorkoutLike[] = [
      workout(WorkoutType.INTERVAL, 1),
      workout(WorkoutType.INTERVAL, 2),
    ];
    expect(calculateAcwr(thinHistory)).toBeNull(); // sanity check: fallback only applies when ACWR can't be computed

    const result = getPrescribedType(RiderLevel.RACING, thinHistory, null);
    expect(result).toBe(WorkoutType.RECOVERY);
  });

  it("branch 4 (negative): thin history with only 1 recent INTERVAL workout does not trigger the fallback", () => {
    const thinHistory: WorkoutLike[] = [workout(WorkoutType.INTERVAL, 1)];
    expect(calculateAcwr(thinHistory)).toBeNull();

    const result = getPrescribedType(RiderLevel.RACING, thinHistory, null);
    expect(result).toBe(WorkoutType.INTERVAL); // falls through to branch 5 instead
  });

  it("branch 5: MID gets ENDURANCE under normal load with no other triggers", () => {
    const result = getPrescribedType(RiderLevel.MID, STEADY_STATE_HISTORY, null);
    expect(result).toBe(WorkoutType.ENDURANCE);
  });

  it("branch 5: RACING gets INTERVAL under normal load with no other triggers", () => {
    const result = getPrescribedType(RiderLevel.RACING, STEADY_STATE_HISTORY, null);
    expect(result).toBe(WorkoutType.INTERVAL);
  });
});
