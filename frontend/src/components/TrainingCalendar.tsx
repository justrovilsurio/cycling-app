import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { format, getDaysInMonth } from 'date-fns'
import { apiFetch } from '../lib/api'
import {
  buildMonthGrid,
  getDayStatus,
  localDateKey,
  monthRangeParams,
  nextFocusDay,
  workoutDateKey,
  type NavKey,
} from '../lib/calendarGrid'
import type { TodayPlan, Workout } from '../types/workout'
import { CalendarDayCell } from './CalendarDayCell'
import { TodayPlanPanel } from './TodayPlanPanel'

const NAV_KEYS: NavKey[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']

export function TrainingCalendar() {
  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => localDateKey(today), [today])
  const grid = useMemo(() => buildMonthGrid(today), [today])
  const daysInMonth = useMemo(() => getDaysInMonth(today), [today])

  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState(today.getDate())

  const cellRefs = useRef(new Map<number, HTMLDivElement>())

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { from, to } = monthRangeParams(today)
        const [workoutsRes, planRes] = await Promise.all([
          apiFetch(`/workouts?from=${from}&to=${to}`),
          apiFetch('/plan/today'),
        ])
        if (!workoutsRes.ok || !planRes.ok) {
          throw new Error('Failed to load calendar data')
        }
        const workoutsData: Workout[] = await workoutsRes.json()
        const planData: TodayPlan = await planRes.json()
        if (!cancelled) {
          setWorkouts(workoutsData)
          setTodayPlan(planData)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load calendar data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [today])

  const workoutsByDay = useMemo(() => {
    const map = new Map<string, Workout[]>()
    for (const workout of workouts) {
      const key = workoutDateKey(workout.date)
      const list = map.get(key) ?? []
      list.push(workout)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return map
  }, [workouts])

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>, day: number) {
    if (!NAV_KEYS.includes(e.key as NavKey)) return
    e.preventDefault()
    const nextDay = nextFocusDay(day, daysInMonth, e.key as NavKey)
    setActiveDay(nextDay)
    cellRefs.current.get(nextDay)?.focus()
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6 p-4 lg:flex-row lg:items-start">
      <div className="flex-1">
        <h1
          id="calendar-heading"
          className="mb-4 font-display text-4xl tracking-wide text-brand"
        >
          {grid.monthLabel}
        </h1>

        <div role="status" aria-live="polite" className="sr-only">
          {loading ? 'Loading calendar…' : error ?? ''}
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div role="grid" aria-labelledby="calendar-heading" className="grid grid-cols-7 gap-2">
          <div role="row" className="contents">
            {grid.weekdayLabels.map((label) => (
              <div
                key={label}
                role="columnheader"
                className="p-1 text-center text-xs font-bold uppercase tracking-widest text-muted-fg"
              >
                {label}
              </div>
            ))}
          </div>

          {grid.weeks.map((week, weekIndex) => (
            <div key={weekIndex} role="row" className="contents">
              {week.map((cell, cellIndex) =>
                cell ? (
                  (() => {
                    const status = getDayStatus(cell.key, todayKey)
                    const dayWorkouts = status === 'past' ? workoutsByDay.get(cell.key) ?? [] : []
                    return (
                      <CalendarDayCell
                        key={cell.key}
                        day={cell.day}
                        dateLabel={format(cell.date, 'MMMM d')}
                        status={status}
                        primaryWorkout={dayWorkouts[0] ?? null}
                        extraWorkoutCount={Math.max(dayWorkouts.length - 1, 0)}
                        todayPlan={status === 'today' ? todayPlan : null}
                        isActive={cell.day === activeDay}
                        cellRef={(el) => {
                          if (el) cellRefs.current.set(cell.day, el)
                          else cellRefs.current.delete(cell.day)
                        }}
                        onFocus={() => setActiveDay(cell.day)}
                        onKeyDown={(e) => handleKeyDown(e, cell.day)}
                      />
                    )
                  })()
                ) : (
                  <div key={`blank-${weekIndex}-${cellIndex}`} role="gridcell" aria-hidden="true" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="lg:w-72">
        <TodayPlanPanel plan={todayPlan} />
      </div>
    </div>
  )
}
