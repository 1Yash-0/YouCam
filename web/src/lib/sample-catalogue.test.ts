import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SAMPLE_RESULTS } from './sample-catalogue'
import { STATIC_SAMPLE_MANIFEST } from './static-samples'

describe('saved product sample availability', () => {
  it('uses a standalone Dot Stud render while preserving the combined stack as a separate sample', () => {
    const stack = STATIC_SAMPLE_MANIFEST.find((sample) => sample.id === 'stud-drop-stack')
    const stud = STATIC_SAMPLE_MANIFEST.find((sample) => sample.id === 'dot-stud-0.6cm')

    expect(stack).toMatchObject({ flow: 'stack', productId: 'dot-stud' })
    expect(stud).toMatchObject({ flow: 'single-earring', productId: 'dot-stud', sizeCm: 0.6, imagePath: 'dot-stud-0.6cm.png' })
    expect(fs.existsSync(path.join(process.cwd(), 'public', 'samples', 'dot-stud-0.6cm.png'))).toBe(true)
    expect(SAMPLE_RESULTS['dot-stud']).toMatchObject({ imageUrl: '/samples/dot-stud-0.6cm.png', sizeCm: 0.6 })
    expect(SAMPLE_RESULTS['gilded-teardrop']?.imageUrl).toBe('/samples/single-teardrop-3cm.png')
  })
})
