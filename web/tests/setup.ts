import { vi, beforeAll, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// Mock environment variables
process.env.YOUCAM_API_KEY = 'test-key'
process.env.YOUCAM_API_KEY_FALLBACK = ''
process.env.STORAGE_DRIVER = 'local'
process.env.YOUCAM_API_BASE = 'https://test-api.example.com'
process.env.DATA_DIR = path.join(process.cwd(), '.test-data')

// Clean up test data directory before tests
beforeAll(async () => {
  const testDataDir = process.env.DATA_DIR!
  for (let attempt = 0; attempt < 5 && fs.existsSync(testDataDir); attempt++) {
    try {
      await fs.promises.rm(testDataDir, { recursive: true, force: true })
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
})

// Mock global fetch
global.fetch = vi.fn()

// Reset mocks between tests
beforeEach(() => {
  vi.resetAllMocks()
})
