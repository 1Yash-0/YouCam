import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function prepareHeroAssets() {
  const rootDir = path.resolve(__dirname, '..')
  const heroDir = path.join(rootDir, 'public', 'hero')
  await fs.mkdir(heroDir, { recursive: true })

  const facePath = path.join(rootDir, 'public', 'sample-face.png')
  const earringPath = path.join(rootDir, 'public', 'products', 'teardrop-gold.png')
  const source3cm = path.resolve(rootDir, '..', 'outputs', 'b0', 'b_earring_3cm_attempt1.png')
  const source6cm = path.resolve(rootDir, '..', 'outputs', 'b0', 'b_earring_6cm_attempt3.png')

  console.log('Generating hero frames...')

  // 1. Frame 3.0cm
  await sharp(source3cm).webp({ quality: 90 }).toFile(path.join(heroDir, 'size-3.webp'))
  await sharp(source3cm).png().toFile(path.join(heroDir, 'size-3.png'))

  // 2. Frame 6.0cm
  await sharp(source6cm).webp({ quality: 90 }).toFile(path.join(heroDir, 'size-6.webp'))
  await sharp(source6cm).png().toFile(path.join(heroDir, 'size-6.png'))

  // 3. Frame 2.0cm (box: x: 364, y: 656, w: 28, h: 68)
  const earring2cm = await sharp(earringPath)
    .resize(28, 68, { fit: 'fill' })
    .toBuffer()

  await sharp(facePath)
    .composite([{ input: earring2cm, left: 364, top: 656 }])
    .webp({ quality: 90 })
    .toFile(path.join(heroDir, 'size-2.webp'))

  await sharp(facePath)
    .composite([{ input: earring2cm, left: 364, top: 656 }])
    .png()
    .toFile(path.join(heroDir, 'size-2.png'))

  // 4. Frame 4.5cm (box: x: 347, y: 656, w: 63, h: 153)
  const earring4_5cm = await sharp(earringPath)
    .resize(63, 153, { fit: 'fill' })
    .toBuffer()

  await sharp(facePath)
    .composite([{ input: earring4_5cm, left: 347, top: 656 }])
    .webp({ quality: 90 })
    .toFile(path.join(heroDir, 'size-4_5.webp'))

  await sharp(facePath)
    .composite([{ input: earring4_5cm, left: 347, top: 656 }])
    .png()
    .toFile(path.join(heroDir, 'size-4_5.png'))

  // 5. Poster image
  await sharp(source3cm)
    .modulate({ brightness: 0.9 })
    .jpeg({ quality: 85 })
    .toFile(path.join(heroDir, 'poster.jpg'))

  // 6. Metadata JSONs
  const metadata = [
    { sizeCm: 2.0, imageUrl: '/hero/size-2.webp', box: { x: 364, y: 656, w: 28, h: 68 } },
    { sizeCm: 3.0, imageUrl: '/hero/size-3.webp', box: { x: 357, y: 656, w: 42, h: 102 } },
    { sizeCm: 4.5, imageUrl: '/hero/size-4_5.webp', box: { x: 347, y: 656, w: 63, h: 153 } },
    { sizeCm: 6.0, imageUrl: '/hero/size-6.webp', box: { x: 336, y: 656, w: 84, h: 205 } },
  ]

  for (const meta of metadata) {
    const key = meta.sizeCm === 4.5 ? '4_5' : meta.sizeCm.toString()
    await fs.writeFile(
      path.join(heroDir, `size-${key}.json`),
      JSON.stringify(meta, null, 2)
    )
  }

  console.log('Hero assets generated successfully in public/hero!')
}

prepareHeroAssets().catch((err) => {
  console.error('Error preparing hero assets:', err)
  process.exit(1)
})
