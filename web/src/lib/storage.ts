import fs from 'fs/promises'
import path from 'path'
import { env, storageDriver } from './env'
import { randomUUID } from 'crypto'
import { AppError } from './errors'

export interface DurableStorage {
  putFile(key: string, data: Buffer): Promise<void>
  getFile(key: string): Promise<Buffer | null>
  putJson(key: string, data: unknown): Promise<void>
  getJson<T>(key: string): Promise<T | null>
  exists(key: string): Promise<boolean>
  delete?(key: string): Promise<void>
  list?(prefix: string): Promise<string[]>
  claimOnce?(key: string): Promise<boolean>
  withLock?<T>(key: string, action: () => Promise<T>): Promise<T>
  createUploadTicket?(key: string, expiresInSeconds?: number): Promise<{ signedUrl: string; token?: string }>
  reserveVisitorUnits?(visitorKey: string, usageDate: string, units: number, cap: number): Promise<boolean>
}

export interface StorageDeps {
  rootDir: string
}

export interface StorageInstance {
  putFile: (key: string, data: Buffer) => Promise<void>
  getFile: (key: string) => Promise<Buffer | null>
  putJson: (key: string, data: any) => Promise<void>
  getJson: <T>(key: string) => Promise<T | null>
  exists: (key: string) => Promise<boolean>
  delete?: (key: string) => Promise<void>
  list?: (prefix: string) => Promise<string[]>
  claimOnce?: (key: string) => Promise<boolean>
  withLock?: <T>(key: string, action: () => Promise<T>) => Promise<T>
  createUploadTicket?: (key: string, expiresInSeconds?: number) => Promise<{ signedUrl: string; token?: string }>
  reserveVisitorUnits?: (visitorKey: string, usageDate: string, units: number, cap: number) => Promise<boolean>
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

export function createStorage({ rootDir, backend }: StorageDeps & { backend?: DurableStorage }): StorageInstance {
  if (backend) return createPathStorage(rootDir, backend)
  return createPathStorage(rootDir, createLocalBackend(rootDir))
}

function createPathStorage(rootDir: string, backend: DurableStorage): StorageInstance {
  const putFile = backend.putFile.bind(backend)
  const getFile = backend.getFile.bind(backend)
  const putJson = backend.putJson.bind(backend)
  const getJson = backend.getJson.bind(backend)
  const exists = backend.exists.bind(backend)

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
    ...(backend.delete ? { delete: backend.delete.bind(backend) } : {}),
    ...(backend.list ? { list: backend.list.bind(backend) } : {}),
    ...(backend.claimOnce ? { claimOnce: backend.claimOnce.bind(backend) } : {}),
    ...(backend.withLock ? { withLock: backend.withLock.bind(backend) } : {}),
    ...(backend.createUploadTicket ? { createUploadTicket: backend.createUploadTicket.bind(backend) } : {}),
    ...(backend.reserveVisitorUnits ? { reserveVisitorUnits: backend.reserveVisitorUnits.bind(backend) } : {}),
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

function createLocalBackend(rootDir: string): DurableStorage {
  const resolve = (key: string) => {
    const target = path.resolve(rootDir, key)
    if (target !== rootDir && !target.startsWith(`${path.resolve(rootDir)}${path.sep}`)) throw new Error('Invalid storage key')
    return target
  }
  const locks = new Map<string, Promise<unknown>>()
  return {
    async putFile(key, data) {
      const target = resolve(key), temp = `${target}.${randomUUID()}.tmp`
      await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(temp, data); await fs.rename(temp, target)
    },
    async getFile(key) { try { return await fs.readFile(resolve(key)) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error } },
    async putJson(key, data) { const target = resolve(key), temp = `${target}.${randomUUID()}.tmp`; await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(temp, JSON.stringify(data)); await fs.rename(temp, target) },
    async getJson<T>(key: string) { try { return JSON.parse(await fs.readFile(resolve(key), 'utf8')) as T } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error } },
    async exists(key) { try { await fs.access(resolve(key)); return true } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error } },
    async delete(key) { await fs.rm(resolve(key), { force: true }) },
    async list(prefix) {
      const base = resolve(prefix), found: string[] = []
      async function walk(dir: string): Promise<void> { let entries; try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error }
        for (const entry of entries) { const full = path.join(dir, entry.name); if (entry.isDirectory()) await walk(full); else found.push(path.relative(rootDir, full).replaceAll(path.sep, '/')) }
      }
      await walk(base); return found
    },
    async claimOnce(key: string) { const target = resolve(`meta/claims/${key}.lock`); await fs.mkdir(path.dirname(target), { recursive: true }); try { const handle = await fs.open(target, 'wx'); await handle.close(); return true } catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false; throw error } },
    async withLock<T>(key: string, action: () => Promise<T>) {
      const prior = locks.get(key) ?? Promise.resolve(); let release!: () => void
      const current = new Promise<void>(resolve => { release = resolve }); const queued = prior.then(() => current); locks.set(key, queued)
      await prior
      try { return await action() } finally { release(); if (locks.get(key) === queued) locks.delete(key) }
    },
  }
}

export class SupabaseStorageBackend implements DurableStorage {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>
  constructor(options: { url: string; serviceRoleKey: string; fetcher?: typeof fetch; bucket?: string; lockTtlSeconds?: number }) {
    this.baseUrl = options.url.replace(/\/$/, '')
    this.headers = { apikey: options.serviceRoleKey, Authorization: `Bearer ${options.serviceRoleKey}` }
    this.fetcher = options.fetcher ?? fetch
    this.bucket = options.bucket ?? 'darpan-private'
    this.lockTtlSeconds = options.lockTtlSeconds ?? 120
  }
  private readonly fetcher: typeof fetch
  private readonly bucket: string
  private readonly lockTtlSeconds: number
  private objectBucket(key: string) { return key.startsWith('staging/') ? 'darpan-staging' : this.bucket }
  private objectUrl(key: string) { return `${this.baseUrl}/storage/v1/object/${this.objectBucket(key)}/${encodeStorageKey(key)}` }
  private async request(url: string, init: RequestInit = {}) {
    const response = await this.fetcher(url, { ...init, headers: { ...this.headers, ...(init.headers as Record<string, string> ?? {}) } })
    if (!response.ok && response.status !== 404) throw new Error(`Supabase storage request failed (${response.status})`)
    return response
  }
  async putFile(key: string, data: Buffer) { await this.request(this.objectUrl(key), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' }, body: new Uint8Array(data) }) }
  async getFile(key: string) { const response = await this.request(this.objectUrl(key)); return response.status === 404 ? null : Buffer.from(await response.arrayBuffer()) }
  async putJson(key: string, data: unknown) {
    await this.request(`${this.baseUrl}/rest/v1/darpan_state?on_conflict=key`, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key, value: data, updated_at: new Date().toISOString() }) })
  }
  async getJson<T>(key: string) {
    const response = await this.request(`${this.baseUrl}/rest/v1/darpan_state?select=value&key=eq.${encodeURIComponent(key)}&limit=1`)
    if (response.status === 404) return null
    const rows = await response.json() as Array<{ value: T }>
    return rows[0]?.value ?? null
  }
  async exists(key: string) {
    const response = await this.request(this.objectUrl(key), { method: 'HEAD' })
    if (response.status !== 404) return true
    return (await this.getJson(key)) !== null
  }
  async delete(key: string) {
    await this.request(`${this.baseUrl}/rest/v1/darpan_state?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' })
    await this.request(`${this.baseUrl}/storage/v1/object/${this.objectBucket(key)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }) })
  }
  async list(prefix: string) {
    const basePrefix = prefix.replace(/\/$/, '')
    const escapedPrefix = basePrefix.replace(/[\\%_]/g, '\\$&')
    const stateKeys: string[] = []
    for (let offset = 0; ; offset += 1000) {
      const filter = encodeURIComponent(`${escapedPrefix}%`)
      const response = await this.request(`${this.baseUrl}/rest/v1/darpan_state?select=key&key=like.${filter}&order=key.asc&limit=1000&offset=${offset}`)
      if (response.status === 404) break
      const rows = await response.json() as Array<{ key: string }>
      stateKeys.push(...rows.map(row => row.key))
      if (rows.length < 1000) break
    }
    const objectKeys: string[] = []
    const pending = [prefix]
    while (pending.length) {
      const currentPrefix = pending.pop()!
      for (let offset = 0; ; offset += 1000) {
        const response = await this.request(`${this.baseUrl}/storage/v1/object/list/${this.objectBucket(currentPrefix)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: currentPrefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) })
        if (response.status === 404) break
        const rows = await response.json() as Array<{ name: string; id?: string | null; metadata?: unknown }>
        for (const row of rows) {
          const key = `${currentPrefix.replace(/\/$/, '')}/${row.name}`
          if (row.id === null && row.metadata == null) pending.push(key)
          else objectKeys.push(key)
        }
        if (rows.length < 1000) break
      }
    }
    return Array.from(new Set([...stateKeys, ...objectKeys]))
  }
  async createUploadTicket(key: string, expiresInSeconds = 120) {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 600) throw new Error('Invalid upload ticket lifetime')
    const response = await this.request(`${this.baseUrl}/storage/v1/object/upload/sign/${this.objectBucket(key)}/${encodeStorageKey(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: expiresInSeconds }) })
    const result = await response.json() as { url?: string; signedURL?: string; token?: string }
    const signed = result.signedURL ?? result.url
    if (!signed) throw new Error('Supabase did not return a signed upload URL')
    const signedUrl = /^https?:\/\//i.test(signed)
      ? signed
      : signed.startsWith('/storage/v1/')
        ? `${this.baseUrl}${signed}`
        : `${this.baseUrl}/storage/v1${signed.startsWith('/') ? signed : `/${signed}`}`
    return { signedUrl, ...(result.token ? { token: result.token } : {}) }
  }
  async claimOnce(key: string) {
    const result = await this.rpc<boolean>('darpan_claim_once', { claim_key: key })
    return result
  }
  async reserveVisitorUnits(visitorKey: string, usageDate: string, units: number, cap: number) {
    return this.rpc<boolean>('darpan_reserve_visitor_units', { p_visitor_key: visitorKey, p_usage_date: usageDate, p_units: units, p_cap: cap })
  }
  async withLock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const token = randomUUID()
    const acquired = await this.rpc<boolean>('darpan_acquire_lease', { lease_key: key, lease_token: token, ttl_seconds: this.lockTtlSeconds })
    if (!acquired) throw new AppError('LOCKED', 'This item is already being processed.', 409)
    try { return await action() } finally { await this.rpc('darpan_release_lease', { lease_key: key, lease_token: token }) }
  }
  private async rpc<T>(name: string, body: unknown): Promise<T> {
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return await response.json() as T
  }
}

function encodeStorageKey(key: string) {
  const parts = key.split('/')
  if (!parts.length || parts.some(part => !part || part === '.' || part === '..')) throw new Error('Invalid storage key')
  return parts.map(encodeURIComponent).join('/')
}

// Create default storage instance
const storageRoot = env.DATA_DIR
const defaultBackend = storageDriver === 'supabase'
  ? new SupabaseStorageBackend({ url: env.SUPABASE_URL!, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY! })
  : undefined
const defaultStorage = createStorage({ rootDir: storageRoot, backend: defaultBackend })

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
export const createUploadTicket = async (key: string, expiresInSeconds?: number) => {
  if (!defaultStorage.createUploadTicket) throw new AppError('STORAGE_NOT_SUPPORTED', 'Direct uploads require Supabase storage.', 501)
  return defaultStorage.createUploadTicket(key, expiresInSeconds)
}
export const reserveVisitorUnits = async (visitorKey: string, usageDate: string, units: number, cap: number) => {
  if (!defaultStorage.reserveVisitorUnits) throw new AppError('STORAGE_NOT_SUPPORTED', 'Atomic visitor quotas require Supabase storage.', 501)
  return defaultStorage.reserveVisitorUnits(visitorKey, usageDate, units, cap)
}

// Also export the default instance for tests
export { defaultStorage }

