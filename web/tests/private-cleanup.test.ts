import { describe, expect, it, vi } from 'vitest'
import type { StorageInstance } from '@/lib/storage'
import { cleanupExpiredPrivateData, deleteOwnedPhoto } from '@/lib/private-cleanup'
import type { PhotoMeta, PipelineJobRecord } from '@/lib/tryon-pipeline'

const photoId = 'a'.repeat(64)
const resultKey = 'b'.repeat(64)
const cacheKey = 'c'.repeat(64)

function memoryStorage(): { storage: StorageInstance; data: Map<string, unknown>; files: Set<string>; locks: string[] } {
  const data = new Map<string, unknown>()
  const files = new Set<string>()
  const locks: string[] = []
  const storage = {
    async putFile(key: string) { files.add(key) },
    async getFile(key: string) { return files.has(key) ? Buffer.from('image') : null },
    async putJson(key: string, value: unknown) { data.set(key, value) },
    async getJson<T>(key: string) { return (data.get(key) as T | undefined) ?? null },
    async exists(key: string) { return data.has(key) || files.has(key) },
    async delete(key: string) { data.delete(key); files.delete(key) },
    async list(prefix: string) { return [...new Set([...data.keys(), ...files])].filter(key => key.startsWith(prefix)) },
    async withLock<T>(key: string, action: () => Promise<T>) { locks.push(key); return action() },
    photoPath: (id: string) => `photos/${id}.png`,
    photoMetaPath: (id: string) => `meta/photos/${id}.json`,
    resultPath: (key: string) => `results/${key}.png`,
    resultMetaPath: (key: string) => `meta/results/${key}.json`,
    jobPath: (id: string) => `meta/jobs/${id}.json`,
    visitorPath: (id: string, date: string) => `meta/visitors/${id}-${date}.json`,
    productMetaPath: (id: string) => `meta/products/${id}.json`,
    finalisedMarkerPath: (id: string) => `meta/finalised/${id}.lock`,
    pipelineJobPath: (id: string) => `meta/pipeline-jobs/${id}.json`,
    stepCacheMetaPath: (key: string) => `meta/step-cache/${key}.json`,
    stepCacheFilePath: (key: string) => `step-cache/${key}.png`,
    runtimeProductsPath: () => 'products.json',
    runtimeProductImagePath: (id: string) => `products/${id}.png`,
    looksPath: (id: string) => `looks/${id}.json`,
    rootDir: '/memory',
  } as unknown as StorageInstance
  return { storage, data, files, locks }
}

function job(status: 'pending' | 'running' | 'submitting' | 'error'): PipelineJobRecord {
  return {
    jobId: 'job-1', flow: 'ear', steps: [{ type: 'earring', params: {}, status, inputHash: 'hash', cacheKey, outputFileId: 'youcam-output', units: 1, cached: false }],
    index: 0, visitorId: 'visitor', createdAt: new Date(0).toISOString(), currentStepInputFileId: 'youcam-source',
    originalPhotoId: photoId, earPinned: false, earRetryAttempts: 0, products: { ring: { fileId: 'product-upload', type: 'ring' } },
  }
}

function seedPhoto(storage: StorageInstance, data: Map<string, unknown>, files: Set<string>, status: 'pending' | 'running' | 'submitting' | 'error' = 'error', expiresAt = '2099-01-01T00:00:00.000Z') {
  const meta: PhotoMeta = { fileId: 'photo-upload', ownerId: 'owner-a', expiresAt, uploadedAt: new Date(0).toISOString(), width: 10, height: 10 }
  data.set(storage.photoMetaPath(photoId), meta)
  files.add(storage.photoPath(photoId))
  data.set(`private/photos/${photoId}/jobs/job-1.json`, { jobId: 'job-1' })
  data.set(storage.pipelineJobPath('job-1'), job(status))
  data.set(`private/photos/${photoId}/results/${resultKey}.json`, { key: resultKey })
  data.set(`private/photos/${photoId}/requests/${'d'.repeat(64)}.json`, { status: 'done' })
  data.set(storage.resultMetaPath(resultKey), { ownerId: 'owner-a', expiresAt, photoId })
  files.add(storage.resultPath(resultKey))
  data.set(storage.stepCacheMetaPath(cacheKey), { outputFileId: 'youcam-output' })
  files.add(storage.stepCacheFilePath(cacheKey))
  data.set(storage.finalisedMarkerPath('job-1-0'), true)
}

describe('private photo cleanup', () => {
  it('denies a different owner without deleting any private bytes', async () => {
    const { storage, data, files, locks } = memoryStorage()
    seedPhoto(storage, data, files)
    const forgetFile = vi.fn(async (_fileId: string) => {})

    await expect(deleteOwnedPhoto({ storage, forgetFile }, photoId, 'owner-b')).rejects.toMatchObject({ httpStatus: 404 })
    expect(files.has(storage.photoPath(photoId))).toBe(true)
    expect(data.has(storage.photoMetaPath(photoId))).toBe(true)
    expect(locks).toEqual([`private-photo:${photoId}`])
    expect(forgetFile).not.toHaveBeenCalled()
  })

  it.each(['pending', 'running'] as const)('rejects deletion while a provider job is %s', async status => {
    const { storage, data, files } = memoryStorage()
    seedPhoto(storage, data, files, status)
    const forgetFile = vi.fn(async (_fileId: string) => {})
    await expect(deleteOwnedPhoto({ storage, forgetFile }, photoId, 'owner-a')).rejects.toMatchObject({ httpStatus: 409 })
    expect(files.has(storage.photoPath(photoId))).toBe(true)
    expect(forgetFile).not.toHaveBeenCalled()
  })

  it('deletes owned source, results, job and unshared step cache, without forgetting product uploads', async () => {
    const { storage, data, files, locks } = memoryStorage()
    seedPhoto(storage, data, files, 'submitting')
    const forgetFile = vi.fn(async (_fileId: string) => {})
    data.set(`style/${photoId}.json`, { skinHex: '#C7997C' })

    await deleteOwnedPhoto({ storage, forgetFile }, photoId, 'owner-a')
    expect(data.has(`style/${photoId}.json`)).toBe(false)
    expect(files.has(storage.photoPath(photoId))).toBe(false)
    expect(files.has(storage.resultPath(resultKey))).toBe(false)
    expect(files.has(storage.stepCacheFilePath(cacheKey))).toBe(false)
    expect(data.has(storage.photoMetaPath(photoId))).toBe(false)
    expect(data.has(storage.pipelineJobPath('job-1'))).toBe(false)
    expect(data.has(`private/photos/${photoId}/requests/${'d'.repeat(64)}.json`)).toBe(false)
    expect(data.has(storage.finalisedMarkerPath('job-1-0'))).toBe(false)
    expect(locks).toEqual([`private-photo:${photoId}`])
    expect(forgetFile.mock.calls.map(([id]) => id).sort()).toEqual(['photo-upload', 'youcam-output', 'youcam-source'])
    expect(forgetFile).not.toHaveBeenCalledWith('product-upload')
  })

  it('deletes authoritative job and result records left without private indexes after a crash', async () => {
    const { storage, data, files } = memoryStorage()
    seedPhoto(storage, data, files, 'error')
    data.delete(`private/photos/${photoId}/jobs/job-1.json`)
    data.delete(`private/photos/${photoId}/results/${resultKey}.json`)
    const forgetFile = vi.fn(async (_fileId: string) => {})

    await deleteOwnedPhoto({ storage, forgetFile }, photoId, 'owner-a')
    expect(data.has(storage.pipelineJobPath('job-1'))).toBe(false)
    expect(data.has(storage.resultMetaPath(resultKey))).toBe(false)
    expect(files.has(storage.resultPath(resultKey))).toBe(false)
  })

  it('expires active photos on the retention sweep and removes expired upload tickets and sessions', async () => {
    const { storage, data, files } = memoryStorage()
    const expiredAt = '2020-01-01T00:00:00.000Z'
    seedPhoto(storage, data, files, 'running', expiredAt)
    data.set('staging-meta/owner-a/ticket.json', { ownerId: 'owner-a', key: 'staging/owner-a/ticket', expiresAt: expiredAt })
    files.add('staging/owner-a/ticket')
    data.set('sessions/expired.json', { expiresAt: expiredAt })
    data.set('sessions/current.json', { expiresAt: '2099-01-01T00:00:00.000Z' })
    const forgetFile = vi.fn(async (_fileId: string) => {})

    await cleanupExpiredPrivateData({ storage, forgetFile, now: () => new Date('2026-10-25T00:00:00.000Z') })
    expect(files.has(storage.photoPath(photoId))).toBe(false)
    expect(files.has('staging/owner-a/ticket')).toBe(false)
    expect(data.has('sessions/expired.json')).toBe(false)
    expect(data.has('sessions/current.json')).toBe(true)
  })
})
