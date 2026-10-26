'use client'
import React from 'react'
import styles from './SizeRuler.module.css'

/**
 * Sizes as a gold ruler: one tick per real size on a track, a gold disc on the selected one.
 * Each tick is a real button with aria-pressed, so keyboard and screen readers work as before.
 */
export function SizeRuler({ sizes, value, onChange, disabled, label, format = (v) => `${v} cm`, isAvailable, unavailableHint }: {
  sizes: number[]; value: number; onChange: (v: number) => void; disabled?: boolean; label: string; format?: (v: number) => string
  /** Sizes without a render yet show an open circle instead of a tick and cannot be chosen. */
  isAvailable?: (v: number) => boolean; unavailableHint?: string
}) {
  const index = Math.max(0, sizes.indexOf(value))
  const at = sizes.length > 1 ? index / (sizes.length - 1) : 0.5
  return (
    <div className={styles.ruler} role="group" aria-label={label} style={{ '--at': at } as React.CSSProperties}>
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.disc} aria-hidden="true" />
      <div className={styles.ticks}>
        {sizes.map((size) => {
          const available = isAvailable ? isAvailable(size) : true
          return (
            <button key={size} type="button" className={styles.tick} aria-pressed={size === value} disabled={disabled || !available}
              title={available ? undefined : unavailableHint} aria-description={available ? undefined : unavailableHint} onClick={() => onChange(size)}>
              <span className={available ? styles.mark : styles.markOpen} aria-hidden="true" />
              <span className={styles.label}>{format(size)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Three-segment progress cue: done and current filled gold, upcoming quiet. */
export function StepCue({ current, names }: { current: number; names: string[] }) {
  return (
    <nav aria-label="Try-on progress" className={styles.steps}>
      <ol className={styles.segments}>
        {names.map((name, i) => (
          <li key={name} className={styles.segment} data-state={i < current ? 'done' : i === current ? 'current' : 'next'} aria-current={i === current ? 'step' : undefined}>
            <span className={styles.srOnly}>{`Step ${i + 1} of ${names.length}: ${name}`}</span>
          </li>
        ))}
      </ol>
      <span className={styles.stepName} aria-hidden="true">{names[current]}</span>
    </nav>
  )
}
