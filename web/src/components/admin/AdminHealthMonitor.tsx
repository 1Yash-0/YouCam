'use client'

import React from 'react'
import { HealthData } from './types'

interface AdminHealthMonitorProps {
  health: HealthData | null
  loading: boolean
  onRefresh: () => void
}

export function AdminHealthMonitor({ health, loading, onRefresh }: AdminHealthMonitorProps) {
  const units = health?.units ?? 0
  const reserveFloor = health?.reserveFloor ?? 450
  const spendableUnits = Math.max(0, units - reserveFloor)
  const isHealthy = Boolean(health?.ok && health?.keyValid)
  const isOperational = isHealthy && units > reserveFloor

  let statusText = 'OPERATIONAL'
  let statusBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'

  if (!isHealthy) {
    statusText = 'OFFLINE / INVALID KEY'
    statusBadgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
  } else if (!isOperational) {
    statusText = 'RESERVE PROTECTED'
    statusBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
  }

  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-[var(--radius-sm)] p-6 mb-8 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4 mb-5">
        <div className="flex items-center gap-3">
          <span className="ui-label text-[10px] text-[var(--gold)]">TELEMETRY</span>
          <h2 className="text-lg font-medium text-[var(--ink)]">API Health & Units Guard</h2>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${statusBadgeClass}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                !isHealthy
                  ? 'bg-rose-500'
                  : isOperational
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
            />
            {statusText}
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="ui-label text-[11px] text-[var(--ink-2)] hover:text-[var(--gold)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] transition-colors cursor-pointer flex items-center gap-1.5"
        >
          {loading ? 'REFRESHING…' : 'REFRESH TELEMETRY ↻'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Spendable Credits */}
        <div className="p-4 rounded-[var(--radius-sm)] bg-white/40 dark:bg-black/20 border border-[var(--line)]">
          <span className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
            Spendable Credits
          </span>
          <div className="text-3xl font-light text-[var(--ink)] tabular-nums">
            {spendableUnits}
          </div>
          <p className="text-[11px] text-[var(--ink-2)] mt-1">
            Active try-on budget (gross minus reserve floor)
          </p>
        </div>

        {/* Reserve Floor */}
        <div className="p-4 rounded-[var(--radius-sm)] bg-white/40 dark:bg-black/20 border border-[var(--line)]">
          <span className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
            Protected Reserve Floor
          </span>
          <div className="text-3xl font-light text-[var(--gold)] tabular-nums">
            {reserveFloor}
          </div>
          <p className="text-[11px] text-[var(--ink-2)] mt-1">
            Preserved demo credit pool (assertCanSpend guard)
          </p>
        </div>

        {/* Gross Credits */}
        <div className="p-4 rounded-[var(--radius-sm)] bg-white/40 dark:bg-black/20 border border-[var(--line)]">
          <span className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
            Gross YouCam Balance
          </span>
          <div className="text-3xl font-light text-[var(--ink)] tabular-nums">
            {units}
          </div>
          <p className="text-[11px] text-[var(--ink-2)] mt-1">
            Total units remaining on upstream Perfect Corp. account
          </p>
        </div>

        {/* Upstream Key Status */}
        <div className="p-4 rounded-[var(--radius-sm)] bg-white/40 dark:bg-black/20 border border-[var(--line)] flex flex-col justify-between">
          <div>
            <span className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
              Upstream Key Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium text-[var(--ink)]">
                {health?.keyValid ? 'Active & Valid' : 'Check API Credentials'}
              </span>
              {health?.keyValid && (
                <span className="text-emerald-500 font-bold" aria-hidden="true">✓</span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-[var(--ink-2)] mt-2">
            Deterministic sample cache enabled (0-unit execution)
          </p>
        </div>
      </div>
    </div>
  )
}
