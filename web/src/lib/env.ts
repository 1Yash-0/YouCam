import { z } from 'zod'
import { AppError, ErrorCodes } from './errors'
import path from 'path'

const envSchema = z.object({
  YOUCAM_API_KEY: z.string().min(1, 'YOUCAM_API_KEY is required'),
  YOUCAM_API_BASE: z.string().url().default('https://yce-api-01.makeupar.com'),
  DATA_DIR: z.string().default(path.resolve(process.cwd(), '..', '.data')),
  UNIT_RESERVE_FLOOR: z.coerce.number().int().positive().default(450),
  VISITOR_UNIT_CAP: z.coerce.number().int().positive().default(20),
  IRIS_MM: z.coerce.number().positive().default(11.7),
  ADMIN_TOKEN: z.string().optional(),
})

// Load environment from parent directory
function loadRootEnv() {
  // Try to load from parent .env.local
  const parentEnvPath = path.resolve(process.cwd(), '..', '.env.local')
  const fs = require('fs')
  
  if (fs.existsSync(parentEnvPath)) {
    const content = fs.readFileSync(parentEnvPath, 'utf8')
    const lines = content.split('\n')
    
    lines.forEach((line: string) => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      }
    })
  }
  
  // Also load from .env.local in current directory if it exists
  const currentEnvPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(currentEnvPath)) {
    // Load .env.local manually (simpler than importing @next/env just for this)
    const currentContent = fs.readFileSync(currentEnvPath, 'utf8')
    const currentLines = currentContent.split('\n')
    
    currentLines.forEach((line: string) => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      }
    })
  }
}

// Load environment
loadRootEnv()

// Parse and validate
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const errorMessages = parsed.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
  throw new AppError(
    ErrorCodes.INVALID_INPUT,
    `Environment validation failed:\n${errorMessages.join('\n')}`,
    500
  )
}

export const env = parsed.data