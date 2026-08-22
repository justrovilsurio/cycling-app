import { describe, it, expect } from "vitest";
import {
  calculateAcwr,
  getPrescription,
  getSuggestedEffort,
  pickTopSpot,
  WorkoutLike,
} from "./planService";
import { WorkoutType, RiderLevel, IntensityZone } from "../generated/prisma/enums";
import type { SpotModel as Spot } from "../generated/prisma/models/Spot";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY);
}

function workout(type: WorkoutType, ageInDays: number, durationMinutes = 60): WorkoutLike {
  return { date: daysAgo(ageInDays), type, durationMinutes };
}

function spot(overrides: Partial<Spot> & { id: string; name: string }): Spot {
  return {
    terrainType: "ROAD",
    difficulty: null,
    averageGradePercent: null,
    maxGradePercent: null,
    distanceMeters: null,
    elevationGainMeters: null,
    climbCategory: null,
    suitableFor: [],
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Spot;
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

describe("getPrescription", () => {
  it("branch 1: CASUAL always gets ENDURANCE, even with an overreaching history", () => {
    const result = getPrescription(RiderLevel.CASUAL, OVERREACHING_HISTORY, null);
    expect(result.type).toBe(WorkoutType.ENDURANCE);
    expect(result.reason).toMatch(/casual/i);
  });

  it("branch 1: a rider with no level set (null) defaults to ENDURANCE", () => {
    const result = getPrescription(null, STEADY_STATE_HISTORY, null);
    expect(result.type).toBe(WorkoutType.ENDURANCE);
    expect(result.reason).toMatch(/rider level/i);
  });

  it("branch 2: forces RECOVERY inside the taper window ahead of a race, overriding what load alone would prescribe", () => {
    const raceGoal = { date: daysAgo(-2), raceType: "criterium" }; // 2 days from now
    // Without the race goal, RACING + steady-state load would prescribe INTERVAL (branch 5).
    const result = getPrescription(RiderLevel.RACING, STEADY_STATE_HISTORY, raceGoal);
    expect(result.type).toBe(WorkoutType.RECOVERY);
    expect(result.reason).toMatch(/criterium/);
    expect(result.reason).toMatch(/2 days/);
  });

  it("branch 3: forces RECOVERY when ACWR is at or above the overreaching threshold", () => {
    const result = getPrescription(RiderLevel.RACING, OVERREACHING_HISTORY, null);
    expect(result.type).toBe(WorkoutType.RECOVERY);
    expect(result.reason).toMatch(/ACWR 2\.00/);
  });

  it("branch 4: with thin history, 2+ recent INTERVAL workouts trigger the RECOVERY fallback", () => {
    const thinHistory: WorkoutLike[] = [
      workout(WorkoutType.INTERVAL, 1),
      workout(WorkoutType.INTERVAL, 2),
    ];
    expect(calculateAcwr(thinHistory)).toBeNull(); // sanity check: fallback only applies when ACWR can't be computed

    const result = getPrescription(RiderLevel.RACING, thinHistory, null);
    expect(result.type).toBe(WorkoutType.RECOVERY);
    expect(result.reason).toMatch(/2 hard interval sessions/);
  });

  it("branch 4 (negative): thin history with only 1 recent INTERVAL workout does not trigger the fallback", () => {
    const thinHistory: WorkoutLike[] = [workout(WorkoutType.INTERVAL, 1)];
    expect(calculateAcwr(thinHistory)).toBeNull();

    const result = getPrescription(RiderLevel.RACING, thinHistory, null);
    expect(result.type).toBe(WorkoutType.INTERVAL); // falls through to branch 5 instead
  });

  it("branch 5: MID gets ENDURANCE under normal load with no other triggers", () => {
    const result = getPrescription(RiderLevel.MID, STEADY_STATE_HISTORY, null);
    expect(result.type).toBe(WorkoutType.ENDURANCE);
    expect(result.reason).toMatch(/normal/i);
  });

  it("branch 5: RACING gets INTERVAL under normal load with no other triggers", () => {
    const result = getPrescription(RiderLevel.RACING, STEADY_STATE_HISTORY, null);
    expect(result.type).toBe(WorkoutType.INTERVAL);
    expect(result.reason).toMatch(/interval session/i);
  });
});

describe("getSuggestedEffort", () => {
  it("maps RECOVERY to the RECOVERY zone and its duration range", () => {
    const result = getSuggestedEffort(WorkoutType.RECOVERY, null);
    expect(result.zone).toBe(IntensityZone.RECOVERY);
    expect(result.minDurationMinutes).toBe(30);
    expect(result.maxDurationMinutes).toBe(45);
    expect(result.targetHrRange).toBeNull();
  });

  it("maps ENDURANCE to the ENDURANCE zone and its duration range", () => {
    const result = getSuggestedEffort(WorkoutType.ENDURANCE, null);
    expect(result.zone).toBe(IntensityZone.ENDURANCE);
    expect(result.minDurationMinutes).toBe(60);
    expect(result.maxDurationMinutes).toBe(90);
  });

  it("maps INTERVAL to the THRESHOLD zone (not VO2MAX, without more signal)", () => {
    const result = getSuggestedEffort(WorkoutType.INTERVAL, null);
    expect(result.zone).toBe(IntensityZone.THRESHOLD);
    expect(result.minDurationMinutes).toBe(45);
    expect(result.maxDurationMinutes).toBe(60);
  });

  it("computes a target HR range from maxHr when set", () => {
    // INTERVAL maps to the THRESHOLD zone, which is 80-90% of max HR
    const result = getSuggestedEffort(WorkoutType.INTERVAL, 200);
    expect(result.targetHrRange).toEqual({ min: 160, max: 180 });
  });

  it("returns null targetHrRange when maxHr is not set", () => {
    const result = getSuggestedEffort(WorkoutType.ENDURANCE, null);
    expect(result.targetHrRange).toBeNull();
  });
});

describe("pickTopSpot", () => {
  it("returns null spot/reason and an empty otherSpots list when there are no candidates", () => {
    const result = pickTopSpot(WorkoutType.RECOVERY, []);
    expect(result).toEqual({ spot: null, reason: null, otherSpots: [] });
  });

  it("RECOVERY picks the flattest spot by averageGradePercent", () => {
    const flat = spot({ id: "1", name: "Flat Loop", averageGradePercent: 1.2 });
    const hilly = spot({ id: "2", name: "Hilly Loop", averageGradePercent: 5.0 });
    const result = pickTopSpot(WorkoutType.RECOVERY, [hilly, flat]);
    expect(result.spot?.id).toBe("1");
    expect(result.reason).toMatch(/flattest/);
    expect(result.otherSpots).toEqual([hilly]);
  });

  it("ENDURANCE picks the longest spot by distanceMeters", () => {
    const short = spot({ id: "1", name: "Short Loop", distanceMeters: 5000 });
    const long = spot({ id: "2", name: "Long Loop", distanceMeters: 50000 });
    const result = pickTopSpot(WorkoutType.ENDURANCE, [short, long]);
    expect(result.spot?.id).toBe("2");
    expect(result.reason).toMatch(/longest/);
  });

  it("INTERVAL picks the steepest spot by averageGradePercent, tie-broken by shortest distance", () => {
    const gentle = spot({ id: "1", name: "Gentle Climb", averageGradePercent: 3, distanceMeters: 2000 });
    const steepLong = spot({ id: "2", name: "Steep Long", averageGradePercent: 8, distanceMeters: 8000 });
    const steepShort = spot({ id: "3", name: "Steep Short", averageGradePercent: 8, distanceMeters: 2000 });
    const result = pickTopSpot(WorkoutType.INTERVAL, [gentle, steepLong, steepShort]);
    expect(result.spot?.id).toBe("3");
    expect(result.reason).toMatch(/short, steep climb/);
  });

  it("falls back to the first spot with a null reason when the relevant field is missing on every candidate", () => {
    const a = spot({ id: "1", name: "Mystery A" });
    const b = spot({ id: "2", name: "Mystery B" });
    const result = pickTopSpot(WorkoutType.RECOVERY, [a, b]);
    expect(result.spot?.id).toBe("1");
    expect(result.reason).toBeNull();
    expect(result.otherSpots).toEqual([b]);
  });
});
