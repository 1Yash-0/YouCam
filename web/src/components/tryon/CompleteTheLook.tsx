'use client'

import React, { useState } from 'react'
import { CompleteTheLookProps } from './types'

const LIPSTICK_OPTIONS = [
  { id: 'berry-satin', name: 'Berry', hex: '#9B1B30', texture: 'satin' as const, intensity: 80 },
  { id: 'classic-red', name: 'Ruby', hex: '#B22222', texture: 'matte' as const, intensity: 85 },
  { id: 'warm-nude', name: 'Nude', hex: '#C08081', texture: 'gloss' as const, intensity: 75 },
  { id: 'plum-rich', name: 'Plum', hex: '#682860', texture: 'satin' as const, intensity: 80 },
]

export function CompleteTheLook({
  extras,
  onToggleLipstick,
  onToggleHairUp,
  onToggleOutfit,
  onToggleStack,
  isRendering,
  cachedPresets,
  onSelectLipstickShade,
}: CompleteTheLookProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)

  const isLipstickActive = Boolean(extras.lipstick)
  const isHairActive = Boolean(extras.hairUp)
  const isOutfitActive = Boolean(extras.outfit)
  const isStackActive = Boolean(extras.stack && extras.stack.length > 0)

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-[var(--line)]">
      <div className="flex items-center justify-between">
        <span className="ui-label text-[10px] text-[var(--ink-2)] tracking-wider">
          COMPLETE THE LOOK (ONE-TAP STYLING)
        </span>
        {isRendering && (
          <span className="ui-label text-[10px] text-[var(--gold)] flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
            RENDERING…
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 relative">
        {/* Preset 1: Flattering Lipstick */}
        <div className="relative">
          <button
            type="button"
            disabled={isRendering}
            onClick={onToggleLipstick}
            className={`
              w-full p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-20
              focus-visible:outline-2 focus-visible:outline-[var(--gold)]
              ${
                isLipstickActive
                  ? 'border-[var(--gold)] bg-[var(--gold)]/5 shadow-2xs'
                  : 'border-[var(--line)] bg-white hover:border-[var(--gold)]/60'
              }
            `}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: extras.lipstick?.hex || '#9B1B30' }}
              />
              {isLipstickActive ? (
                <span className="text-[var(--gold)] text-xs font-bold">✓</span>
              ) : cachedPresets.has(extras.lipstick?.id || 'berry-satin') ? (
                <span className="text-[8px] ui-label text-[var(--ok)]">FAST</span>
              ) : null}
            </div>

            <div>
              <p className="ui-label text-[10px] text-[var(--ink)] truncate">
                {extras.lipstick?.name || 'BERRY'}
              </p>
              <p className="text-[10px] text-[var(--ink-2)] truncate">
                {isLipstickActive ? 'Active' : 'Lipstick'}
              </p>
            </div>
          </button>

          {/* Popover trigger */}
          {onSelectLipstickShade && (
            <button
              type="button"
              onClick={() => setPopoverOpen(!popoverOpen)}
              className="absolute top-2 right-2 text-[9px] ui-label text-[var(--ink-2)] hover:text-[var(--gold)] focus-visible:outline-1 focus-visible:outline-[var(--gold)]"
              aria-label="Change lipstick shade"
            >
              {popoverOpen ? '×' : '⋯'}
            </button>
          )}

          {/* Lipstick Shade Popover */}
          {popoverOpen && onSelectLipstickShade && (
            <div className="absolute bottom-full left-0 mb-2 p-2 rounded-xl bg-white border border-[var(--line)] shadow-lg z-30 flex flex-col gap-1.5 w-44">
              <span className="ui-label text-[9px] text-[var(--ink-2)] px-1">CHOOSE SHADE</span>
              {LIPSTICK_OPTIONS.map((shade) => (
                <button
                  key={shade.id}
                  type="button"
                  onClick={() => {
                    onSelectLipstickShade(shade)
                    setPopoverOpen(false)
                  }}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--paper)] text-left text-xs transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/10"
                    style={{ backgroundColor: shade.hex }}
                  />
                  <span className="text-[11px] text-[var(--ink)]">{shade.name}</span>
                  <span className="text-[9px] text-[var(--ink-2)] ml-auto capitalize">{shade.texture}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preset 2: Two Braids Updo */}
        <button
          type="button"
          disabled={isRendering}
          onClick={onToggleHairUp}
          className={`
            p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-20
            focus-visible:outline-2 focus-visible:outline-[var(--gold)]
            ${
              isHairActive
                ? 'border-[var(--gold)] bg-[var(--gold)]/5 shadow-2xs'
                : 'border-[var(--line)] bg-white hover:border-[var(--gold)]/60'
            }
          `}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs">💇‍♀️</span>
            {isHairActive && <span className="text-[var(--gold)] text-xs font-bold">✓</span>}
          </div>

          <div>
            <p className="ui-label text-[10px] text-[var(--ink)] truncate">TWO BRAIDS</p>
            <p className="text-[10px] text-[var(--ink-2)] truncate">
              {isHairActive ? 'Active' : 'Expose ears'}
            </p>
          </div>
        </button>

        {/* Preset 3: Emerald Silk Blouse */}
        <button
          type="button"
          disabled={isRendering}
          onClick={onToggleOutfit}
          className={`
            p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-20
            focus-visible:outline-2 focus-visible:outline-[var(--gold)]
            ${
              isOutfitActive
                ? 'border-[var(--gold)] bg-[var(--gold)]/5 shadow-2xs'
                : 'border-[var(--line)] bg-white hover:border-[var(--gold)]/60'
            }
          `}
        >
          <div className="flex items-center justify-between w-full">
            <span className="w-3.5 h-3.5 rounded-full bg-[#1B4D3E] border border-black/10 shrink-0" />
            {isOutfitActive && <span className="text-[var(--gold)] text-xs font-bold">✓</span>}
          </div>

          <div>
            <p className="ui-label text-[10px] text-[var(--ink)] truncate">SILK BLOUSE</p>
            <p className="text-[10px] text-[var(--ink-2)] truncate">
              {isOutfitActive ? 'Active' : 'Emerald silk'}
            </p>
          </div>
        </button>

        {/* Preset 4: Dot Stud Stack */}
        <button
          type="button"
          disabled={isRendering}
          onClick={onToggleStack}
          className={`
            p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-20
            focus-visible:outline-2 focus-visible:outline-[var(--gold)]
            ${
              isStackActive
                ? 'border-[var(--gold)] bg-[var(--gold)]/5 shadow-2xs'
                : 'border-[var(--line)] bg-white hover:border-[var(--gold)]/60'
            }
          `}
        >
          <div className="flex items-center justify-between w-full">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-black/10 shrink-0" />
            {isStackActive && <span className="text-[var(--gold)] text-xs font-bold">✓</span>}
          </div>

          <div>
            <p className="ui-label text-[10px] text-[var(--ink)] truncate">DOT STUD</p>
            <p className="text-[10px] text-[var(--ink-2)] truncate">
              {isStackActive ? 'Active' : '+0.6cm stud'}
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}
