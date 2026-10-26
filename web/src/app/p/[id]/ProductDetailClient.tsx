'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/products'
import { getProductCapabilities, getProductDisplayImageUrl, selectionLabel } from '@/lib/product-capabilities'
import { getProductSourceCredit, getWornImageUrl } from '@/components/home/ProductCard'
import { useCart } from '@/hooks/useCart'
import styles from './ProductDetail.module.css'

type GalleryView = 'worn' | 'cutout'

/** The gold disc is 28px; the ruler track is inset by half of that at each end. */
const DISC_PX = 28
const RING_SIZE_NOTE = 'Choose your finger and US ring size in the studio. If you’re unsure, the preview clearly assumes US 7.'

export function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter()
  const c = getProductCapabilities(product)
  const [size, setSize] = useState('heightCm' in product ? product.heightCm : 0)
  const wornImage = getWornImageUrl(product)
  const [view, setView] = useState<GalleryView>(wornImage ? 'worn' : 'cutout')
  const { addItem, openCart } = useCart()
  const cutoutImage = getProductDisplayImageUrl(product)
  const activeView: GalleryView = wornImage ? view : 'cutout'
  const hasGeneratedImage = product.source.startsWith('Generated with YouCam AI Image Generator')
  const credit = hasGeneratedImage ? '' : getProductSourceCredit(product)
  const notes = [product.type !== 'necklace' ? c.assumption : '', product.type === 'ring' ? RING_SIZE_NOTE : '']
    .filter(Boolean)
    .join(' ')

  // A size's place on the ruler: 0 at the smallest option, 1 at the largest, so the ticks keep true proportions.
  const rulerStop = (value: number) => {
    const min = Math.min(...c.sizes)
    const max = Math.max(...c.sizes)
    return max > min ? (value - min) / (max - min) : 0.5
  }
  const discStop = Math.min(1, Math.max(0, rulerStop(size)))
  const stopLeft = (value: number) => `calc(${DISC_PX / 2}px + ${rulerStop(value)} * (100% - ${DISC_PX}px))`

  const tryOn = () => router.push(`/try-on/${product.id}${c.calibration ? `?size=${size}` : ''}`)

  const saveChoice = () => {
    const label = selectionLabel(product, size)
    addItem({
      productId: product.id,
      title: product.name,
      brand: product.brand,
      productImageUrl: cutoutImage,
      priceUsd: product.priceUsd,
      sizeLabel: label,
      selectionKey: label,
    })
    openCart()
  }

  return (
    <main className={styles.page}>
      <Link href="/collection" className={`link-draw ${styles.crumb}`}>Collection</Link>

      <div className={styles.layout}>
        <section className={styles.gallery}>
          <div className={styles.frame}>
            {wornImage && (
              <img
                src={wornImage}
                alt={`${product.name} — sample preview`}
                aria-hidden={activeView !== 'worn'}
                className={`${styles.image} ${styles.worn} ${activeView === 'worn' ? styles.isActive : ''}`}
              />
            )}
            <img
              src={cutoutImage}
              alt={product.name}
              aria-hidden={activeView !== 'cutout'}
              className={`${styles.image} ${styles.cutout} ${activeView === 'cutout' ? styles.isActive : ''}`}
            />
          </div>

          {wornImage && (
            <div className={styles.views} role="group" aria-label="Product views">
              <button
                type="button"
                className={styles.thumb}
                aria-label="Sample preview"
                aria-pressed={activeView === 'worn'}
                onClick={() => setView('worn')}
              >
                <span className={styles.thumbBox}>
                  <img src={wornImage} alt="" className={`${styles.thumbImage} ${styles.thumbWorn}`} />
                </span>
                <span className={styles.thumbBar} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.thumb}
                aria-label="Product image"
                aria-pressed={activeView === 'cutout'}
                onClick={() => setView('cutout')}
              >
                <span className={styles.thumbBox}>
                  <img src={cutoutImage} alt="" className={styles.thumbImage} />
                </span>
                <span className={styles.thumbBar} aria-hidden="true" />
              </button>
              <p className={styles.caption}>{activeView === 'worn' ? 'Sample preview on a reference model.' : 'Product image.'}</p>
            </div>
          )}
        </section>

        <section className={styles.info}>
          <div>
            <p className={styles.brand}>{product.brand}</p>
            <h1 className={styles.name}>{product.name}</h1>
            <p className={styles.dimension}>{c.dimensionLabel}</p>
          </div>

          {c.calibration && (
            <fieldset className={styles.sizeField}>
              <legend className={styles.legend}>Choose a drop length</legend>
              <div className={styles.ruler}>
                <span className={styles.track} aria-hidden="true" />
                {c.sizes.map(value => (
                  <span key={value} className={styles.tick} style={{ left: stopLeft(value) }} aria-hidden="true" />
                ))}
                <span
                  className={styles.disc}
                  aria-hidden="true"
                  style={{ transform: `translateX(calc(${discStop} * (100cqw - ${DISC_PX}px)))` }}
                />
              </div>
              <ul className={styles.labels}>
                {c.sizes.map(value => (
                  <li key={value} className={styles.labelItem} style={{ left: stopLeft(value) }}>
                    <button type="button" className={styles.sizeButton} aria-pressed={size === value} onClick={() => setSize(value)}>{value} cm</button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          <div className={styles.actions}>
            {c.supported ? (
              <button type="button" className={styles.tryOn} onClick={tryOn}>Try it on</button>
            ) : (
              <Link href="/collection" className={styles.tryOn}>Browse jewellery</Link>
            )}
            <button type="button" className={`link-draw ${styles.save}`} onClick={saveChoice}>Save</button>
          </div>

          {notes && <p className={styles.note}>{notes}</p>}

          <details className={styles.details}>
            <summary className={`link-draw ${styles.summary}`}>Details and credits</summary>
            <div className={styles.detailsBody}>
              <p>Demonstration catalogue · ${product.priceUsd.toFixed(0)} illustrative price. These reference pieces are not offered for sale here.</p>
              {credit && <p>{credit}</p>}
              {!hasGeneratedImage && !credit.includes(product.licence) && <p>{product.licence}</p>}
            </div>
          </details>

          <Link href="/how-it-works" className={`link-draw ${styles.howLink}`}>How sizing estimates work</Link>
        </section>
      </div>
    </main>
  )
}
