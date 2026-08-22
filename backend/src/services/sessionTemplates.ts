import { WorkoutType, RiderLevel, IntensityZone } from "../generated/prisma/enums";
import { HR_PERCENT_RANGE } from "./planService";

const DEFAULT_WARMUP_MINUTES = 10;
const DEFAULT_COOLDOWN_MINUTES = 10;

// Steady rides get a duration window rather than a fixed number — the rider
// picks where in the band they land based on how the legs feel. Structured
// sessions derive their total from the block maths instead (see
// deriveTotalDuration), so they have no entry here.
const RECOVERY_DURATION = { min: 30, max: 60 };
const ENDURANCE_DURATION_BY_LEVEL: Record<RiderLevel, { min: number; max: number }> = {
  CASUAL: { min: 60, max: 75 },
  MID: { min: 75, max: 105 },
  RACING: { min: 90, max: 120 },
};

// Cadence bands. Recovery and endurance share the same easy-spinning range;
// tempo work drops slightly as the gear gets heavier, and VO2max efforts go
// up because they're closer to race-pace surges.
const SPINNING_CADENCE = { minRpm: 85, maxRpm: 95 };
const TEMPO_CADENCE = { minRpm: 80, maxRpm: 90 };
const VO2MAX_CADENCE = { minRpm: 90, maxRpm: 100 };

const INTERVAL_MID_REPS = 3;
const INTERVAL_MID_WORK_MINUTES = 8;
const INTERVAL_MID_RECOVERY_MINUTES = 4;

const INTERVAL_RACING_REPS = 4;
const INTERVAL_RACING_WORK_MINUTES = 4;
const INTERVAL_RACING_RECOVERY_MINUTES = 4;

export class MissingSessionTemplateError extends Error {}

export interface DurationRange {
  min: number;
  max: number;
}

export interface CadenceRange {
  minRpm: number;
  maxRpm: number;
}

export interface HrRange {
  min: number;
  max: number;
}

// Borg CR10-style rating of perceived exertion. This is the half of the
// prescription that still works when the rider has no HR strap on, or when
// heat, fatigue or illness makes their heart rate lie about how hard they
// are actually working.
export interface RpeCue {
  min: number;
  max: number;
  description: string;
}

export interface PrescribedBlock {
  reps: number;
  durationMinutes: number;
  targetZone: IntensityZone;
  targetHrRange: HrRange | null;
  recoveryMinutes: number;
  // Recoveries are ridden, not rested — the rider needs a target for them too,
  // otherwise "4min recovery" is silent on whether to soft-pedal or sit up.
  recoveryZone: IntensityZone;
  recoveryHrRange: HrRange | null;
}

export interface SessionTemplate {
  workoutType: WorkoutType;
  riderLevel: RiderLevel;
  totalDurationMinutes: DurationRange;
  warmupMinutes: number;
  cooldownMinutes: number;
  // The headline zone: the steady zone on an unstructured ride, the work
  // zone on a structured one.
  primaryZone: IntensityZone;
  targetHrRange: HrRange | null;
  // Empty for steady rides that have no interval structure at all.
  workStructure: PrescribedBlock[];
  targetCadenceRpm: CadenceRange;
  rpeCue: RpeCue;
}

interface WorkBlockBlueprint {
  reps: number;
  durationMinutes: number;
  targetZone: IntensityZone;
  recoveryMinutes: number;
  recoveryZone: IntensityZone;
}

// A template before a rider's maxHr is applied to it — pure shape, no
// heart-rate numbers. Keeping HR resolution out of the library means the
// library itself stays a plain lookup table with nothing to recompute.
interface SessionBlueprint {
  // null means "derive it from warmup + work blocks + cooldown".
  totalDurationMinutes: DurationRange | null;
  warmupMinutes: number;
  cooldownMinutes: number;
  primaryZone: IntensityZone;
  workStructure: WorkBlockBlueprint[];
  targetCadenceRpm: CadenceRange;
  rpeCue: RpeCue;
}

const RECOVERY_RPE: RpeCue = {
  min: 2,
  max: 3,
  description: "Very easy — you could hold a full conversation the whole way.",
};

const ENDURANCE_RPE: RpeCue = {
  min: 4,
  max: 5,
  description: "Comfortable and sustainable — talking is easy, but you'd rather not sing.",
};

const TEMPO_RPE: RpeCue = {
  min: 6,
  max: 7,
  description: "Comfortably hard — short sentences only, and the last rep should sting.",
};

// Borg CR10 anchors VO2max interval work at 8-9, not a flat 9 — the first rep
// should not feel the same as the last.
const VO2MAX_RPE: RpeCue = {
  min: 8,
  max: 9,
  description: "Very hard — one-word answers, and you're counting down the seconds.",
};

function steadyRide(
  zone: IntensityZone,
  duration: DurationRange,
  cadence: CadenceRange,
  rpeCue: RpeCue,
): SessionBlueprint {
  return {
    totalDurationMinutes: duration,
    // A steady ride's warmup and cooldown are the first and last ten minutes
    // of the same continuous ride, not extra time bolted on — so they sit
    // inside totalDurationMinutes rather than adding to it.
    warmupMinutes: DEFAULT_WARMUP_MINUTES,
    cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
    primaryZone: zone,
    workStructure: [],
    targetCadenceRpm: cadence,
    rpeCue,
  };
}

// The template library, keyed (WorkoutType, RiderLevel). A missing entry is a
// deliberate "this combination should never be prescribed", not an oversight
// — see getSessionTemplate.
const SESSION_BLUEPRINTS: Record<WorkoutType, Partial<Record<RiderLevel, SessionBlueprint>>> = {
  RECOVERY: {
    CASUAL: steadyRide(IntensityZone.RECOVERY, RECOVERY_DURATION, SPINNING_CADENCE, RECOVERY_RPE),
    MID: steadyRide(IntensityZone.RECOVERY, RECOVERY_DURATION, SPINNING_CADENCE, RECOVERY_RPE),
    RACING: steadyRide(IntensityZone.RECOVERY, RECOVERY_DURATION, SPINNING_CADENCE, RECOVERY_RPE),
  },
  ENDURANCE: {
    CASUAL: steadyRide(
      IntensityZone.ENDURANCE,
      ENDURANCE_DURATION_BY_LEVEL.CASUAL,
      SPINNING_CADENCE,
      ENDURANCE_RPE,
    ),
    MID: steadyRide(
      IntensityZone.ENDURANCE,
      ENDURANCE_DURATION_BY_LEVEL.MID,
      SPINNING_CADENCE,
      ENDURANCE_RPE,
    ),
    RACING: steadyRide(
      IntensityZone.ENDURANCE,
      ENDURANCE_DURATION_BY_LEVEL.RACING,
      SPINNING_CADENCE,
      ENDURANCE_RPE,
    ),
  },
  INTERVAL: {
    // No CASUAL entry on purpose — getPrescription never returns INTERVAL for
    // a casual rider, and if that ever changes we want a loud failure rather
    // than a casual rider quietly handed a VO2max set.
    MID: {
      totalDurationMinutes: null,
      warmupMinutes: DEFAULT_WARMUP_MINUTES,
      cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
      primaryZone: IntensityZone.TEMPO,
      workStructure: [
        {
          reps: INTERVAL_MID_REPS,
          durationMinutes: INTERVAL_MID_WORK_MINUTES,
          targetZone: IntensityZone.TEMPO,
          recoveryMinutes: INTERVAL_MID_RECOVERY_MINUTES,
          // "Easy spinning" between tempo blocks — the effort is moderate
          // enough that the recovery can drop right down.
          recoveryZone: IntensityZone.RECOVERY,
        },
      ],
      targetCadenceRpm: TEMPO_CADENCE,
      rpeCue: TEMPO_RPE,
    },
    RACING: {
      totalDurationMinutes: null,
      warmupMinutes: DEFAULT_WARMUP_MINUTES,
      cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
      primaryZone: IntensityZone.VO2MAX,
      workStructure: [
        {
          reps: INTERVAL_RACING_REPS,
          durationMinutes: INTERVAL_RACING_WORK_MINUTES,
          targetZone: IntensityZone.VO2MAX,
          recoveryMinutes: INTERVAL_RACING_RECOVERY_MINUTES,
          // The 4x4 protocol calls for *active* recovery at 60-70% maxHr, not
          // stopping — which is the ENDURANCE band in our zone model. Coming
          // to a halt between reps blunts the whole point of the session.
          recoveryZone: IntensityZone.ENDURANCE,
        },
      ],
      targetCadenceRpm: VO2MAX_CADENCE,
      rpeCue: VO2MAX_RPE,
    },
  },
};

// A zone is a classification band; a prescription target is what you actually
// aim for inside it, and the two are not always the same width. Zone 5 spans
// 90-100% maxHr, but no VO2max protocol asks a rider to hold 100% of max for
// four minutes — Helgerud & Hoff's 4x4 targets 90-95%. Narrowing it here
// rather than in HR_PERCENT_RANGE keeps the zone definitions intact for
// classifying past rides, which is a different job.
const PRESCRIPTION_HR_PERCENT: Partial<Record<IntensityZone, { min: number; max: number }>> = {
  VO2MAX: { min: 0.9, max: 0.95 },
};

function targetPercentFor(zone: IntensityZone): { min: number; max: number } {
  return PRESCRIPTION_HR_PERCENT[zone] ?? HR_PERCENT_RANGE[zone];
}

// Zones map to a % band of maxHr, never to power — we don't store FTP, so
// there is nothing to compute watts from. A rider with no maxHr on file still
// gets the full session shape, just with null HR targets; the cadence and RPE
// cues alone are enough to ride it.
function resolveHrRange(zone: IntensityZone, maxHr: number | null): HrRange | null {
  if (maxHr === null) {
    return null;
  }
  const percent = targetPercentFor(zone);
  return { min: Math.round(maxHr * percent.min), max: Math.round(maxHr * percent.max) };
}

// A structured session's length falls out of its own block maths, so there is
// no second number to keep in sync. The trailing recovery after the final rep
// counts as part of the cooldown rather than on top of it.
function deriveTotalDuration(blueprint: SessionBlueprint): DurationRange {
  const workMinutes = blueprint.workStructure.reduce(
    (total, block) => total + block.reps * (block.durationMinutes + block.recoveryMinutes),
    0,
  );
  const total = blueprint.warmupMinutes + workMinutes + blueprint.cooldownMinutes;
  return { min: total, max: total };
}

export function getSessionTemplate(
  type: WorkoutType,
  level: RiderLevel,
  maxHr: number | null,
): SessionTemplate {
  const blueprint = SESSION_BLUEPRINTS[type][level];
  if (blueprint === undefined) {
    throw new MissingSessionTemplateError(
      `No session template defined for ${type} at rider level ${level}.`,
    );
  }

  return {
    workoutType: type,
    riderLevel: level,
    totalDurationMinutes: blueprint.totalDurationMinutes ?? deriveTotalDuration(blueprint),
    warmupMinutes: blueprint.warmupMinutes,
    cooldownMinutes: blueprint.cooldownMinutes,
    primaryZone: blueprint.primaryZone,
    targetHrRange: resolveHrRange(blueprint.primaryZone, maxHr),
    workStructure: blueprint.workStructure.map((block) => ({
      ...block,
      targetHrRange: resolveHrRange(block.targetZone, maxHr),
      recoveryHrRange: resolveHrRange(block.recoveryZone, maxHr),
    })),
    targetCadenceRpm: blueprint.targetCadenceRpm,
    rpeCue: blueprint.rpeCue,
  };
}
