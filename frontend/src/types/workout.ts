export type WorkoutType = 'RECOVERY' | 'ENDURANCE' | 'INTERVAL'

export type IntensityZone =
  | 'RECOVERY'
  | 'ENDURANCE'
  | 'TEMPO'
  | 'THRESHOLD'
  | 'VO2MAX'

export type WorkoutSource = 'MANUAL' | 'STRAVA'

export interface Workout {
  id: string
  userId: string
  date: string
  type: WorkoutType
  intensity: IntensityZone
  source: WorkoutSource
  spotId: string | null
  stravaActivityId: string | null
  distanceMeters: number | null
  durationSeconds: number | null
  avgHeartRate: number | null
  createdAt: string
  updatedAt: string
}

export type TerrainType = 'ROAD' | 'MTB'
export type SpotDifficulty = 'EASY' | 'MODERATE' | 'HARD' | 'EXPERT'

export interface Spot {
  id: string
  name: string
  terrainType: TerrainType
  difficulty: SpotDifficulty | null
  averageGradePercent: number | null
  maxGradePercent: number | null
  distanceMeters: number | null
  elevationGainMeters: number | null
  climbCategory: number | null
  suitableFor: WorkoutType[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SuggestedEffort {
  zone: IntensityZone
  minDurationMinutes: number
  maxDurationMinutes: number
  targetHrRange: HrRange | null
}

export type RiderLevel = 'CASUAL' | 'MID' | 'RACING'

export interface HrRange {
  min: number
  max: number
}

export interface DurationRange {
  min: number
  max: number
}

export interface PrescribedBlock {
  reps: number
  durationMinutes: number
  targetZone: IntensityZone
  targetHrRange: HrRange | null
  recoveryMinutes: number
  recoveryZone: IntensityZone
  recoveryHrRange: HrRange | null
}

export interface SessionTemplate {
  workoutType: WorkoutType
  riderLevel: RiderLevel
  totalDurationMinutes: DurationRange
  warmupMinutes: number
  cooldownMinutes: number
  primaryZone: IntensityZone
  targetHrRange: HrRange | null
  /** Empty for steady rides that have no interval structure. */
  workStructure: PrescribedBlock[]
  targetCadenceRpm: { minRpm: number; maxRpm: number }
  rpeCue: { min: number; max: number; description: string }
}

export interface TodayPlan {
  recommendedType: WorkoutType
  reason: string
  suggestedEffort: SuggestedEffort
  session: SessionTemplate
  topSpot: Spot | null
  spotReason: string | null
  otherSpots: Spot[]
}
