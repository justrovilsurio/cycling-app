import type { ReactNode } from 'react'
import type { IntensityZone, HrRange, PrescribedBlock, SessionTemplate } from '../types/workout'
import {
  INTENSITY_ZONE_LABEL,
  formatMinuteRange,
  formatHrRange,
  formatRpe,
} from '../lib/workoutDisplay'

interface StepProps {
  title: string
  duration: string
  zone?: IntensityZone
  hr?: HrRange | null
  emphasis?: boolean
  children?: ReactNode
}

function Step({ title, duration, zone, hr, emphasis = false, children }: StepProps) {
  return (
    <li
      className={`rounded-lg border px-3 py-2 ${
        emphasis ? 'border-brand/40 bg-card' : 'border-border bg-card/40'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={emphasis ? 'font-semibold' : 'font-medium text-muted-fg'}>{title}</span>
        <span className="shrink-0 tabular-nums font-semibold">{duration}</span>
      </div>
      {zone && (
        <p className="mt-0.5 text-xs text-muted-fg">
          <span className="font-medium uppercase tracking-wide">{INTENSITY_ZONE_LABEL[zone]}</span>
          {hr && <span className="tabular-nums"> · {formatHrRange(hr)}</span>}
        </p>
      )}
      {children}
    </li>
  )
}

function WorkBlock({ block }: { block: PrescribedBlock }) {
  return (
    <Step
      title={`${block.reps} × ${block.durationMinutes} min`}
      duration={`${block.reps * block.durationMinutes} min work`}
      zone={block.targetZone}
      hr={block.targetHrRange}
      emphasis
    >
      <p className="mt-1.5 border-t border-border pt-1.5 text-xs text-muted-fg">
        {block.recoveryMinutes} min recovery between reps ·{' '}
        <span className="font-medium uppercase tracking-wide">
          {INTENSITY_ZONE_LABEL[block.recoveryZone]}
        </span>
        {block.recoveryHrRange && (
          <span className="tabular-nums"> · {formatHrRange(block.recoveryHrRange)}</span>
        )}
      </p>
    </Step>
  )
}

export function SessionPlan({ session }: { session: SessionTemplate }) {
  const { warmupMinutes, cooldownMinutes, workStructure, totalDurationMinutes } = session
  const isStructured = workStructure.length > 0

  // Warmup and cooldown are bookends *inside* a steady ride's total, but they
  // add on top of a structured session's work blocks. Subtracting here keeps
  // the steps from summing to more than the headline number.
  const steadyMinutes = {
    min: totalDurationMinutes.min - warmupMinutes - cooldownMinutes,
    max: totalDurationMinutes.max - warmupMinutes - cooldownMinutes,
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
          Your session
        </p>
        <p className="font-display text-lg tracking-wide text-brand tabular-nums">
          {formatMinuteRange(totalDurationMinutes)}
        </p>
      </div>

      <ol className="mt-2.5 flex flex-col gap-1.5">
        <Step title="Warm-up" duration={`${warmupMinutes} min`} />

        {isStructured ? (
          workStructure.map((block, index) => (
            <WorkBlock key={`${block.targetZone}-${index}`} block={block} />
          ))
        ) : (
          <Step
            title="Steady riding"
            duration={formatMinuteRange(steadyMinutes)}
            zone={session.primaryZone}
            hr={session.targetHrRange}
            emphasis
          />
        )}

        <Step title="Cool-down" duration={`${cooldownMinutes} min`} />
      </ol>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Cadence</dt>
          <dd className="font-semibold tabular-nums">
            {session.targetCadenceRpm.minRpm}–{session.targetCadenceRpm.maxRpm} rpm
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
            Effort (RPE)
          </dt>
          <dd className="font-semibold tabular-nums">{formatRpe(session.rpeCue)} / 10</dd>
        </div>
        <dd className="col-span-2 text-xs leading-relaxed text-muted-fg">
          {session.rpeCue.description}
        </dd>
      </dl>
    </div>
  )
}
