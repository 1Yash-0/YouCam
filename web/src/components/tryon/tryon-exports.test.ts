import { describe, it, expect } from 'vitest'
import {
  TryOnDrawer,
  DrawerHeader,
  PhotoStep,
  MeasureStep,
  ProcessingStep,
  ResultStep,
  SplitSlider,
  MeasuringRulerOverlay,
  CompleteTheLook,
  CartDrawer,
  ErrorCard,
} from './index'

describe('Try-On Drawer Subsystem Exports and Contracts', () => {
  it('exports all 10 core try-on components from index.ts', () => {
    expect(TryOnDrawer).toBeDefined()
    expect(DrawerHeader).toBeDefined()
    expect(PhotoStep).toBeDefined()
    expect(MeasureStep).toBeDefined()
    expect(ProcessingStep).toBeDefined()
    expect(ResultStep).toBeDefined()
    expect(SplitSlider).toBeDefined()
    expect(MeasuringRulerOverlay).toBeDefined()
    expect(CompleteTheLook).toBeDefined()
    expect(CartDrawer).toBeDefined()
    expect(ErrorCard).toBeDefined()
  })

  it('all exported components are valid React component functions', () => {
    expect(typeof TryOnDrawer).toBe('function')
    expect(typeof DrawerHeader).toBe('function')
    expect(typeof PhotoStep).toBe('function')
    expect(typeof MeasureStep).toBe('function')
    expect(typeof ProcessingStep).toBe('function')
    expect(typeof ResultStep).toBe('function')
    expect(typeof SplitSlider).toBe('function')
    expect(typeof MeasuringRulerOverlay).toBe('function')
    expect(typeof CompleteTheLook).toBe('function')
    expect(typeof CartDrawer).toBe('function')
    expect(typeof ErrorCard).toBe('function')
  })
})
