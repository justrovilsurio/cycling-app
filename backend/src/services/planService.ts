import { WorkoutType, RiderLevel, IntensityZone } from "../generated/prisma/enums";
import type { SpotModel as Spot } from "../generated/prisma/models/Spot";

const INTENSITY_WEIGHT: Record<WorkoutType, number> = {
  RECOVERY: 1,
  ENDURANCE: 2,
  INTERVAL: 4,
};

const MIN_HISTORY_DAYS = 14;
const TAPER_DAYS_BEFORE_RACE = 5;
const ACWR_OVERREACHING_THRESHOLD = 1.3;
const RECOVERY_GUARD_LOOKBACK_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface WorkoutLike {
  date: Date;
  type: WorkoutType;
  durationMinutes: number;
}

function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / MS_PER_DAY;
}

function loadFor(workout: WorkoutLike): number {
  return workout.durationMinutes * INTENSITY_WEIGHT[workout.type];
}

// Acute:chronic workload ratio — acute (last 7 days) vs chronic (last 28
// days, averaged to a weekly rate). >=1.3 is the standard sports-science
// threshold for "ramping load too fast, injury/overreaching risk." Returns
// null when there isn't enough history to trust the chronic average, or
// when there's no chronic load to divide by at all.
export function calculateAcwr(workouts: WorkoutLike[]): number | null {
  if (workouts.length === 0) {
    return null;
  }

  const now = new Date();
  const earliestDate = workouts.reduce(
    (earliest, workout) => (workout.date < earliest ? workout.date : earliest),
    workouts[0].date,
  );
  if (daysSince(earliestDate, now) < MIN_HISTORY_DAYS) {
    return null;
  }

  let acuteLoad = 0;
  let chronicLoad = 0;
  for (const workout of workouts) {
    const age = daysSince(workout.date, now);
    if (age < 0) continue; // ignore future-dated workouts
    if (age <= 28) {
      chronicLoad += loadFor(workout);
    }
    if (age <= 7) {
      acuteLoad += loadFor(workout);
    }
  }
  chronicLoad /= 4;

  if (chronicLoad === 0) {
    return null;
  }

  return acuteLoad / chronicLoad;
}

export interface Prescription {
  type: WorkoutType;
  reason: string;
}

export function getPrescription(
  level: RiderLevel | null,
  recentWorkouts: WorkoutLike[],
  raceGoal: { date: Date; raceType: string } | null,
): Prescription {
  // A rider who hasn't set a level yet is treated as CASUAL — the safe
  // default, since it always resolves to ENDURANCE and never risks
  // prescribing INTERVAL to an unconfigured athlete.
  if (level === RiderLevel.CASUAL || level === null) {
    return {
      type: WorkoutType.ENDURANCE,
      reason:
        level === null
          ? "We don't have your rider level set yet, so today's a steady, safe default — set your level in your profile for sharper recommendations."
          : "You're set up for casual riding — keeping today steady and enjoyable.",
    };
  }

  if (raceGoal) {
    const now = new Date();
    const daysUntilRace = Math.round((raceGoal.date.getTime() - now.getTime()) / MS_PER_DAY);
    if (daysUntilRace >= 0 && daysUntilRace <= TAPER_DAYS_BEFORE_RACE) {
      return {
        type: WorkoutType.RECOVERY,
        reason: `Your ${raceGoal.raceType} is ${daysUntilRace === 0 ? "today" : `in ${daysUntilRace} day${daysUntilRace === 1 ? "" : "s"}`} — tapering down so you arrive fresh.`,
      };
    }
  }

  const acwr = calculateAcwr(recentWorkouts);
  if (acwr !== null && acwr >= ACWR_OVERREACHING_THRESHOLD) {
    return {
      type: WorkoutType.RECOVERY,
      reason: `Your training load has ramped up fast this week (ACWR ${acwr.toFixed(2)}) — recovery day to stay ahead of injury risk.`,
    };
  }

  // Fallback for riders without enough synced history for ACWR to mean
  // anything: a raw count of recent hard efforts is a cheap proxy for the
  // same "ramping too fast" pattern ACWR would otherwise catch.
  if (acwr === null) {
    const now = new Date();
    const recentIntervalCount = recentWorkouts.filter((workout) => {
      if (workout.type !== WorkoutType.INTERVAL) return false;
      const age = daysSince(workout.date, now);
      return age >= 0 && age <= RECOVERY_GUARD_LOOKBACK_DAYS;
    }).length;
    if (recentIntervalCount >= 2) {
      return {
        type: WorkoutType.RECOVERY,
        reason: `You've logged ${recentIntervalCount} hard interval sessions in the last ${RECOVERY_GUARD_LOOKBACK_DAYS} days — recovery day before we have enough history to compute your full training load trend.`,
      };
    }
  }

  if (level === RiderLevel.RACING) {
    return {
      type: WorkoutType.INTERVAL,
      reason: "Training load looks normal and you're building toward race fitness — time for a hard interval session.",
    };
  }

  return {
    type: WorkoutType.ENDURANCE,
    reason: "Training load looks normal — a steady endurance ride to build your aerobic base.",
  };
}

const EFFORT_ZONE_FOR_TYPE: Record<WorkoutType, IntensityZone> = {
  RECOVERY: IntensityZone.RECOVERY,
  ENDURANCE: IntensityZone.ENDURANCE,
  // Not attempting to distinguish THRESHOLD vs VO2MAX without more signal
  // than a 3-value WorkoutType — THRESHOLD is the safer default of the two.
  INTERVAL: IntensityZone.THRESHOLD,
};

const DURATION_RANGE_MINUTES: Record<WorkoutType, { min: number; max: number }> = {
  RECOVERY: { min: 30, max: 45 },
  ENDURANCE: { min: 60, max: 90 },
  INTERVAL: { min: 45, max: 60 },
};

// Standard %max-heart-rate-per-zone convention.
const HR_PERCENT_RANGE: Record<IntensityZone, { min: number; max: number }> = {
  RECOVERY: { min: 0.5, max: 0.6 },
  ENDURANCE: { min: 0.6, max: 0.7 },
  TEMPO: { min: 0.7, max: 0.8 },
  THRESHOLD: { min: 0.8, max: 0.9 },
  VO2MAX: { min: 0.9, max: 1.0 },
};

export interface SuggestedEffort {
  zone: IntensityZone;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  targetHrRange: { min: number; max: number } | null;
}

export function getSuggestedEffort(type: WorkoutType, maxHr: number | null): SuggestedEffort {
  const zone = EFFORT_ZONE_FOR_TYPE[type];
  const duration = DURATION_RANGE_MINUTES[type];
  const hrPercent = HR_PERCENT_RANGE[zone];

  return {
    zone,
    minDurationMinutes: duration.min,
    maxDurationMinutes: duration.max,
    targetHrRange:
      maxHr === null
        ? null
        : { min: Math.round(maxHr * hrPercent.min), max: Math.round(maxHr * hrPercent.max) },
  };
}

export interface SpotPick {
  spot: Spot | null;
  reason: string | null;
  otherSpots: Spot[];
}

// Ranks on real terrain data already present on Spot rather than
// `difficulty` — every seeded spot currently has difficulty: null, so it
// can't discriminate anything yet.
export function pickTopSpot(type: WorkoutType, spots: Spot[]): SpotPick {
  if (spots.length === 0) {
    return { spot: null, reason: null, otherSpots: [] };
  }

  let best: Spot | null = null;
  let reason: string | null = null;

  if (type === WorkoutType.RECOVERY) {
    const candidates = spots.filter((s) => s.averageGradePercent !== null);
    if (candidates.length > 0) {
      best = candidates.reduce((flattest, s) =>
        s.averageGradePercent! < flattest.averageGradePercent! ? s : flattest,
      );
      reason = `${best.name} is the flattest of your suitable routes — easy on tired legs.`;
    }
  } else if (type === WorkoutType.ENDURANCE) {
    const candidates = spots.filter((s) => s.distanceMeters !== null);
    if (candidates.length > 0) {
      best = candidates.reduce((longest, s) =>
        s.distanceMeters! > longest.distanceMeters! ? s : longest,
      );
      reason = `${best.name} is the longest of your suitable routes — good steady mileage.`;
    }
  } else {
    const candidates = spots.filter((s) => s.averageGradePercent !== null);
    if (candidates.length > 0) {
      best = candidates.reduce((steepest, s) => {
        if (s.averageGradePercent! > steepest.averageGradePercent!) return s;
        if (
          s.averageGradePercent! === steepest.averageGradePercent! &&
          (s.distanceMeters ?? Infinity) < (steepest.distanceMeters ?? Infinity)
        ) {
          return s;
        }
        return steepest;
      });
      reason = `${best.name} is a short, steep climb — good terrain for interval efforts.`;
    }
  }

  if (best === null) {
    best = spots[0];
  }

  return {
    spot: best,
    reason,
    otherSpots: spots.filter((s) => s.id !== best!.id),
  };
}
