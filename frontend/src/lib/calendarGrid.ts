import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns'

export interface CalendarCell {
  key: string
  date: Date
  day: number
}

export interface MonthGrid {
  monthLabel: string
  weekdayLabels: string[]
  weeks: (CalendarCell | null)[][]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * Workout.date comes back as a UTC-anchored ISO timestamp with no per-record
 * timezone. Slicing the date-only prefix (rather than parsing into a local
 * Date and re-extracting fields) buckets it by the same UTC calendar day the
 * backend's from/to range query already assumes — deliberately not a local
 * conversion.
 */
export function workoutDateKey(isoDate: string): string {
  return isoDate.slice(0, 10)
}

export function buildMonthGrid(monthStart: Date): MonthGrid {
  const start = startOfMonth(monthStart)
  const end = endOfMonth(monthStart)
  const days = eachDayOfInterval({ start, end })

  const cells: CalendarCell[] = days.map((date) => ({
    key: localDateKey(date),
    date,
    day: date.getDate(),
  }))

  const leadingBlanks = start.getDay()
  const totalCells = leadingBlanks + cells.length
  const trailingBlanks = (7 - (totalCells % 7)) % 7

  const flat: (CalendarCell | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...cells,
    ...Array(trailingBlanks).fill(null),
  ]

  const weeks: (CalendarCell | null)[][] = []
  for (let i = 0; i < flat.length; i += 7) {
    weeks.push(flat.slice(i, i + 7))
  }

  return {
    monthLabel: format(monthStart, 'MMMM yyyy'),
    weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    weeks,
  }
}

export function monthRangeParams(monthStart: Date): { from: string; to: string } {
  return {
    from: localDateKey(startOfMonth(monthStart)),
    to: localDateKey(endOfMonth(monthStart)),
  }
}

export type DayStatus = 'past' | 'today' | 'future'

export function getDayStatus(cellKey: string, todayKey: string): DayStatus {
  if (cellKey === todayKey) return 'today'
  return cellKey < todayKey ? 'past' : 'future'
}

export type NavKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Home'
  | 'End'

/** Clamps at the month boundary (no adjacent-month data is loaded, so no wraparound). */
export function nextFocusDay(
  currentDay: number,
  daysInMonth: number,
  navKey: NavKey,
): number {
  let target = currentDay
  switch (navKey) {
    case 'ArrowLeft':
      target = currentDay - 1
      break
    case 'ArrowRight':
      target = currentDay + 1
      break
    case 'ArrowUp':
      target = currentDay - 7
      break
    case 'ArrowDown':
      target = currentDay + 7
      break
    case 'Home':
      target = 1
      break
    case 'End':
      target = daysInMonth
      break
  }
  return Math.min(Math.max(target, 1), daysInMonth)
}
