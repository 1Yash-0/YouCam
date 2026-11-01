'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PillButton } from '@/components/PillButton'
import { formatPrice } from '@/lib/format'
import { useToast } from '@/components/Toast'

interface RecommendedProduct {
  id: string
  name: string
  brand: string
  type: string
  priceUsd: number
  imagePath: string
  metal?: string
  heightCm?: number
  lengthCm?: number
  caseMm?: number
  diameterMm?: number
  tryOnUrl: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  products?: RecommendedProduct[]
  detectedSkin?: {
    hex: string
    undertone: 'warm' | 'cool' | 'neutral'
    metal: 'gold' | 'silver' | 'rose gold'
    metalReason: string
    lipstick: { id: string; name: string; hex: string; texture: string }
  } | null
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    content: `### Welcome to the Darpan AI Jewellery Concierge ✦
I am your personal fine jewellery sizing and styling assistant. Unlike conventional shopping chatbots, I evaluate **physical scale, facial geometry, and biological measurements** (such as our 11.7 mm iris reference).

You can:
- **Upload your photo** or **use our calibrated model** to analyze your skin undertones and face shape.
- Ask about earring drop lengths, necklace chains, or vintage watch case sizing.
- Inquire about styling jewellery with specific fabrics or wedding attire.

How can I help you discover your perfect piece today?`,
  },
]

const QUICK_PROMPTS = [
  'What earrings flatter my face and skin tone?',
  'Recommend a 3 cm vs 6 cm drop earring for a celebration',
  'Which vintage watch fits a slender 60 mm wrist?',
  'Show me gold jewellery and a matching lipstick shade',
  'How does true-size scaling work with the 11.7 mm iris?',
]

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  const formatInline = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/5 font-mono text-xs text-[var(--gold)]">$1</code>')
  }

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key} className="space-y-1 my-2 pl-4 list-disc text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      )
      listItems = []
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2))
    } else {
      flushList(`list-${index}`)
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-base font-serif font-semibold text-[var(--gold)] mt-3 mb-1">
            {trimmed.slice(4)}
          </h3>
        )
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-lg font-serif font-semibold text-[var(--ink)] mt-3 mb-1">
            {trimmed.slice(3)}
          </h2>
        )
      } else if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote
            key={index}
            className="border-l-2 border-[var(--gold)] pl-3 my-2 text-sm text-[var(--ink)] bg-black/2 py-1 rounded-r"
            dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }}
          />
        )
      } else if (trimmed.length > 0) {
        elements.push(
          <p
            key={index}
            className="text-sm leading-relaxed my-1.5"
            dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
          />
        )
      }
    }
  })

  flushList(`list-final`)

  return <div className="space-y-1">{elements}</div>
}

export function AssistantClient() {
  const { showToast } = useToast()
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [followUps, setFollowUps] = useState<string[]>(QUICK_PROMPTS)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSampleActive, setIsSampleActive] = useState(false)
  const [detectedSkin, setDetectedSkin] = useState<{
    hex: string
    undertone: string
    metal: string
    lipstickName: string
    lipstickHex: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleUseSample = () => {
    setIsSampleActive(true)
    setPhotoPreview('/sample-face.png')
    setDetectedSkin({
      hex: '#E8B896',
      undertone: 'Warm (Peach)',
      metal: 'Gold',
      lipstickName: 'Ruby Satin',
      lipstickHex: '#B22222',
    })
    showToast({ message: 'Loaded pre-calibrated sample model.', variant: 'gold' })

    // Automatically prompt assistant with sample face
    sendMessage(
      'I have selected the calibrated sample model. What jewellery and lipstick harmonizes with my warm undertones?',
      { isSample: true }
    )
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      showToast({ message: 'Please upload a photo under 5 MB.', variant: 'warn' })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setPhotoPreview(base64)
      setIsSampleActive(false)
      showToast({ message: 'Photo uploaded! Analyzing complexion…', variant: 'default' })

      sendMessage('I have uploaded my photo. Please analyze my skin undertone and recommend earrings that fit my proportions.', {
        photoBase64: base64,
      })
    }
    reader.readAsDataURL(file)
  }

  const sendMessage = async (
    textToSend?: string,
    options?: { photoBase64?: string; isSample?: boolean }
  ) => {
    const content = textToSend || inputText.trim()
    if (!content && !options?.photoBase64 && !options?.isSample) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    if (!textToSend) setInputText('')
    setLoading(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          photoBase64: options?.photoBase64 || (photoPreview?.startsWith('data:') ? photoPreview : undefined),
          isSampleFace: options?.isSample ?? isSampleActive,
        }),
      })

      if (!response.ok) {
        throw new Error(`Assistant responded with ${response.status}`)
      }

      const data = await response.json()

      if (data.detectedSkin) {
        setDetectedSkin({
          hex: data.detectedSkin.hex,
          undertone: data.detectedSkin.undertone,
          metal: data.detectedSkin.metal,
          lipstickName: data.detectedSkin.lipstick.name,
          lipstickHex: data.detectedSkin.lipstick.hex,
        })
      }

      if (data.followUpSuggestions && Array.isArray(data.followUpSuggestions) && data.followUpSuggestions.length > 0) {
        setFollowUps(data.followUpSuggestions)
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        products: data.products,
        detectedSkin: data.detectedSkin,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('Error communicating with assistant:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          content:
            "I encountered a momentary connection issue. Please verify your query or try asking about specific pieces such as 'Gilded Teardrop' or 'vintage watches'.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
      {/* Left Column: Photo Calibration & Skin Diagnostics Card */}
      <aside className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-6 space-y-6 lg:sticky lg:top-24">
        <div>
          <h2 className="font-display text-2xl text-[var(--ink)]">Your Mirror Profile</h2>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Upload a photo or use our calibrated reference to personalize sizing and metal matching.
          </p>
        </div>

        {/* Photo View / Upload Area */}
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg)] flex flex-col items-center justify-center p-4 text-center">
          {photoPreview ? (
            <div className="relative h-full w-full">
              <Image
                src={photoPreview}
                alt="Shopper try-on photo"
                fill
                className="object-cover rounded-sm"
                unoptimized={photoPreview.startsWith('data:')}
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoPreview(null)
                  setIsSampleActive(false)
                  setDetectedSkin(null)
                }}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 text-xs"
                title="Remove photo"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full border border-dashed border-[var(--gold)] flex items-center justify-center text-[var(--gold)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 4v16m-8-8h16" />
                </svg>
              </div>
              <p className="text-xs text-[var(--ink-2)]">No photo loaded yet</p>
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-11 bg-[var(--ink)] text-[var(--paper)] text-sm rounded-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload your photo
          </button>
          <button
            type="button"
            onClick={handleUseSample}
            className="w-full h-11 border border-[var(--line)] text-[var(--ink)] text-sm rounded-sm hover:bg-black/5 transition-colors"
          >
            Use Calibrated Sample Model
          </button>
        </div>

        {/* Live Detected Undertone Diagnostics */}
        {detectedSkin && (
          <div className="pt-4 border-t border-[var(--line)] space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--gold)]">
              Calibrated Complexion
            </span>
            <div className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-full border border-black/10 shadow-sm shrink-0"
                style={{ backgroundColor: detectedSkin.hex }}
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)] capitalize">
                  {detectedSkin.undertone} Undertone
                </p>
                <p className="text-xs text-[var(--ink-2)] font-mono">{detectedSkin.hex}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-[var(--bg)] p-2 rounded-sm border border-[var(--line)]">
                <span className="text-[var(--ink-2)] block">Best Metal:</span>
                <span className="font-medium text-[var(--ink)] capitalize">{detectedSkin.metal}</span>
              </div>
              <div className="bg-[var(--bg)] p-2 rounded-sm border border-[var(--line)]">
                <span className="text-[var(--ink-2)] block">Lip Shade:</span>
                <span className="font-medium text-[var(--ink)] truncate block">{detectedSkin.lipstickName}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Right Column: Interactive Chat Stream */}
      <section className="flex flex-col min-h-[640px] rounded-lg border border-[var(--line)] bg-[var(--paper)]">
        {/* Stream Messages Area */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-5 text-[15px] leading-relaxed shadow-xs ${
                  msg.role === 'user'
                    ? 'bg-[var(--ink)] text-[var(--paper)]'
                    : 'bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                {/* Markdown text rendered cleanly */}
                {msg.role === 'assistant' ? (
                  <FormattedMessage content={msg.content} />
                ) : (
                  <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                )}

                {/* Interactive Product Cards embedded inside the response */}
                {msg.products && msg.products.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[var(--line)]">
                    <p className="text-xs font-mono uppercase tracking-wider text-[var(--gold)] mb-3">
                      Calibrated Recommendations
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {msg.products.map((p) => {
                        const dimensionLabel =
                          p.heightCm
                            ? `${p.heightCm} cm drop`
                            : p.lengthCm
                            ? `${p.lengthCm} cm chain`
                            : p.caseMm
                            ? `${p.caseMm} mm case`
                            : p.diameterMm
                            ? `${p.diameterMm} mm size`
                            : ''

                        return (
                          <div
                            key={p.id}
                            className="flex flex-col justify-between p-3 rounded-md bg-[var(--paper)] border border-[var(--line)] hover:border-[var(--gold)] transition-colors shadow-2xs"
                          >
                            <div className="flex gap-3">
                              <div className="relative w-16 h-16 rounded-sm bg-neutral-100 overflow-hidden shrink-0 border border-black/5">
                                <Image
                                  src={p.imagePath}
                                  alt={p.name}
                                  fill
                                  className="object-contain p-1"
                                />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-medium text-sm text-[var(--ink)] truncate">{p.name}</h4>
                                <p className="text-xs text-[var(--ink-2)] truncate">{p.brand}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-mono text-[var(--gold)] font-medium">
                                    {dimensionLabel}
                                  </span>
                                  <span className="text-xs font-medium text-[var(--ink)]">
                                    {formatPrice(p.priceUsd)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Link
                              href={p.tryOnUrl}
                              className="mt-3 w-full h-8 text-xs font-medium bg-[var(--ink)] text-[var(--paper)] rounded-sm hover:bg-[var(--gold)] transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span>Try On at True Scale</span>
                              <span>→</span>
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-sm text-[var(--ink-2)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] animate-ping" />
              <span>Analyzing proportions and consulting true-scale database…</span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-6 py-3 border-t border-[var(--line)] bg-black/2 flex flex-wrap gap-2">
          {followUps.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={loading}
              onClick={() => sendMessage(prompt)}
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--gold)] transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[var(--line)] flex gap-2">
          <input
            type="text"
            value={inputText}
            disabled={loading}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Ask about earrings, necklace drop, wrist fit, or style advice…"
            className="flex-1 px-4 py-2.5 text-sm bg-[var(--bg)] border border-[var(--line)] rounded-md text-[var(--ink)] focus:outline-2 focus:outline-[var(--gold)]"
          />
          <button
            type="button"
            disabled={loading || !inputText.trim()}
            onClick={() => sendMessage()}
            className="px-6 py-2.5 bg-[var(--ink)] text-[var(--paper)] text-sm rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Send
          </button>
        </div>
      </section>
    </div>
  )
}
