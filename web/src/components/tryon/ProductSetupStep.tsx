'use client'
import type { Product } from '@/lib/products'
import type { TryOnState } from './types'
import { getProductCapabilities } from '@/lib/product-capabilities'

export function ProductSetupStep({ product, state, onRingSize, onFinger, onSubmit, isSubmitting }: {
  product: Product; state: TryOnState; onRingSize: (size: number, known: boolean) => void;
  onFinger: (finger: 1|2|3|4|5) => void; onSubmit: () => void; isSubmitting: boolean
}) {
  const c = getProductCapabilities(product)
  return <section className="grid md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6 p-6">
    <div className="min-h-[320px] h-[min(65vh,720px)] bg-[var(--paper)]"><img src={state.photoUrl || ''} alt={`Your uploaded ${c.photoKind} before try-on`} className="w-full h-full object-contain" /></div>
    <div className="flex flex-col justify-center gap-6"><div><h2 className="font-display text-3xl">A few details before your preview.</h2><p className="mt-3">{c.dimensionLabel}</p><p className="mt-3 text-[var(--ink-2)]">{c.assumption}</p></div>
      {product.type === 'ring' && <>
        <label className="block">Your US ring size<select className="block border border-[var(--line)] bg-transparent p-3 mt-2 w-full" value={state.ringSizeKnown ? String(state.ringSizeUs) : 'unknown'} onChange={event => onRingSize(event.target.value === 'unknown' ? 7 : Number(event.target.value), event.target.value !== 'unknown')}>
          <option value="unknown">I don’t know — preview assumes US 7</option>{Array.from({length:21},(_,i) => 3+i*.5).map(size => <option key={size} value={size}>US {size}</option>)}
        </select></label>
        <label className="block">Finger<select className="block border border-[var(--line)] bg-transparent p-3 mt-2 w-full" value={state.finger} onChange={event => onFinger(Number(event.target.value) as 1|2|3|4|5)}>{['Thumb','Index','Middle','Ring','Little'].map((name,i) => <option value={i+1} key={name}>{name}</option>)}</select></label>
      </>}
      <button className="studio-primary" onClick={onSubmit} disabled={isSubmitting}>{isSubmitting ? 'Starting preview…' : 'Create my preview'}</button>
      <p className="text-sm text-[var(--ink-2)]">AI previews show appearance and estimated proportions. They cannot establish physical fit.</p>
    </div>
  </section>
}
