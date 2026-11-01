import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { youcam } from '@/lib/youcam'
import { env } from '@/lib/env'
import { defaultStorage as storage } from '@/lib/storage'
import { SAMPLE_RESULTS } from '@/lib/sample-catalogue'

export const runtime = 'nodejs'
export const maxDuration = 60

export interface StyleApplyRequest {
  productId: string
  photoId?: string | null
  baseImageUrl?: string
  extras: {
    lipstick?: {
      id?: string
      name?: string
      hex: string
      texture?: 'matte' | 'satin' | 'gloss' | 'shimmer'
      intensity?: number
    }
    hairUp?: {
      templateId: string
      title: string
    }
    outfit?: {
      productId: string
    }
    stack?: any[]
  }
}

const styleResultCache = new Map<string, string>()
let sampleFileIdCache: { earring?: string; necklace?: string } = {}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StyleApplyRequest
    const { productId, photoId, baseImageUrl, extras } = body

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const publicDir = path.join(process.cwd(), 'public')
    const isNecklace = productId === 'orb-chain' || (baseImageUrl && baseImageUrl.includes('neck'))

    // Check in-memory result cache
    const cacheKey = `${productId}-${extras.hairUp?.templateId || 'none'}-${extras.lipstick?.hex || 'none'}-${extras.lipstick?.texture || 'none'}-${extras.lipstick?.intensity ?? 80}`
    if (styleResultCache.has(cacheKey)) {
      return NextResponse.json({
        status: 'done',
        imageUrl: styleResultCache.get(cacheKey)!,
        engine: 'youcam-live-api',
        extras,
      })
    }

    // 1. Check if real YouCam API should be invoked
    const hasLiveYouCamKey = Boolean(
      env.YOUCAM_API_KEY &&
      env.YOUCAM_API_KEY !== 'your_api_key_here' &&
      env.YOUCAM_API_KEY.trim().length > 10
    )

    if (hasLiveYouCamKey && (extras.hairUp?.templateId || extras.lipstick?.hex)) {
      try {
        let currentFileId: string | undefined
        let finalResultUrl: string | undefined

        if (photoId && photoId !== 'sample') {
          const photoMeta = await storage.getJson<any>(storage.photoMetaPath(photoId))
          if (photoMeta?.fileId) {
            currentFileId = photoMeta.fileId
          } else {
            const photoBuf = await storage.getFile(storage.photoPath(photoId))
            if (photoBuf) {
              currentFileId = await youcam.uploadFile(photoBuf, 'image/png', 'user_photo.png')
            }
          }
        } else {
          // For sample models, load sample image and upload to YouCam
          const cacheSlot = isNecklace ? 'necklace' : 'earring'
          if (sampleFileIdCache[cacheSlot]) {
            currentFileId = sampleFileIdCache[cacheSlot]
          } else {
            const sampleFilename = isNecklace ? 'necklace.png' : 'single-teardrop-3cm.png'
            const samplePath = path.join(publicDir, 'samples', sampleFilename)
            if (fs.existsSync(samplePath)) {
              const sampleBuf = fs.readFileSync(samplePath)
              currentFileId = await youcam.uploadFile(sampleBuf, 'image/png', sampleFilename)
              sampleFileIdCache[cacheSlot] = currentFileId
            }
          }
        }

        if (currentFileId) {
          // Hair Transfer task if hairUp requested
          if (extras.hairUp?.templateId) {
            try {
              const rawTemplate = extras.hairUp.templateId
              const youcamTemplateId =
                rawTemplate === 'crown-braids' ? 'female_two_braids' :
                (rawTemplate === 'high-bun' || rawTemplate === 'chignon-updo' || rawTemplate === 'french-twist') ? 'female_messy_bun_brown' :
                rawTemplate

              const hairTaskId = await youcam.createHairTask({
                src: { fileId: currentFileId },
                templateId: youcamTemplateId,
                keepUserColour: true,
              })
              for (let i = 0; i < 15; i++) {
                await new Promise((r) => setTimeout(r, 1000))
                const task = await youcam.getTask('hair-transfer', hairTaskId)
                if (task.status === 'success' && task.resultUrl) {
                  finalResultUrl = task.resultUrl
                  break
                }
                if (task.status === 'error') break
              }
            } catch (hairErr) {
              console.warn('YouCam hair-transfer task error:', hairErr)
            }
          }

          // Makeup VTO task if lipstick requested
          if (extras.lipstick?.hex) {
            try {
              const makeupTaskId = await youcam.createMakeupTask({
                src: finalResultUrl ? { url: finalResultUrl } : { fileId: currentFileId },
                lip: {
                  hex: extras.lipstick.hex,
                  texture: extras.lipstick.texture || 'satin',
                  intensity: extras.lipstick.intensity ?? 80,
                },
              })
              for (let i = 0; i < 15; i++) {
                await new Promise((r) => setTimeout(r, 1000))
                const task = await youcam.getTask('makeup-vto', makeupTaskId)
                if (task.status === 'success' && task.resultUrl) {
                  finalResultUrl = task.resultUrl
                  break
                }
                if (task.status === 'error') break
              }
            } catch (makeupErr) {
              console.warn('YouCam makeup-vto task error:', makeupErr)
            }
          }

          if (finalResultUrl) {
            styleResultCache.set(cacheKey, finalResultUrl)
            return NextResponse.json({
              status: 'done',
              imageUrl: finalResultUrl,
              engine: 'youcam-live-api',
              extras,
            })
          }
        }
      } catch (err) {
        console.warn('YouCam API call failed, falling back to dynamic visual synthesis:', err)
      }
    }

    // 2. Dynamic high-fidelity visual compositing via sharp
    // Choose the base buffer depending on product and hairstyle
    let baseBuffer: Buffer | null = null
    const hairTemplate = extras.hairUp?.templateId || ''

    if (!isNecklace) {
      // Earring model
      if (hairTemplate === 'female_two_braids' || hairTemplate === 'crown-braids') {
        const braidsPath = path.join(publicDir, 'samples/hair-braids-earring.png')
        if (fs.existsSync(braidsPath)) baseBuffer = fs.readFileSync(braidsPath)
      } else {
        const updoPath = path.join(publicDir, 'samples/single-teardrop-3cm.png')
        if (fs.existsSync(updoPath)) baseBuffer = fs.readFileSync(updoPath)
      }
    } else {
      // Necklace model
      const necklacePath = path.join(publicDir, 'samples/necklace.png')
      if (fs.existsSync(necklacePath)) baseBuffer = fs.readFileSync(necklacePath)
    }

    if (!baseBuffer && baseImageUrl && baseImageUrl.startsWith('/')) {
      const localPath = path.join(publicDir, baseImageUrl.replace(/^\//, ''))
      if (fs.existsSync(localPath)) baseBuffer = fs.readFileSync(localPath)
    }

    if (!baseBuffer && photoId && photoId !== 'sample') {
      const stored = await storage.getFile(storage.photoPath(photoId))
      if (stored) baseBuffer = stored
    }

    if (!baseBuffer) {
      baseBuffer = fs.readFileSync(path.join(publicDir, 'samples/single-teardrop-3cm.png'))
    }

    const baseMeta = await sharp(baseBuffer).metadata()
    const width = baseMeta.width || 1104
    const height = baseMeta.height || 1472

    const compositeLayers: sharp.OverlayOptions[] = []

    // A. Hairstyle styling overlays
    if (isNecklace && extras.hairUp) {
      // For the frontal necklace model, render the hairstyle overlay strictly on the hair crown (y < 250)
      if (hairTemplate === 'crown-braids') {
        const braidOverlaySvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="hairDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1B1C20" stop-opacity="0.95" />
              <stop offset="50%" stop-color="#2D2B30" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#18181C" stop-opacity="0.95" />
            </linearGradient>
            <pattern id="braidWeave" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M0 12 Q6 0 12 12 Q18 24 24 12" stroke="#48444A" stroke-width="2.5" fill="none" opacity="0.65" />
              <path d="M0 12 Q6 24 12 12 Q18 0 24 12" stroke="#121215" stroke-width="2" fill="none" opacity="0.75" />
            </pattern>
          </defs>
          <!-- Braided crown headband across the top of hair -->
          <path d="M410 180 Q535 130 660 180 Q640 205 535 160 Q430 205 410 180 Z" fill="url(#hairDark)" />
          <path d="M410 180 Q535 130 660 180 Q640 205 535 160 Q430 205 410 180 Z" fill="url(#braidWeave)" />
        </svg>`
        compositeLayers.push({ input: Buffer.from(braidOverlaySvg), blend: 'over' })
      } else if (hairTemplate === 'high-bun') {
        const bunSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="bunGrad" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stop-color="#2C2A30" stop-opacity="0.98" />
              <stop offset="70%" stop-color="#1A191C" stop-opacity="0.98" />
              <stop offset="100%" stop-color="#101012" stop-opacity="0.9" />
            </radialGradient>
          </defs>
          <ellipse cx="535" cy="115" rx="75" ry="50" fill="url(#bunGrad)" />
          <path d="M470 125 Q535 90 600 125" stroke="#3A3840" stroke-width="2" fill="none" opacity="0.5" />
        </svg>`
        compositeLayers.push({ input: Buffer.from(bunSvg), blend: 'over' })
      } else if (hairTemplate === 'french-twist' || hairTemplate === 'chignon-updo') {
        const updoSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="updoGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#28262C" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#121214" stop-opacity="0.75" />
            </radialGradient>
          </defs>
          <path d="M430 190 Q535 145 640 190 Q620 220 535 175 Q450 220 430 190 Z" fill="url(#updoGrad)" />
        </svg>`
        compositeLayers.push({ input: Buffer.from(updoSvg), blend: 'over' })
      }
    } else if (!isNecklace && extras.hairUp) {
      // For the 3/4 earring model
      if (hairTemplate === 'high-bun') {
        const bunSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="earBunGrad" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stop-color="#2C2A30" stop-opacity="0.98" />
              <stop offset="70%" stop-color="#1A191C" stop-opacity="0.98" />
              <stop offset="100%" stop-color="#101012" stop-opacity="0.9" />
            </radialGradient>
          </defs>
          <ellipse cx="610" cy="140" rx="80" ry="55" fill="url(#earBunGrad)" />
          <path d="M545 150 Q610 110 675 150" stroke="#3A3840" stroke-width="2" fill="none" opacity="0.5" />
        </svg>`
        compositeLayers.push({ input: Buffer.from(bunSvg), blend: 'over' })
      } else if (hairTemplate === 'french-twist') {
        const twistSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="twistGrad" cx="45%" cy="45%" r="50%">
              <stop offset="0%" stop-color="#28262C" stop-opacity="0.95" />
              <stop offset="100%" stop-color="#121214" stop-opacity="0.8" />
            </radialGradient>
          </defs>
          <ellipse cx="580" cy="190" rx="95" ry="60" fill="url(#twistGrad)" />
        </svg>`
        compositeLayers.push({ input: Buffer.from(twistSvg), blend: 'over' })
      }
    }

    // B. Lipstick transformation layer (exact custom hex & intensity & texture)
    if (extras.lipstick?.hex) {
      const rawHex = extras.lipstick.hex
      const hex = /^#[0-9a-f]{6}$/i.test(rawHex) ? rawHex : '#9B1B30'
      const intensity = Math.min(Math.max(extras.lipstick.intensity ?? 80, 10), 100)
      const opacity = (intensity / 100) * 0.84
      const texture = extras.lipstick.texture || 'satin'

      // Calibrated coordinates per model covering both upper and lower lip
      const cx = isNecklace ? 538 : 735
      const cyUpper = isNecklace ? 633 : 744
      const cyLower = isNecklace ? 643 : 759
      const rx = isNecklace ? 58 : 66
      const ryUpper = isNecklace ? 13 : 15
      const ryLower = isNecklace ? 15 : 18

      const glossHighlight = texture === 'gloss' || texture === 'shimmer'
        ? `<ellipse cx="${cx + 6}" cy="${cyUpper - 2}" rx="${Math.round(rx * 0.35)}" ry="${Math.round(ryUpper * 0.4)}" fill="#FFFFFF" fill-opacity="${texture === 'gloss' ? '0.35' : '0.2'}" />`
        : ''

      const shimmerFilter = texture === 'shimmer'
        ? `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="noise" /><feBlend in="SourceGraphic" in2="noise" mode="screen" />`
        : ''

      const svgOverlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="darpanLipGradUpper" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${hex}" stop-opacity="${opacity.toFixed(2)}" />
            <stop offset="70%" stop-color="${hex}" stop-opacity="${(opacity * 0.8).toFixed(2)}" />
            <stop offset="95%" stop-color="${hex}" stop-opacity="${(opacity * 0.25).toFixed(2)}" />
            <stop offset="100%" stop-color="${hex}" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="darpanLipGradLower" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${hex}" stop-opacity="${opacity.toFixed(2)}" />
            <stop offset="65%" stop-color="${hex}" stop-opacity="${(opacity * 0.82).toFixed(2)}" />
            <stop offset="95%" stop-color="${hex}" stop-opacity="${(opacity * 0.25).toFixed(2)}" />
            <stop offset="100%" stop-color="${hex}" stop-opacity="0" />
          </radialGradient>
          ${shimmerFilter ? `<filter id="shimmer">${shimmerFilter}</filter>` : ''}
        </defs>
        <ellipse cx="${cx}" cy="${cyUpper}" rx="${rx}" ry="${ryUpper}" fill="url(#darpanLipGradUpper)" ${shimmerFilter ? 'filter="url(#shimmer)"' : ''} />
        <ellipse cx="${cx}" cy="${cyLower}" rx="${Math.round(rx * 0.94)}" ry="${ryLower}" fill="url(#darpanLipGradLower)" ${shimmerFilter ? 'filter="url(#shimmer)"' : ''} />
        ${glossHighlight}
      </svg>`

      compositeLayers.push({
        input: Buffer.from(svgOverlay),
        blend: 'over',
      })
    }

    // C. Earring stack layer if applicable
    if (!isNecklace && extras.stack?.length && (productId === 'gilded-teardrop' || productId === 'dot-stud')) {
      const stackPath = path.join(publicDir, 'samples/stud-drop-stack.png')
      if (fs.existsSync(stackPath)) {
        const stackCrop = await sharp(stackPath)
          .extract({ left: 240, top: 520, width: 220, height: 460 })
          .resize(Math.round(220 * (width / 1104)), Math.round(460 * (height / 1472)))
          .png()
          .toBuffer()

        compositeLayers.push({
          input: stackCrop,
          top: Math.round(520 * (height / 1472)),
          left: Math.round(240 * (width / 1104)),
          blend: 'over',
        })
      }
    }

    let result = sharp(baseBuffer)
    if (compositeLayers.length > 0) {
      result = result.composite(compositeLayers)
    }

    const outputBuffer = await result.png({ quality: 95 }).toBuffer()
    const base64Url = `data:image/png;base64,${outputBuffer.toString('base64')}`

    return NextResponse.json({
      status: 'done',
      imageUrl: base64Url,
      engine: 'dynamic-vto-compositor',
      extras,
    })
  } catch (error: any) {
    console.error('Error applying styling in /api/style/apply:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to apply styling' },
      { status: 500 }
    )
  }
}
