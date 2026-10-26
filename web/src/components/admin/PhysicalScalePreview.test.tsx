import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PhysicalScalePreview } from './PhysicalScalePreview'

describe('PhysicalScalePreview', () => {
  it('shows a proportional sketch without claiming physical screen calibration', () => {
    const html = renderToString(
      React.createElement(PhysicalScalePreview, {
        heightCm: 3,
        widthCm: 1.5,
        productName: 'Demo stud',
      }),
    )
    const dimensions = html.match(/width:([\d.]+)px;height:([\d.]+)px/)

    expect(dimensions).not.toBeNull()
    expect(Number(dimensions?.[1]) / Number(dimensions?.[2])).toBeCloseTo(0.5)
    expect(html).toContain('The sketch follows the entered proportions.')
    expect(html).toContain('on-screen size is not physically calibrated')
    expect(html).not.toContain('true-scale')
  })

  it('prompts for dimensions before showing a sketch', () => {
    const html = renderToString(
      React.createElement(PhysicalScalePreview, { heightCm: 0, widthCm: 0 }),
    )

    expect(html).toContain('Enter the product’s measured height and width')
    expect(html).not.toContain('width:-')
  })
})
