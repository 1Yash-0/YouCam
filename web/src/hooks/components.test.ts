import { describe, it, expect } from 'vitest'
import { PillButton } from '@/components/PillButton'
import { Toast, ToastProvider, useToast } from '@/components/Toast'
import { Header } from '@/components/Header'
import { Glint } from '@/components/Glint'
import { BoxRevealImage } from '@/components/BoxReveal'
import { MacroTilt } from '@/components/MacroTilt'

describe('Component exports and contracts', () => {
  it('exports all foundational components', () => {
    expect(PillButton).toBeDefined()
    expect(Toast).toBeDefined()
    expect(ToastProvider).toBeDefined()
    expect(useToast).toBeDefined()
    expect(Header).toBeDefined()
    expect(Glint).toBeDefined()
    expect(BoxRevealImage).toBeDefined()
    expect(MacroTilt).toBeDefined()
  })

  it('PillButton is a valid React functional component', () => {
    expect(typeof PillButton).toBe('function')
  })

  it('Toast components and hooks are defined functions', () => {
    expect(typeof Toast).toBe('function')
    expect(typeof ToastProvider).toBe('function')
    expect(typeof useToast).toBe('function')
  })

  it('Header is a valid React functional component', () => {
    expect(typeof Header).toBe('function')
  })

  it('throws if useToast is used outside provider context', () => {
    expect(() => useToast()).toThrow()
  })
})
