import { WorkoutType, RiderLevel } from "../generated/prisma/enums";

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

export function getPrescribedType(
  level: RiderLevel | null,
  recentWorkouts: WorkoutLike[],
  raceGoal: { date: Date } | null,
): WorkoutType {
  // A rider who hasn't set a level yet is treated as CASUAL — the safe
  // default, since it always resolves to ENDURANCE and never risks
  // prescribing INTERVAL to an unconfigured athlete.
  if (level === RiderLevel.CASUAL || level === null) {
    return WorkoutType.ENDURANCE;
  }

  if (raceGoal) {
    const now = new Date();
    const daysUntilRace = (raceGoal.date.getTime() - now.getTime()) / MS_PER_DAY;
    if (daysUntilRace >= 0 && daysUntilRace <= TAPER_DAYS_BEFORE_RACE) {
      return WorkoutType.RECOVERY;
    }
  }

  const acwr = calculateAcwr(recentWorkouts);
  if (acwr !== null && acwr >= ACWR_OVERREACHING_THRESHOLD) {
    return WorkoutType.RECOVERY;
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
      return WorkoutType.RECOVERY;
    }
  }

  return level === RiderLevel.RACING ? WorkoutType.INTERVAL : WorkoutType.ENDURANCE;
}
