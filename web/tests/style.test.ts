// The DOM polyfill must load before React DOM.
import './dom-polyfill'
import { createMockElement, mockDoc } from './dom-polyfill'
import React, { act } from 'react'
import ReactDOM from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CompleteTheLook, type CompleteTheLookProps } from '@/components/tryon/CompleteTheLook'
import { recommendLipstick, recommendMetal, styleFromSkin } from '@/lib/style'

// Real colour maths, no mocks. Each vector sits well inside its undertone band
// (warm: hue >= 60, cool: hue < 45, neutral: 45 to 60). Hues: 68.4, 15.1 and 56.6.
const WARM = '#C68642'
const COOL = '#E8B4B8'
const NEUTRAL = '#D1A287'

describe('style decisions', () => {
  it('pairs warm skin with gold, cool with silver and neutral with rose gold', () => {
    expect(styleFromSkin(WARM)).toMatchObject({ undertone: 'warm', metal: 'gold', metalReason: 'Warm undertone. Gold flatters you most.' })
    expect(styleFromSkin(COOL)).toMatchObject({ undertone: 'cool', metal: 'silver', metalReason: 'Cool undertone. Silver flatters you most.' })
    expect(styleFromSkin(NEUTRAL)).toMatchObject({ undertone: 'neutral', metal: 'rose gold', metalReason: 'Neutral undertone. Rose gold flatters you most.' })
  })

  it('agrees with recommendMetal for every undertone', () => {
    for (const hex of [WARM, COOL, NEUTRAL]) {
      const metal = recommendMetal(hex)
      expect(styleFromSkin(hex).metal).toBe(metal.metal)
      expect(styleFromSkin(hex).undertone).toBe(metal.undertone)
    }
  })

  it('lets a zari colour override the undertone', () => {
    expect(recommendMetal(COOL, 'gold')).toMatchObject({ metal: 'gold', undertone: 'warm', reason: 'matches the zari' })
    expect(recommendMetal(WARM, 'silver')).toMatchObject({ metal: 'silver', undertone: 'cool', reason: 'matches the zari' })
  })

  it('keeps the technical reason and label on the metal recommendation', () => {
    expect(recommendMetal(NEUTRAL)).toMatchObject({ reason: 'undertone: neutral', label: 'stylist convention' })
  })

  it('uses a neutral grey outfit by default, which takes the default lipstick rule', () => {
    const style = styleFromSkin(NEUTRAL)
    expect(style.lipstick.id).toBe(recommendLipstick(NEUTRAL, '#808080').id)
    expect(['berry', 'terracotta', 'rose']).toContain(style.lipstick.id)
    expect(Object.keys(style.lipstick).sort()).toEqual(['hex', 'id', 'name', 'texture'])
    expect(styleFromSkin(NEUTRAL, '#808080')).toEqual(style)
  })

  it('returns a lipstick from the catalogue for a red-family outfit', () => {
    // #E0115F has CIELAB hue 10.8, inside the red-family band. Pure red (hue 40) is not.
    const lipstick = recommendLipstick(NEUTRAL, '#E0115F')
    expect(lipstick.id).toBe('true-red')
    expect(lipstick.reason).toBe('red family outfit + neutral undertone')
  })
})

const owner = 'a'.repeat(64)
const other = 'd'.repeat(64)
const photo = 'b'.repeat(64)
const cacheKey = `style/${photo}.json`
const future = () => new Date(Date.now() + 3600_000).toISOString()

const state = vi.hoisted(() => ({ json: new Map<string, unknown>(), files: new Map<string, Buffer>() }))
vi.mock('@/lib/storage', () => ({
  defaultStorage: {
    getJson: async (key: string) => state.json.get(key) ?? null,
    putJson: async (key: string, value: unknown) => { state.json.set(key, value) },
    getFile: async (key: string) => state.files.get(key) ?? null,
    photoMetaPath: (id: string) => `meta/photos/${id}.json`,
    photoPath: (id: string) => `photos/${id}.png`,
  },
}))
vi.mock('@/lib/skin-tone', () => ({ estimateSkinTone: vi.fn() }))

import { estimateSkinTone } from '@/lib/skin-tone'
import { POST } from '@/app/api/style/route'

function post(body: unknown, session?: string, origin?: string) {
  return new NextRequest('http://localhost/api/style', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { cookie: `darpan_session=${session}` } : {}),
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  state.json.clear()
  state.files.clear()
  for (const id of [owner, other]) state.json.set(`sessions/${id}.json`, { expiresAt: future() })
  state.json.set(`meta/photos/${photo}.json`, { ownerId: owner, expiresAt: future() })
  state.files.set(`photos/${photo}.png`, Buffer.from('photo'))
})

describe('POST /api/style', () => {
  it('reads the skin tone from the owner photo, returns the style and caches it', async () => {
    vi.mocked(estimateSkinTone).mockResolvedValue({ hex: '#DDBCAB', coverage: 0.3, samples: 900 })

    const response = await POST(post({ photoId: photo }, owner))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(body).toEqual({ ...styleFromSkin('#DDBCAB'), source: 'estimate' })
    expect(state.json.get(cacheKey)).toEqual(body)

    const again = await POST(post({ photoId: photo }, owner))
    expect(await again.json()).toEqual(body)
    expect(estimateSkinTone).toHaveBeenCalledTimes(1)
  })

  it('answers 422 with a user message when no skin is found in the photo', async () => {
    vi.mocked(estimateSkinTone).mockResolvedValue(null)

    const response = await POST(post({ photoId: photo }, owner))

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      code: 'SKIN_NOT_FOUND',
      userMessage: 'We could not read your skin tone from this photo.',
    })
    expect(state.json.has(cacheKey)).toBe(false)
  })

  it("refuses another visitor's photo before reading any bytes", async () => {
    vi.mocked(estimateSkinTone).mockResolvedValue({ hex: '#DDBCAB', coverage: 0.3, samples: 900 })

    const response = await POST(post({ photoId: photo }, other))

    expect(response.status).toBe(404)
    expect(estimateSkinTone).not.toHaveBeenCalled()
    expect(state.json.has(cacheKey)).toBe(false)
  })

  it('requires a private session', async () => {
    const response = await POST(post({ photoId: photo }))

    expect(response.status).toBe(401)
    expect(estimateSkinTone).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests', async () => {
    const response = await POST(post({ photoId: photo }, owner, 'https://evil.example'))

    expect(response.status).toBe(403)
    expect(estimateSkinTone).not.toHaveBeenCalled()
  })

  it('rejects malformed photo identifiers', async () => {
    const response = await POST(post({ photoId: '../secrets' }, owner))

    expect(response.status).toBe(400)
    expect(estimateSkinTone).not.toHaveBeenCalled()
  })
})

// Client behaviour of the Style it panel, run on the mock DOM from tests/dom-polyfill.
// The mock has no SVG namespace, <select> options or removeAttribute, so these shims let React mount the panel.
mockDoc.createElementNS = (_namespace: string, tag: string) => mockDoc.createElement(tag)
const createMockDomElement = mockDoc.createElement
mockDoc.createElement = (tag: string) => Object.assign(createMockDomElement(tag), { options: [], removeAttribute: () => {} })

function textOf(node: any): string {
  if (typeof node.nodeValue === 'string') return node.nodeValue
  if (node.childNodes?.length) return node.childNodes.map(textOf).join('')
  return typeof node.textContent === 'string' ? node.textContent : ''
}

function mountPanel(initial: Partial<CompleteTheLookProps>) {
  const container = createMockElement('div')
  container.ownerDocument = mockDoc
  const root = ReactDOM.createRoot(container)
  const view = (props: Partial<CompleteTheLookProps>) =>
    React.createElement(CompleteTheLook, { extras: {}, isRendering: false, onApplyStyling: () => {}, ...props })
  act(() => root.render(view(initial)))
  return {
    text: () => textOf(container),
    rerender: (props: Partial<CompleteTheLookProps>) => act(() => root.render(view(props))),
    settle: () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) }),
    unmount: () => act(() => root.unmount()),
  }
}

describe('Style it panel', () => {
  const readout = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async () => readout(styleFromSkin(WARM)))
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('reads the skin tone once, when the panel opens, and preselects the suggested shade', async () => {
    const panel = mountPanel({ hidden: true, photoId: photo })
    expect(fetchMock).not.toHaveBeenCalled()

    panel.rerender({ hidden: false, photoId: photo })
    await panel.settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/style', expect.objectContaining({ method: 'POST', body: JSON.stringify({ photoId: photo }) }))
    const text = panel.text()
    expect(text).toContain('Your skin tone (estimated from your photo)')
    expect(text).toContain('Gold suits you')
    expect(text).toContain('Warm undertone. Gold flatters you most.')
    expect(text).toContain('Suggested')
    expect(text).toContain('Shade')

    panel.rerender({ hidden: true, photoId: photo })
    panel.rerender({ hidden: false, photoId: photo })
    await panel.settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    panel.unmount()
  })

  it('shows one plain line when the skin tone cannot be read, and keeps the panel usable', async () => {
    fetchMock.mockResolvedValue(readout({ code: 'SKIN_NOT_FOUND', userMessage: 'We could not read your skin tone from this photo.' }, 422))

    const panel = mountPanel({ hidden: false, photoId: photo })
    await panel.settle()

    const text = panel.text()
    expect(text).toContain('Skin tone unavailable for this photo.')
    expect(text).not.toContain('Suggested')
    expect(text).toContain('Choose style')
    expect(text).toContain('Apply styling')
    panel.unmount()
  })

  it('makes no request without a personal photo', async () => {
    const panel = mountPanel({ hidden: false, photoId: null })
    await panel.settle()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(panel.text()).toContain('Skin tone unavailable for this photo.')
    panel.unmount()
  })

  it('shows a placeholder while the read is in flight', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))

    const panel = mountPanel({ hidden: false, photoId: photo })
    await panel.settle()

    expect(panel.text()).toContain('Reading your skin tone')
    expect(panel.text()).not.toContain('Gold suits you')
    panel.unmount()
  })
})
