import type { KeyboardEvent } from 'react'
import type { DayStatus } from '../lib/calendarGrid'
import type { TodayPlan, Workout } from '../types/workout'
import {
  WORKOUT_TYPE_ICON,
  WORKOUT_TYPE_LABEL,
  WORKOUT_TYPE_CLASSES,
  INTENSITY_ZONE_LABEL,
  INTENSITY_ZONE_ABBR,
} from '../lib/workoutDisplay'

interface CalendarDayCellProps {
  day: number
  dateLabel: string
  status: DayStatus
  primaryWorkout: Workout | null
  extraWorkoutCount: number
  todayPlan: TodayPlan | null
  isActive: boolean
  cellRef: (el: HTMLDivElement | null) => void
  onFocus: () => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
}

export function CalendarDayCell({
  day,
  dateLabel,
  status,
  primaryWorkout,
  extraWorkoutCount,
  todayPlan,
  isActive,
  cellRef,
  onFocus,
  onKeyDown,
}: CalendarDayCellProps) {
  const isToday = status === 'today'

  let ariaLabel: string
  if (isToday) {
    ariaLabel = todayPlan
      ? `${dateLabel}, today, recommended ${WORKOUT_TYPE_LABEL[todayPlan.recommendedType]}`
      : `${dateLabel}, today`
  } else if (status === 'past') {
    ariaLabel = primaryWorkout
      ? `${dateLabel}, ${WORKOUT_TYPE_LABEL[primaryWorkout.type]}, ${INTENSITY_ZONE_LABEL[primaryWorkout.intensity]} zone${
          extraWorkoutCount > 0 ? `, plus ${extraWorkoutCount} more workout${extraWorkoutCount === 1 ? '' : 's'}` : ''
        }`
      : `${dateLabel}, no workout logged`
  } else {
    ariaLabel = dateLabel
  }

  const badgeType = isToday ? todayPlan?.recommendedType : primaryWorkout?.type
  const Icon = badgeType ? WORKOUT_TYPE_ICON[badgeType] : null

  const shellClasses = isToday
    ? 'bg-brand text-brand-fg border-transparent shadow-[0_4px_20px_-4px_rgba(234,88,12,0.55)]'
    : badgeType
      ? WORKOUT_TYPE_CLASSES[badgeType]
      : 'bg-card border-border text-muted-fg'

  return (
    <div
      ref={cellRef}
      role="gridcell"
      aria-current={isToday ? 'date' : undefined}
      aria-label={ariaLabel}
      tabIndex={isActive ? 0 : -1}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={`flex min-h-24 flex-col gap-1.5 rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:ring-[color:var(--daycell-focus-ring)] ${shellClasses} ${
        status === 'future' ? 'opacity-60' : ''
      }`}
    >
      <span className={`text-base font-semibold ${isToday ? '' : 'font-display tracking-wide'}`}>
        {day}
      </span>
      {isToday && (
        <span className="text-[11px] font-bold uppercase tracking-widest">Today</span>
      )}
      {Icon && (
        <div className="mt-auto flex items-center gap-1.5">
          <Icon size={18} aria-hidden="true" />
          {!isToday && primaryWorkout && (
            <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide">
              {INTENSITY_ZONE_ABBR[primaryWorkout.intensity]}
            </span>
          )}
          {!isToday && extraWorkoutCount > 0 && (
            <span className="text-[10px] font-bold">+{extraWorkoutCount}</span>
          )}
        </div>
      )}
    </div>
  )
}
