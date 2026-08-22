import { describe, it, expect } from "vitest";
import { getSessionTemplate, MissingSessionTemplateError } from "./sessionTemplates";
import { WorkoutType, RiderLevel, IntensityZone } from "../generated/prisma/enums";

const MAX_HR = 190;

describe("getSessionTemplate", () => {
  it("prescribes an unstructured recovery spin at every rider level", () => {
    for (const level of Object.values(RiderLevel)) {
      const session = getSessionTemplate(WorkoutType.RECOVERY, level, MAX_HR);
      expect(session.primaryZone).toBe(IntensityZone.RECOVERY);
      expect(session.workStructure).toEqual([]);
      expect(session.totalDurationMinutes).toEqual({ min: 30, max: 60 });
      expect(session.rpeCue.min).toBe(2);
      expect(session.rpeCue.max).toBe(3);
    }
  });

  it("scales endurance duration up with rider level", () => {
    const casual = getSessionTemplate(WorkoutType.ENDURANCE, RiderLevel.CASUAL, MAX_HR);
    const mid = getSessionTemplate(WorkoutType.ENDURANCE, RiderLevel.MID, MAX_HR);
    const racing = getSessionTemplate(WorkoutType.ENDURANCE, RiderLevel.RACING, MAX_HR);

    expect(casual.totalDurationMinutes.max).toBeLessThan(mid.totalDurationMinutes.max);
    expect(mid.totalDurationMinutes.max).toBeLessThan(racing.totalDurationMinutes.max);
    // The whole spread still lands inside the 60-120 minute endurance band.
    expect(casual.totalDurationMinutes.min).toBe(60);
    expect(racing.totalDurationMinutes.max).toBe(120);
  });

  it("gives a mid-level rider 3 x 8min tempo blocks with 4min recoveries", () => {
    const session = getSessionTemplate(WorkoutType.INTERVAL, RiderLevel.MID, MAX_HR);

    expect(session.workStructure).toHaveLength(1);
    expect(session.workStructure[0]).toMatchObject({
      reps: 3,
      durationMinutes: 8,
      targetZone: IntensityZone.TEMPO,
      recoveryMinutes: 4,
      recoveryZone: IntensityZone.RECOVERY,
    });
    // 10 warmup + 3 x (8 + 4) + 10 cooldown
    expect(session.totalDurationMinutes).toEqual({ min: 56, max: 56 });
  });

  it("gives a racing rider 4 x 4min VO2max blocks at a higher cadence", () => {
    const session = getSessionTemplate(WorkoutType.INTERVAL, RiderLevel.RACING, MAX_HR);

    expect(session.workStructure[0]).toMatchObject({
      reps: 4,
      durationMinutes: 4,
      targetZone: IntensityZone.VO2MAX,
      recoveryMinutes: 4,
      // Active recovery at 60-70% maxHr per the 4x4 protocol, not a full stop.
      recoveryZone: IntensityZone.ENDURANCE,
    });
    expect(session.targetCadenceRpm).toEqual({ minRpm: 90, maxRpm: 100 });
    expect(session.rpeCue).toMatchObject({ min: 8, max: 9 });
    // 10 warmup + 4 x (4 + 4) + 10 cooldown
    expect(session.totalDurationMinutes).toEqual({ min: 52, max: 52 });
  });

  it("prescribes VO2max work at 90-95% of maxHr, not the full 90-100% zone", () => {
    const session = getSessionTemplate(WorkoutType.INTERVAL, RiderLevel.RACING, MAX_HR);

    // The Zone 5 band is 90-100%, but no protocol asks for 100% of max held
    // for four minutes — the prescription target is narrower than the zone.
    expect(session.targetHrRange).toEqual({ min: 171, max: 181 });
    expect(session.workStructure[0].targetHrRange).toEqual({ min: 171, max: 181 });
    expect(session.targetHrRange!.max).toBeLessThan(MAX_HR);
  });

  it("gives every interval recovery its own HR target", () => {
    const racing = getSessionTemplate(WorkoutType.INTERVAL, RiderLevel.RACING, MAX_HR);
    // ENDURANCE band, 60-70% of 190.
    expect(racing.workStructure[0].recoveryHrRange).toEqual({ min: 114, max: 133 });

    const mid = getSessionTemplate(WorkoutType.INTERVAL, RiderLevel.MID, MAX_HR);
    // RECOVERY band, 50-60% of 190.
    expect(mid.workStructure[0].recoveryHrRange).toEqual({ min: 95, max: 114 });
  });

  it("resolves HR targets as a percentage band of maxHr", () => {
    const session = getSessionTemplate(WorkoutType.ENDURANCE, RiderLevel.MID, MAX_HR);
    // ENDURANCE zone is 60-70% of maxHr.
    expect(session.targetHrRange).toEqual({ min: 114, max: 133 });
  });

  it("keeps cadence and RPE but nulls HR targets when maxHr is missing", () => {
    const session = getSessionTemplate(WorkoutType.INTERVAL, RiderLevel.RACING, null);

    expect(session.targetHrRange).toBeNull();
    expect(session.workStructure[0].targetHrRange).toBeNull();
    expect(session.workStructure[0].recoveryHrRange).toBeNull();
    expect(session.targetCadenceRpm).toEqual({ minRpm: 90, maxRpm: 100 });
    expect(session.rpeCue.description).not.toBe("");
    // The session shape itself is unaffected — only the HR numbers drop out.
    expect(session.workStructure[0].reps).toBe(4);
  });

  it("throws rather than silently returning undefined for CASUAL + INTERVAL", () => {
    expect(() => getSessionTemplate(WorkoutType.INTERVAL, RiderLevel.CASUAL, MAX_HR)).toThrow(
      MissingSessionTemplateError,
    );
  });
});
