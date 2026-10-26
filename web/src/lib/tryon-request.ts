import type { Product } from './products'
import { getProductCapabilities } from './product-capabilities'
import type { TryOnState, StylingExtras } from '@/components/tryon/types'

export function buildTryOnRequest(product: Product, state: Pick<TryOnState, 'photoId' | 'sizeCm' | 'irisPx' | 'ear' | 'finger' | 'ringSizeUs'>, extras: StylingExtras = {}) {
  const c = getProductCapabilities(product)
  const body: Record<string, any> = { photoId: state.photoId, productId: product.id, flow: c.flow }
  if (c.calibration) {
    body.sizeCm = state.sizeCm; body.irisPx = state.irisPx; body.occluded = 0
    if (state.ear !== 'auto') body.ear = state.ear
    if (extras.stack?.length) body.stack = extras.stack
  }
  if (product.type === 'ring') { body.finger = state.finger; body.ringSizeUs = state.ringSizeUs }
  if (c.styling) {
    const options: Record<string, unknown> = {}
    if (extras.lipstick) options.lipstick = { hex: extras.lipstick.hex, texture: extras.lipstick.texture, intensity: extras.lipstick.intensity }
    if (extras.hairUp) options.hairUp = { templateId: extras.hairUp.templateId }
    if (extras.outfit) options.outfit = { productId: extras.outfit.productId }
    if (Object.keys(options).length) body.options = options
  }
  return body
}
