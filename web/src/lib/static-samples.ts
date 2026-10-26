import manifest from '../../data/sample-manifest.json'

export interface StaticSampleEntry {
  id: string
  title: string
  flow: string
  productId: string
  sizeCm?: number
  steps: string[]
  imagePath: string
  [key: string]: unknown
}

export const STATIC_SAMPLE_MANIFEST = manifest as StaticSampleEntry[]

export function findStaticSample(id: string): StaticSampleEntry | undefined {
  return STATIC_SAMPLE_MANIFEST.find((sample) => sample.id === id)
}

/** The public fallback only accepts a single, ordinary image filename. */
export function isSafeSampleImageName(imagePath: unknown): imagePath is string {
  return typeof imagePath === 'string'
    && !imagePath.includes('..')
    && !/[\\/]/.test(imagePath)
    && /^[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:png|jpe?g|webp)$/i.test(imagePath)
}
