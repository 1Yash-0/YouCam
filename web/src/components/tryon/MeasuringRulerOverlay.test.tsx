import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MeasuringRulerOverlay } from './MeasuringRulerOverlay'

const measurement = {
  box: { x: 357, y: 656, w: 42, h: 102, pixels: 1969 },
  renderedCm: 2.94,
}

function renderAtContainerSize(width: number, height: number, caliperDrawn = true): string {
  return renderToStaticMarkup(
    React.createElement(
      'div',
      { style: { width, height } },
      React.createElement(MeasuringRulerOverlay, {
        box: measurement.box,
        renderedCm: measurement.renderedCm,
        caliperDrawn,
      }),
    ),
  )
}

function readSizeLabel(markup: string): string {
  const match = markup.match(/<text[^>]*>([^<]*cm)<\/text>/)
  if (!match) throw new Error('Ruler label text was not rendered')
  return match[1]
}

describe('MeasuringRulerOverlay', () => {
  it('renders the same server measurement at desktop and mobile container sizes', () => {
    const desktopLabel = readSizeLabel(renderAtContainerSize(1440, 900))
    const mobileLabel = readSizeLabel(renderAtContainerSize(390, 844))

    expect(desktopLabel).toBe('2.9 cm')
    expect(mobileLabel).toBe(desktopLabel)
    expect(desktopLabel).toBe(`${measurement.renderedCm.toFixed(1)} cm`)
  })

  it('marks where the piece ends with a line across the photo at the bottom of the measured box', () => {
    const html = renderAtContainerSize(1440, 900)
    expect(html).toContain('ends here')
    const bottom = measurement.box.y + measurement.box.h
    expect(html).toMatch(new RegExp(`<line x1="0" y1="${bottom}" x2="1104" y2="${bottom}"`))
  })

  it('draws nothing labelled until the caliper is drawn', () => {
    const html = renderAtContainerSize(1440, 900, false)
    expect(html).not.toContain('ends here')
    expect(html).not.toMatch(/\d cm</)
  })
})
