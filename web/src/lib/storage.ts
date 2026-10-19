import fs from 'fs/promises'
import path from 'path'
import { env } from './env'

export interface StorageDeps {
  rootDir: string
}

export interface StorageInstance {
  putFile: (key: string, data: Buffer) => Promise<void>
  getFile: (key: string) => Promise<Buffer | null>
  putJson: (key: string, data: any) => Promise<void>
  getJson: <T>(key: string) => Promise<T | null>
  exists: (key: string) => Promise<boolean>
  photoPath: (hash: string) => string
  photoMetaPath: (hash: string) => string
  resultPath: (key: string) => string
  resultMetaPath: (key: string) => string
  jobPath: (jobId: string) => string
  visitorPath: (visitorId: string, date: string) => string
  productMetaPath: (productId: string) => string
  finalisedMarkerPath: (jobId: string) => string
  pipelineJobPath: (jobId: string) => string
  stepCacheMetaPath: (key: string) => string
  stepCacheFilePath: (key: string) => string
  runtimeProductsPath: () => string
  runtimeProductImagePath: (productId: string) => string
  looksPath: (lookId: string) => string
  rootDir: string
}

export function createStorage({ rootDir }: StorageDeps): StorageInstance {
  // Ensure directories exist
  async function ensureDirectories() {
    const dirs = [
      rootDir,
      path.join(rootDir, 'photos'),
      path.join(rootDir, 'results'),
      path.join(rootDir, 'meta'),
      path.join(rootDir, 'meta', 'photos'),
      path.join(rootDir, 'meta', 'results'),
      path.join(rootDir, 'meta', 'jobs'),
      path.join(rootDir, 'meta', 'visitors'),
      path.join(rootDir, 'meta', 'products'),
      path.join(rootDir, 'meta', 'pipeline-jobs'),
      path.join(rootDir, 'meta', 'step-cache'),
      path.join(rootDir, 'step-cache'),
    ]
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  async function putFile(key: string, data: Buffer): Promise<void> {
    const filePath = path.join(rootDir, key)
    const tmpPath = `${filePath}.tmp`
    
    await ensureDirectories()
    await fs.writeFile(tmpPath, data)
    await fs.rename(tmpPath, filePath)
  }

  async function getFile(key: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(rootDir, key)
      return await fs.readFile(filePath)
    } catch {
      return null
    }
  }

  async function putJson(key: string, data: any): Promise<void> {
    const filePath = path.join(rootDir, key)
    const tmpPath = `${filePath}.tmp`
    
    await ensureDirectories()
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2))
    await fs.rename(tmpPath, filePath)
  }

  async function getJson<T>(key: string): Promise<T | null> {
    try {
      const filePath = path.join(rootDir, key)
      const content = await fs.readFile(filePath, 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  async function exists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(rootDir, key)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  // Helper functions for common paths
  function photoPath(hash: string): string {
    return `photos/${hash}.png`
  }

  function photoMetaPath(hash: string): string {
    return `meta/photos/${hash}.json`
  }

  function resultPath(key: string): string {
    return `results/${key}.png`
  }

  function resultMetaPath(key: string): string {
    return `meta/results/${key}.json`
  }

  function jobPath(jobId: string): string {
    return `meta/jobs/${jobId}.json`
  }

  function visitorPath(visitorId: string, date: string): string {
    return `meta/visitors/${visitorId}-${date}.json`
  }

  function productMetaPath(productId: string): string {
    return `meta/products/${productId}.json`
  }

  function finalisedMarkerPath(jobId: string): string {
    return `meta/finalised/${jobId}.lock`
  }

  function pipelineJobPath(jobId: string): string {
    return `meta/pipeline-jobs/${jobId}.json`
  }

  function stepCacheMetaPath(key: string): string {
    return `meta/step-cache/${key}.json`
  }

  function stepCacheFilePath(key: string): string {
    return `step-cache/${key}.png`
  }

  function runtimeProductsPath(): string {
    return `products.json`
  }

  function runtimeProductImagePath(productId: string): string {
    return `products/${productId}.png`
  }

  function looksPath(lookId: string): string {
    return `looks/${lookId}.json`
  }

  return {
    putFile,
    getFile,
    putJson,
    getJson,
    exists,
    photoPath,
    photoMetaPath,
    resultPath,
    resultMetaPath,
    jobPath,
    visitorPath,
    productMetaPath,
    finalisedMarkerPath,
    pipelineJobPath,
    stepCacheMetaPath,
    stepCacheFilePath,
    runtimeProductsPath,
    runtimeProductImagePath,
    looksPath,
    rootDir,
  }
}

// Create default storage instance
const storageRoot = process.env.VERCEL
  ? '/tmp/darpan-data'
  : env.DATA_DIR

const defaultStorage = createStorage({ rootDir: storageRoot })

// Initialize directories on module load
;(async () => {
  const dirs = [
    storageRoot,
    path.join(storageRoot, 'photos'),
    path.join(storageRoot, 'results'),
    path.join(storageRoot, 'step-cache'),
    path.join(storageRoot, 'meta'),
    path.join(storageRoot, 'meta', 'photos'),
    path.join(storageRoot, 'meta', 'results'),
    path.join(storageRoot, 'meta', 'jobs'),
    path.join(storageRoot, 'meta', 'pipeline-jobs'),
    path.join(storageRoot, 'meta', 'visitors'),
    path.join(storageRoot, 'meta', 'products'),
    path.join(storageRoot, 'meta', 'finalised'),
    path.join(storageRoot, 'meta', 'step-cache'),
    path.join(storageRoot, 'products'),
    path.join(storageRoot, 'looks'),
    path.join(storageRoot, 'sample'),
  ]
  
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true }).catch(console.error)
  }
})()

// Export default instance methods
export const putFile = defaultStorage.putFile
export const getFile = defaultStorage.getFile
export const putJson = defaultStorage.putJson
export const getJson = defaultStorage.getJson
export const exists = defaultStorage.exists
export const photoPath = defaultStorage.photoPath
export const photoMetaPath = defaultStorage.photoMetaPath
export const resultPath = defaultStorage.resultPath
export const resultMetaPath = defaultStorage.resultMetaPath
export const jobPath = defaultStorage.jobPath
export const visitorPath = defaultStorage.visitorPath
export const productMetaPath = defaultStorage.productMetaPath
export const finalisedMarkerPath = defaultStorage.finalisedMarkerPath
export const pipelineJobPath = defaultStorage.pipelineJobPath
export const stepCacheMetaPath = defaultStorage.stepCacheMetaPath
export const stepCacheFilePath = defaultStorage.stepCacheFilePath
export const runtimeProductsPath = defaultStorage.runtimeProductsPath
export const runtimeProductImagePath = defaultStorage.runtimeProductImagePath
export const looksPath = defaultStorage.looksPath
export const rootDir = defaultStorage.rootDir

// Also export the default instance for tests
export { defaultStorage }

