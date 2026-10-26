/** Reviewed, pre-rendered YouCam examples shipped with the application. Never generates a task. */
export const SAMPLE_RESULTS: Record<string, { imageUrl: string; photoUrl?: string; sizeCm?: number; variants?: Array<{ sizeCm: number; imageUrl: string }> }> = {
  'gilded-teardrop': { imageUrl: '/samples/single-teardrop-3cm.png', photoUrl: '/sample-face.png', sizeCm: 3,
    variants: [{ sizeCm: 3, imageUrl: '/samples/single-teardrop-3cm.png' }, { sizeCm: 6, imageUrl: '/samples/earring-6cm.png' }] },
  'dot-stud': { imageUrl: '/samples/dot-stud-0.6cm.png', photoUrl: '/sample-face.png', sizeCm: 0.6 },
  'met-gold-earring': { imageUrl: '/products/worn/met-gold-earring.jpg', photoUrl: '/sample-face.png', sizeCm: 6 },
  'met-gold-pendant': { imageUrl: '/products/worn/met-gold-pendant-upright.jpg', photoUrl: '/sample-face.png', sizeCm: 4 },
  'orb-chain': { imageUrl: '/samples/necklace.png', photoUrl: '/samples/neck-face.png' },
  'atlantic-classic': { imageUrl: '/products/worn/atlantic-classic.jpg', photoUrl: '/samples/wrist.png' },
  'marshal-petite': { imageUrl: '/products/worn/marshal-petite.jpg', photoUrl: '/samples/wrist.png' },
  'met-snake-bracelet': { imageUrl: '/products/worn/met-snake-bracelet.jpg', photoUrl: '/samples/wrist.png' },
  'met-carnelian-bracelet': { imageUrl: '/products/worn/met-carnelian-bracelet.jpg', photoUrl: '/samples/wrist.png' },
  'met-open-cuff': { imageUrl: '/products/worn/met-open-cuff.jpg', photoUrl: '/samples/wrist.png' },
  'met-bead-ring': { imageUrl: '/products/worn/met-bead-ring.jpg', photoUrl: '/samples/hand.png' },
  'met-carnelian-ring': { imageUrl: '/products/worn/met-carnelian-ring.jpg', photoUrl: '/samples/hand.png' },
  'met-plasma-ring': { imageUrl: '/products/worn/met-plasma-ring.jpg', photoUrl: '/samples/hand.png' },
}
