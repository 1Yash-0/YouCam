import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function buildSample() {
  try {
    const dataDir = path.resolve(__dirname, '..', '..', '.data')
    const sampleDir = path.join(dataDir, 'sample')
    
    // Create sample directory if it doesn't exist
    await fs.mkdir(sampleDir, { recursive: true })
    
    // Sample data configuration
    const samples = [
      {
        id: 'single-teardrop-3cm',
        title: 'Single Teardrop (3 cm)',
        flow: 'single-earring',
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
        steps: ['upload', 'detect', 'tryon'],
        imagePath: 'smoke_3cm.png',
        sourcePath: path.resolve(__dirname, '..', '..', 'outputs', 'b1', 'smoke_3cm.png'),
      },
      {
        id: 'earring-6cm',
        title: 'Gold and Glass Earring (6 cm)',
        flow: 'single-earring',
        productId: 'met-gold-earring',
        sizeCm: 6.0,
        steps: ['upload', 'detect', 'tryon'],
        imagePath: 'b_earring_6cm_attempt3.png',
        sourcePath: path.resolve(__dirname, '..', '..', 'outputs', 'b0', 'b_earring_6cm_attempt3.png'),
      },
      {
        id: 'lipstick-earring-chain',
        title: 'Lipstick + Earring Chaining',
        flow: 'multi-step',
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
        steps: ['upload', 'lipstick', 'detect', 'tryon'],
        imagePath: 'p7-chaining.png',
        sourcePath: path.resolve(__dirname, '..', '..', 'outputs', 'probes', 'p7-chaining.png'),
      },
      {
        id: 'stud-drop-stack',
        title: 'Stud + Drop Stack',
        flow: 'stack',
        productId: 'dot-stud',
        sizeCm: 0.6,
        stack: ['gilded-teardrop'],
        steps: ['upload', 'detect', 'stack-tryon'],
        imagePath: 'q4-stack.png',
        sourcePath: path.resolve(__dirname, '..', '..', 'outputs', 'probes', 'q4-stack.png'),
      },
      {
        id: 'hair-braids-earring',
        title: 'Hair Braids + Earring',
        flow: 'multi-step',
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
        steps: ['upload', 'hair', 'detect', 'tryon'],
        imagePath: 'q3-hair-earring.png',
        sourcePath: path.resolve(__dirname, '..', '..', 'outputs', 'probes', 'q3-hair-earring.png'),
      },
      {
        id: 'necklace',
        title: 'Necklace Try-on',
        flow: 'necklace',
        productId: 'orb-chain',
        steps: ['upload', 'detect-neck', 'tryon'],
        imagePath: 'q1-necklace.png',
        sourcePath: path.resolve(__dirname, '..', '..', 'outputs', 'probes', 'q1-necklace.png'),
      },
      {
        id: 'outfit',
        title: 'Outfit Try-on',
        flow: 'outfit',
        productId: 'emerald-blouse',
        steps: ['upload', 'detect-body', 'tryon'],
        imagePath: 'p6-clothes-v4.jpg',
        sourcePath: path.resolve(__dirname, '..', '..', 'outputs', 'probes', 'p6-clothes-v4.jpg'),
      },
    ]
    
    // Copy image files and create manifest
    const manifest = []
    
    for (const sample of samples) {
      try {
        // Check if source file exists
        await fs.access(sample.sourcePath)
        
        // Copy file to sample directory
        const destPath = path.join(sampleDir, sample.imagePath)
        await fs.copyFile(sample.sourcePath, destPath)
        
        console.log(`Copied: ${sample.imagePath}`)
        
        // Add to manifest (excluding sourcePath)
        const { sourcePath, ...manifestEntry } = sample
        manifest.push(manifestEntry)
        
      } catch (error) {
        console.warn(`Skipping ${sample.id}: ${error.message}`)
      }
    }
    
    // Write manifest.json
    const manifestPath = path.join(sampleDir, 'manifest.json')
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    
    console.log(`Created manifest with ${manifest.length} entries`)
    console.log('Sample build complete!')
    
  } catch (error) {
    console.error('Build sample error:', error)
    process.exit(1)
  }
}

// Run the build
buildSample()