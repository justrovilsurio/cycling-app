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
  targetHrRange: { min: number; max: number } | null
}

export interface TodayPlan {
  recommendedType: WorkoutType
  reason: string
  suggestedEffort: SuggestedEffort
  topSpot: Spot | null
  spotReason: string | null
  otherSpots: Spot[]
}
