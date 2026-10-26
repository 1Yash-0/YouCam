import { z } from 'zod'
import { AppError, ErrorCodes } from './errors'
import path from 'path'

const optionalUrl = z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value, z.string().url().optional())
const optionalSecret = z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value, z.string().min(1).optional())

const envSchema = z.object({
  YOUCAM_API_KEY: z.string().min(1, 'YOUCAM_API_KEY is required'),
  YOUCAM_API_KEY_FALLBACK: z.string().trim().optional().default(''),
  YOUCAM_API_BASE: z.string().url().default('https://yce-api-01.makeupar.com'),
  DATA_DIR: z.string().default(path.resolve(process.cwd(), '..', '.data')),
  STORAGE_DRIVER: z.enum(['local', 'supabase']).optional(),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  UNIT_RESERVE_FLOOR: z.coerce.number().int().positive().default(450),
  VISITOR_UNIT_CAP: z.coerce.number().int().positive().default(20),
  IRIS_MM: z.coerce.number().positive().default(11.7),
  ADMIN_TOKEN: z.string().optional(),
})

// Next.js loads web/.env.local for local runs; hosted functions receive server
// environment variables. Do not read env files here: file tracing can bundle them.
// Standalone Node scripts can use --env-file=.env.local explicitly.

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
export const storageDriver = env.STORAGE_DRIVER ?? (process.env.VERCEL ? 'supabase' : 'local')

if (process.env.VERCEL && storageDriver === 'local') {
  throw new AppError(ErrorCodes.INVALID_INPUT, 'Local storage is not durable on Vercel; configure Supabase storage.', 500)
}
if (storageDriver === 'supabase' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new AppError(ErrorCodes.INVALID_INPUT, 'Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.', 500)
}
