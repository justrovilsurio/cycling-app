import { Wind, Route, Zap, type LucideIcon } from 'lucide-react'
import type { WorkoutType, IntensityZone } from '../types/workout'

export const WORKOUT_TYPE_ICON: Record<WorkoutType, LucideIcon> = {
  RECOVERY: Wind,
  ENDURANCE: Route,
  INTERVAL: Zap,
}

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  RECOVERY: 'Recovery',
  ENDURANCE: 'Endurance',
  INTERVAL: 'Interval',
}

/** Tailwind utilities built from the semantic day-state tokens in index.css. */
export const WORKOUT_TYPE_CLASSES: Record<WorkoutType, string> = {
  RECOVERY: 'bg-recovery-bg text-recovery-fg border-recovery-border',
  ENDURANCE: 'bg-endurance-bg text-endurance-fg border-endurance-border',
  INTERVAL: 'bg-interval-bg text-interval-fg border-interval-border',
}

export const INTENSITY_ZONE_LABEL: Record<IntensityZone, string> = {
  RECOVERY: 'Recovery',
  ENDURANCE: 'Endurance',
  TEMPO: 'Tempo',
  THRESHOLD: 'Threshold',
  VO2MAX: 'VO2 Max',
}

export const INTENSITY_ZONE_ABBR: Record<IntensityZone, string> = {
  RECOVERY: 'REC',
  ENDURANCE: 'END',
  TEMPO: 'TMP',
  THRESHOLD: 'THR',
  VO2MAX: 'VO2',
}
