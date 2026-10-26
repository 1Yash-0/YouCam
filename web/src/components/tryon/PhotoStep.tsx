'use client'
import { useState } from 'react'
import { PhotoStepProps } from './types'
import { getProductCapabilities } from '@/lib/product-capabilities'
import { SAMPLE_RESULTS } from '@/lib/sample-catalogue'

export function PhotoStep({ product, onSelectSample, onUploadFile, isUploading, error }: PhotoStepProps) {
  const [validation, setValidation] = useState<string | null>(null)
  const c = product ? getProductCapabilities(product) : null
  const kind = c?.photoKind || 'portrait'
  const guidance = kind === 'hand' ? 'Photograph the back of one hand with fingers relaxed and separated. Keep your whole hand visible.' : kind === 'wrist' ? 'Photograph the top of your wrist, with the hand and some forearm visible. Remove existing jewellery.' : c?.flow === 'neck' ? 'Face the camera with your neck, collarbones and upper chest visible. Move hair away from the neckline.' : 'Use a front-facing portrait with one ear and both eyes clearly visible. Tuck your hair behind your ears.'
  async function upload(file?: File) {
    if (!file) return
    setValidation(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setValidation('Choose a JPG, PNG or WebP image.')
    if (file.size > 20 * 1024 * 1024) return setValidation('Choose an image smaller than 20 MB.')
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      await new Promise<void>((resolve,reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url })
      if (image.naturalWidth < 600 || image.naturalHeight < 600) return setValidation('Use an image at least 600 × 600 pixels.')
      let uploadFile = file
      if (file.size > 3.8 * 1024 * 1024) {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight))
        canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale)
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image preparation unavailable')
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .88))
        if (!blob || blob.size > 4 * 1024 * 1024) return setValidation('This image is too large. Please choose a smaller image.')
        uploadFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
      }
      await onUploadFile(uploadFile)
    } catch { setValidation('Could not read this image. Please try another.') }
    finally { URL.revokeObjectURL(url) }
  }
  return <section className="p-6 md:p-10 flex flex-col gap-7 overflow-y-auto">
    <div><h2 className="font-display text-3xl">Your piece, your perspective.</h2><p className="mt-3 text-[var(--ink-2)] max-w-xl">{guidance} Use even lighting and avoid filters.</p></div>
    {(!product || SAMPLE_RESULTS[product.id]) && <div className="border border-[var(--line)] p-5"><h3 className="font-display text-xl">Start with a sample</h3><p className="my-3 text-[var(--ink-2)]">Explore a saved YouCam render on our reference model. No upload or waiting.</p><button className="studio-primary" onClick={onSelectSample} disabled={isUploading}>Try a sample</button></div>}
    <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!isUploading) void upload(event.dataTransfer.files[0]) }} className="border border-dashed border-[var(--ink-2)] p-6">
      <label htmlFor="private-photo" className="font-medium block mb-3">Or use your own {kind === 'portrait' ? 'portrait' : `${kind} photo`}</label>
      <input id="private-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={isUploading} onChange={event => void upload(event.target.files?.[0])} className="block max-w-full text-sm file:mr-3 file:border-0 file:bg-[var(--ink)] file:text-[var(--paper)] file:px-4 file:py-3 file:cursor-pointer" />
      <p className="text-sm text-[var(--ink-2)] mt-3">JPG, PNG or WebP · at least 600 × 600 pixels · up to 20 MB</p>
      <p className="mt-4 text-sm text-[var(--ink-2)]">Your photo is sent to YouCam to create this preview. Darpan keeps private previews for 24 hours and removes expired files during daily cleanup. You can delete Darpan’s stored copies after processing. Use only a photo you have permission to upload. <a href="/privacy" className="underline underline-offset-4">Photo privacy</a></p>
    </div>
    {isUploading && <p role="status">Preparing your private photo…</p>}
    {(validation || error) && <p role="alert" className="text-[var(--warn)]">{validation || error}</p>}
  </section>
}
