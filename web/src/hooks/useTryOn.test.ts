import '../../tests/dom-polyfill'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import React, { act } from 'react'
import ReactDOM from 'react-dom/client'
import { createMockElement, mockDoc } from '../../tests/dom-polyfill'
import { useTryOn } from './useTryOn'
import type { Product } from '@/lib/products'

const earring: Product = {
  id: 'gilded-teardrop', name: 'Gilded Teardrop', brand: 'Darpan', type: 'single',
  heightCm: 3, widthCm: 1.3, metal: 'gold', priceUsd: 89, imagePath: '/products/teardrop.png',
  sizes: [3, 6], source: 'Demo', licence: 'Generated',
}

function renderHookHarness<T>(hookFn: () => T) {
  let latest!: T
  function Harness() { latest = hookFn(); return null }
  const container = createMockElement('div')
  container.ownerDocument = mockDoc
  const root = ReactDOM.createRoot(container)
  act(() => root.render(React.createElement(Harness)))
  return {
    get current() { return latest },
    unmount() { act(() => root.unmount()) },
  }
}

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as Response
}

function errorJson(body: unknown) {
  return { ok: false, status: 500, json: async () => body } as Response
}

function measurement(sizeCm: number) {
  return {
    naturalWidth: 1104, naturalHeight: 1472,
    box: { x: 100, y: 120, w: 20, h: 30, pixels: 30 },
    renderedPx: 30, renderedCm: sizeCm, errorPct: 0,
    withinTolerance: true, tolerancePct: 10,
  }
}

async function uploadPhoto(harness: ReturnType<typeof renderHookHarness<ReturnType<typeof useTryOn>>>) {
  await act(async () => {
    await harness.current.uploadPhoto(new File(['test image bytes'], 'portrait.jpg', { type: 'image/jpeg' }))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  const sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  vi.stubGlobal('sessionStorage', sessionStorage)
  vi.stubGlobal('window', { sessionStorage })
})

describe('useTryOn sample and personal photo behavior', () => {
  it('shows the sanitized private upload route error instead of replacing it with a generic message', async () => {
    global.fetch = vi.fn(async () => errorJson({
      code: 'INTERNAL_ERROR',
      userMessage: 'This request could not be completed. Please retry.',
    }))
    const harness = renderHookHarness(() => useTryOn({ product: earring }))

    await uploadPhoto(harness)

    expect(harness.current.state.error?.userMessage).toBe('This request could not be completed. Please retry.')
    harness.unmount()
  })

  it('shows the standalone Dot Stud sample without requesting another render', () => {
    const stud: Product = {
      id: 'dot-stud', name: 'Dot Stud', brand: 'Darpan', type: 'stud', heightCm: 0.6,
      widthCm: 0.6, metal: 'silver', priceUsd: 49, imagePath: '/products/stud.png',
      source: 'Demo', licence: 'Generated',
    }
    const harness = renderHookHarness(() => useTryOn({ product: stud }))
    expect(() => act(() => harness.current.selectSampleFace())).not.toThrow()
    expect(harness.current.state.step).toBe('result')
    expect(harness.current.state.isSampleFace).toBe(true)
    expect(harness.current.state.resultImageUrl).toBe('/samples/dot-stud-0.6cm.png')
    harness.unmount()
  })

  it('shows the reviewed sample immediately and does not request styling renders', () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy
    const harness = renderHookHarness(() => useTryOn({ product: earring }))

    act(() => harness.current.selectSampleFace())
    expect(harness.current.state.isSampleFace).toBe(true)
    expect(harness.current.state.step).toBe('result')
    expect(harness.current.state.resultImageUrl).toBe('/samples/single-teardrop-3cm.png')
    expect(harness.current.sizeComparisons).toEqual([
      { sizeCm: 3, imageUrl: '/samples/single-teardrop-3cm.png' },
      { sizeCm: 6, imageUrl: '/samples/earring-6cm.png' },
    ])

    act(() => {
      harness.current.toggleLipstick()
      harness.current.toggleHairUp()
      harness.current.toggleOutfit()
      harness.current.toggleStack()
      harness.current.selectLipstickShade({ id: 'rose', name: 'Rose', hex: '#aa3344', texture: 'satin', intensity: 80 })
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(harness.current.state.extras).toEqual({})
    harness.unmount()
  })

  it('uses the uploaded personal photo for API renders, never the sample path', async () => {
    const requests: Array<{ url: string; body?: string }> = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
      if (url.endsWith('/api/photo/upload')) return okJson({})
      if (url.endsWith('/api/photo')) return okJson({ photoId: 'personal-photo-hash', width: 1104, height: 1472 })
      if (url.endsWith('/api/tryon')) return okJson({ status: 'done', result: { key: 'personal-result', imageUrl: '/api/result/personal.png', measurement: null } })
      throw new Error(`Unexpected request: ${url}`)
    })
    const harness = renderHookHarness(() => useTryOn({ product: earring }))

    await uploadPhoto(harness)
    expect(harness.current.state.isSampleFace).toBe(false)
    expect(harness.current.state.photoId).toBe('personal-photo-hash')
    expect(harness.current.state.photoUrl).toBe('/api/photo/personal-photo-hash')

    await act(async () => harness.current.submitTryOn())
    const tryOnRequest = requests.find((request) => request.url.endsWith('/api/tryon'))
    expect(tryOnRequest).toBeDefined()
    expect(JSON.parse(tryOnRequest!.body!).photoId).toBe('personal-photo-hash')
    expect(harness.current.state.resultImageUrl).toBe('/api/result/personal.png')
    expect(harness.current.state.measurement).toBeNull()
    harness.unmount()
  })

  it('keeps per-size measurement metadata and reuses the cached size without another request', async () => {
    const requests: Array<{ url: string; body?: string }> = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
      if (url.endsWith('/api/photo/upload')) return okJson({})
      if (url.endsWith('/api/photo')) return okJson({ photoId: 'personal-photo-hash', width: 1104, height: 1472 })
      if (url.endsWith('/api/tryon')) {
        const body = JSON.parse(String(init?.body))
        return okJson({ status: 'done', result: { key: `result-${body.sizeCm}`, imageUrl: `/result-${body.sizeCm}.png`, measurement: measurement(body.sizeCm) } })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const harness = renderHookHarness(() => useTryOn({ product: earring }))
    await uploadPhoto(harness)
    await act(async () => harness.current.submitTryOn())
    expect(harness.current.state.measurement).toEqual(measurement(3))

    await act(async () => harness.current.compareSize(6))
    const sizeRequest = requests.filter((request) => request.url.endsWith('/api/tryon'))[1]
    expect(JSON.parse(sizeRequest.body!)).toMatchObject({ sizeCm: 6 })
    expect(JSON.parse(sizeRequest.body!)).not.toHaveProperty('options')
    expect(harness.current.state.measurement).toEqual(measurement(6))
    expect(harness.current.sizeComparisons).toEqual([
      { sizeCm: 3, imageUrl: '/result-3.png', measurement: measurement(3) },
      { sizeCm: 6, imageUrl: '/result-6.png', measurement: measurement(6) },
    ])

    await act(async () => harness.current.compareSize(3))
    expect(harness.current.state.sizeCm).toBe(3)
    expect(harness.current.state.resultImageUrl).toBe('/result-3.png')
    expect(harness.current.state.measurement).toEqual(measurement(3))
    expect(harness.current.state.baseMeasurement).toEqual(measurement(3))
    await act(async () => harness.current.compareSize(3))
    expect(requests.filter((request) => request.url.endsWith('/api/tryon'))).toHaveLength(2)
    harness.unmount()
  })

  it('does not start a size render while another result request is processing', async () => {
    const requests: string[] = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push(url)
      if (url.endsWith('/api/photo/upload')) return okJson({})
      if (url.endsWith('/api/photo')) return okJson({ photoId: 'personal-photo-hash', width: 1104, height: 1472 })
      if (url.endsWith('/api/tryon')) {
        const body = JSON.parse(String(init?.body))
        if (body.sizeCm === 6) return okJson({ status: 'running', jobId: 'job-size-6' })
        return okJson({ status: 'done', result: { key: 'result-3', imageUrl: '/result-3.png', measurement: measurement(3) } })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const harness = renderHookHarness(() => useTryOn({ product: earring }))
    await uploadPhoto(harness)
    await act(async () => harness.current.submitTryOn())
    await act(async () => harness.current.compareSize(6))
    expect(harness.current.state.step).toBe('processing')
    await act(async () => harness.current.compareSize(3))
    expect(requests.filter((url) => url.endsWith('/api/tryon'))).toHaveLength(2)
    harness.unmount()
  })

  it('loads hair choices only on request, applies styling once with the selected parameters, and clears to the base preview', async () => {
    const requests: Array<{ url: string; body?: string }> = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
      if (url.endsWith('/api/photo/upload')) return okJson({})
      if (url.endsWith('/api/photo')) return okJson({ photoId: 'personal-photo-hash', width: 1104, height: 1472 })
      if (url.endsWith('/api/hair/templates')) return okJson([{ id: 'bun-17', title: 'Soft bun' }, { id: 'curl-03', title: 'Loose curls' }])
      if (url.endsWith('/api/tryon')) {
        const call = requests.filter((request) => request.url.endsWith('/api/tryon')).length
        return okJson({ status: 'done', result: { key: `result-${call}`, imageUrl: `/result-${call}.png`, measurement: measurement(call === 1 ? 3 : 2) } })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const harness = renderHookHarness(() => useTryOn({ product: earring }))

    await uploadPhoto(harness)
    await act(async () => harness.current.submitTryOn())
    expect(harness.current.state.resultImageUrl).toBe('/result-1.png')
    await act(async () => harness.current.applyStyling({}))
    expect(requests.filter((request) => request.url.endsWith('/api/tryon'))).toHaveLength(1)
    expect(requests.filter((request) => request.url.endsWith('/api/hair/templates'))).toHaveLength(0)

    await act(async () => harness.current.loadHairTemplates())
    expect(harness.current.hairTemplates).toEqual([{ templateId: 'bun-17', title: 'Soft bun' }, { templateId: 'curl-03', title: 'Loose curls' }])
    const chosen = {
      lipstick: { id: 'custom', name: 'Custom', hex: '#a03467', texture: 'gloss' as const, intensity: 42 },
      hairUp: { templateId: 'curl-03', title: 'Loose curls' },
    }
    await act(async () => {
      const submitted = harness.current.applyStyling(chosen)
      harness.current.applyStyling(chosen)
      await submitted
    })

    const stylingRequests = requests.filter((request) => request.url.endsWith('/api/tryon'))
    expect(stylingRequests).toHaveLength(2)
    expect(JSON.parse(stylingRequests[1].body!).options).toEqual({
      lipstick: { hex: '#a03467', texture: 'gloss', intensity: 42 },
      hairUp: { templateId: 'curl-03' },
    })
    expect(harness.current.state.extras).toEqual(chosen)
    expect(harness.current.state.measurement).toEqual(measurement(2))
    await act(async () => harness.current.applyStyling(chosen))
    expect(requests.filter((request) => request.url.endsWith('/api/tryon'))).toHaveLength(2)

    act(() => harness.current.clearStyling())
    expect(harness.current.state.extras).toEqual({})
    expect(harness.current.state.resultImageUrl).toBe('/result-1.png')
    expect(harness.current.state.measurement).toEqual(measurement(3))
    expect(harness.current.state.renderedCm).toBe(3)
    expect(requests.filter((request) => request.url.endsWith('/api/tryon'))).toHaveLength(2)
    harness.unmount()
  })

  it('ignores an in-flight poll response after switching to the reviewed sample', async () => {
    vi.useFakeTimers()
    let resolvePoll!: (response: Response) => void
    const pendingPoll = new Promise<Response>((resolve) => { resolvePoll = resolve })
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/photo/upload')) return okJson({})
      if (url.endsWith('/api/photo')) return okJson({ photoId: 'personal-photo-hash', width: 1104, height: 1472 })
      if (url.endsWith('/api/tryon')) return okJson({ status: 'running', jobId: 'job-pending' })
      if (url.endsWith('/api/tryon/job-pending')) return pendingPoll
      throw new Error(`Unexpected request: ${url}`)
    })
    global.fetch = fetchSpy
    const harness = renderHookHarness(() => useTryOn({ product: earring }))

    await uploadPhoto(harness)
    await act(async () => harness.current.submitTryOn())
    await act(async () => { await vi.advanceTimersByTimeAsync(1800) })
    expect(fetchSpy).toHaveBeenCalledWith('/api/tryon/job-pending')

    act(() => harness.current.selectSampleFace())
    resolvePoll(okJson({ status: 'done', result: { key: 'late-result', imageUrl: '/late-result.png', measurement: null } }))
    await act(async () => {
      await pendingPoll
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(harness.current.state.resultImageUrl).toBe('/samples/single-teardrop-3cm.png')
    await act(async () => { await vi.advanceTimersByTimeAsync(3600) })
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes('/api/tryon/job-pending'))).toHaveLength(1)
    harness.unmount()
    vi.useRealTimers()
  })

  it('does not schedule another poll when an in-flight response resolves after unmount', async () => {
    vi.useFakeTimers()
    let resolvePoll!: (response: Response) => void
    const pendingPoll = new Promise<Response>((resolve) => { resolvePoll = resolve })
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/photo/upload')) return okJson({})
      if (url.endsWith('/api/photo')) return okJson({ photoId: 'personal-photo-hash', width: 1104, height: 1472 })
      if (url.endsWith('/api/tryon')) return okJson({ status: 'running', jobId: 'job-pending' })
      if (url.endsWith('/api/tryon/job-pending')) return pendingPoll
      throw new Error(`Unexpected request: ${url}`)
    })
    global.fetch = fetchSpy
    const harness = renderHookHarness(() => useTryOn({ product: earring }))

    await uploadPhoto(harness)
    await act(async () => harness.current.submitTryOn())
    await act(async () => { await vi.advanceTimersByTimeAsync(1800) })
    expect(fetchSpy).toHaveBeenCalledWith('/api/tryon/job-pending')

    harness.unmount()
    resolvePoll(okJson({ status: 'running', stepIndex: 1, totalSteps: 2 }))
    await act(async () => {
      await pendingPoll
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(3600) })
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes('/api/tryon/job-pending'))).toHaveLength(1)
    vi.useRealTimers()
  })
})
