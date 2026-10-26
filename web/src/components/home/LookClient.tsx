'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiClient, SampleLook } from '@/lib/api-client'
import { Skeleton } from '@/components/Skeleton'

export interface LookClientProps {
  limit?: number
  className?: string
}

export const LOOK_CAPTIONS: Record<string, string> = {
  'single-teardrop-3cm': 'Gilded Teardrop, 3 cm',
  'earring-6cm': 'Gilded Teardrop, 6 cm',
  'lipstick-earring-chain': 'Teardrop with red lipstick',
  'stud-drop-stack': 'Stud and drop stack',
  'hair-braids-earring': 'Teardrop with braids',
  necklace: 'Orb Chain necklace',
  outfit: 'Teardrop with a new outfit',
}

export function getLookCaption(look: SampleLook): string {
  return LOOK_CAPTIONS[look.id] ?? look.title
}

export function LookClient({ limit, className = '' }: LookClientProps) {
  const [looks, setLooks] = useState<SampleLook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    apiClient
      .getSamples()
      .then((samples) => {
        if (mounted) setLooks(samples)
      })
      .catch(() => {
        if (mounted) setError(true)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const visibleLooks = limit ? looks.slice(0, limit) : looks

  if (loading) {
    return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`} aria-label="Loading sample looks">
        {Array.from({ length: limit ?? 3 }, (_, index) => (
          <Skeleton key={index} className="aspect-[4/5] bg-[var(--paper)]" />
        ))}
      </div>
    )
  }

  if (error || visibleLooks.length === 0) {
    return (
      <p role="status" className={`py-8 text-base text-[var(--ink-2)] ${className}`}>
        Sample looks are unavailable right now.
      </p>
    )
  }

  return (
      <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {visibleLooks.map((look) => (
        <Link
          key={look.id}
          href={`/look/${look.id}`}
          className="group block focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-4"
        >
          <figure>
            <div className="relative aspect-[4/5] overflow-hidden bg-[var(--bg)]">
              <Image
                src={look.imageUrl}
                alt={`${look.title} result`}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover bg-[var(--paper)] transition-transform duration-500 ease-[var(--ease)] group-hover:scale-[1.02]"
              />
            </div>
            <figcaption className="mt-3 px-4 sm:px-6 lg:px-8 truncate whitespace-nowrap text-base leading-6 text-[var(--ink)] group-hover:text-[var(--gold)]">
              {getLookCaption(look)}
            </figcaption>
          </figure>
        </Link>
      ))}
    </div>
  )
}
