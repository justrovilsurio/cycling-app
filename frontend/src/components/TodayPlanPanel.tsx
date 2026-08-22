import type { TodayPlan } from '../types/workout'
import {
  WORKOUT_TYPE_ICON,
  WORKOUT_TYPE_LABEL,
  WORKOUT_TYPE_CLASSES,
  INTENSITY_ZONE_LABEL,
} from '../lib/workoutDisplay'

interface TodayPlanPanelProps {
  plan: TodayPlan | null
}

export function TodayPlanPanel({ plan }: TodayPlanPanelProps) {
  if (!plan) return null

  const Icon = WORKOUT_TYPE_ICON[plan.recommendedType]
  const { suggestedEffort, topSpot, spotReason, otherSpots } = plan

  return (
    <section
      aria-labelledby="today-plan-heading"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-fg shadow-lg"
    >
      <h2 id="today-plan-heading" className="font-display text-xl tracking-wide text-brand">
        Today's Plan
      </h2>

      <div
        className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold uppercase tracking-wide ${WORKOUT_TYPE_CLASSES[plan.recommendedType]}`}
      >
        <Icon size={16} aria-hidden="true" />
        {WORKOUT_TYPE_LABEL[plan.recommendedType]}
      </div>

      <p className="text-sm leading-relaxed text-muted-fg">{plan.reason}</p>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
            Target zone
          </dt>
          <dd className="font-semibold">{INTENSITY_ZONE_LABEL[suggestedEffort.zone]}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
            Duration
          </dt>
          <dd className="font-semibold">
            {suggestedEffort.minDurationMinutes}–{suggestedEffort.maxDurationMinutes} min
          </dd>
        </div>
        {suggestedEffort.targetHrRange && (
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
              Target heart rate
            </dt>
            <dd className="font-semibold">
              {suggestedEffort.targetHrRange.min}–{suggestedEffort.targetHrRange.max} bpm
            </dd>
          </div>
        )}
      </dl>

      {topSpot && (
        <div className="rounded-lg border border-brand/40 bg-surface p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
            Your route
          </p>
          <p className="mt-0.5 text-base font-semibold">{topSpot.name}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
            {topSpot.terrainType}
            {topSpot.difficulty ? ` · ${topSpot.difficulty}` : ''}
          </p>
          {spotReason && <p className="mt-2 text-muted-fg">{spotReason}</p>}
          {topSpot.notes && <p className="mt-1 text-muted-fg">{topSpot.notes}</p>}
        </div>
      )}

      {otherSpots.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted-fg">
            Other suitable routes ({otherSpots.length})
          </summary>
          <ul className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {otherSpots.map((spot) => (
              <li key={spot.id} className="rounded-lg border border-border bg-surface p-2.5">
                <p className="font-semibold">{spot.name}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
                  {spot.terrainType}
                  {spot.difficulty ? ` · ${spot.difficulty}` : ''}
                </p>
                {spot.notes && <p className="mt-1 text-muted-fg">{spot.notes}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
