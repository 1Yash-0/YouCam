import type { StorageInstance } from './storage'
import type { PipelineJobRecord, PhotoMeta } from './tryon-pipeline'
import { AppError, ErrorCodes } from './errors'

export interface PrivateCleanupDeps {
  storage: StorageInstance
  forgetFile: (fileId: string) => Promise<void>
  now?: () => Date
}
type ExpiringResource = { expiresAt: string }

const jsonFiles = async (storage: StorageInstance, prefix: string) => {
  if (!storage.list) throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Private cleanup is not supported by this storage backend.', 500)
  return (await storage.list(prefix)).filter(key => key.endsWith('.json'))
}

function expired(meta: ExpiringResource, now: Date) {
  const expiry = Date.parse(meta.expiresAt)
  return Number.isFinite(expiry) && expiry <= now.getTime()
}

function isActive(job: PipelineJobRecord) {
  const step = job.steps[job.index]
  // A saved `submitting` state is deliberately treated as uncertain: the provider
  // may or may not have accepted it, and this service cannot cancel it.
  return Boolean(step && (step.status === 'pending' || step.status === 'running'))
}

async function withPhotoLock<T>(storage: StorageInstance, photoId: string, action: () => Promise<T>) {
  if (storage.withLock) return storage.withLock(`private-photo:${photoId}`, action)
  return action()
}

async function deleteKey(storage: StorageInstance, key: string) {
  if (!storage.delete) throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Private cleanup is not supported by this storage backend.', 500)
  await storage.delete(key)
}

/** Read many JSON records concurrently (bounded). Each read is a network round trip on cloud storage. */
async function readAll<T>(storage: StorageInstance, keys: string[], limit = 16): Promise<Array<{ key: string; value: T | null }>> {
  const out: Array<{ key: string; value: T | null }> = new Array(keys.length)
  let next = 0
  const worker = async () => { while (next < keys.length) { const i = next++; out[i] = { key: keys[i], value: await storage.getJson<T>(keys[i]) } } }
  await Promise.all(Array.from({ length: Math.min(limit, keys.length) }, worker))
  return out
}

/** Delete many keys concurrently (bounded). */
async function deleteAll(storage: StorageInstance, keys: string[], limit = 16) {
  let next = 0
  const worker = async () => { while (next < keys.length) { const i = next++; await deleteKey(storage, keys[i]) } }
  await Promise.all(Array.from({ length: Math.min(limit, keys.length) }, worker))
}

async function removePhoto(deps: PrivateCleanupDeps, photoId: string, options: { ownerId?: string; allowExpired: boolean; forceActive: boolean }) {
  const { storage } = deps
  await withPhotoLock(storage, photoId, async () => {
    // Re-read under the same lock used by try-on creation/polling. This prevents a
    // stale cleanup scan from deleting a newly refreshed or replaced photo record.
    const currentMeta = await storage.getJson<PhotoMeta>(storage.photoMetaPath(photoId))
    const now = (deps.now ?? (() => new Date()))()
    if (!currentMeta || !Number.isFinite(Date.parse(currentMeta.expiresAt || '')) ||
      (options.ownerId && currentMeta.ownerId !== options.ownerId) ||
      (!options.allowExpired && expired({ expiresAt: currentMeta.expiresAt! }, now)) ||
      (!options.ownerId && (!currentMeta.ownerId || !expired({ expiresAt: currentMeta.expiresAt! }, now)))) {
      if (options.ownerId) throw new AppError(ErrorCodes.NOT_FOUND, 'This private photo is unavailable or has expired.', 404)
      return
    }
    const photoMeta = currentMeta
    const jobIndex = `private/photos/${photoId}/jobs/`
    const resultIndex = `private/photos/${photoId}/results/`
    const requestIndex = `private/photos/${photoId}/requests/`
    const jobIndexKeys = await jsonFiles(storage, jobIndex)
    const resultIndexKeys = await jsonFiles(storage, resultIndex)
    const requestIndexKeys = await jsonFiles(storage, requestIndex)
    // The private index is written after the authoritative record, so a crash can
    // leave a job without an index. Union both sources, but only select records
    // whose originalPhotoId points at this photo. All job records are read once, concurrently.
    const allJobs = (await readAll<PipelineJobRecord>(storage, await jsonFiles(storage, 'meta/pipeline-jobs/'))).map(r => r.value).filter((r): r is PipelineJobRecord => Boolean(r?.jobId))
    const jobsById = new Map<string, PipelineJobRecord>()
    for (const record of allJobs) if (record.originalPhotoId === photoId) jobsById.set(record.jobId, record)
    const jobs = [...jobsById].map(([id, record]) => ({ id, record }))
    if (!options.forceActive && jobs.some(({ record }) => record && isActive(record))) {
      throw new AppError('PHOTO_IN_USE', 'This photo is still being processed. Please wait for the preview to finish before deleting it.', 409)
    }

    const deletingJobIds = new Set(jobs.map(({ id }) => id))
    const otherJobs = allJobs.filter(record => !deletingJobIds.has(record.jobId))
    const retainedCacheKeys = new Set<string>()
    const retainedFileIds = new Set<string>()
    for (const job of otherJobs) {
      retainedFileIds.add(job.currentStepInputFileId)
      for (const fileId of job.privateFileIds || []) retainedFileIds.add(fileId)
      for (const step of job.steps) {
        if (step.cacheKey) retainedCacheKeys.add(step.cacheKey)
        if (step.outputFileId) retainedFileIds.add(step.outputFileId)
      }
    }

    const cacheKeys = new Set<string>()
    const youCamFileIds = new Set<string>()
    if (photoMeta.fileId) youCamFileIds.add(photoMeta.fileId)
    for (const { record } of jobs) {
      if (!record) continue
      for (const fileId of record.privateFileIds || []) youCamFileIds.add(fileId)
      if (record.currentStepInputFileId) youCamFileIds.add(record.currentStepInputFileId)
      for (const step of record.steps) {
        if (step.cacheKey) cacheKeys.add(step.cacheKey)
        if (step.outputFileId) youCamFileIds.add(step.outputFileId)
      }
    }

    // Result metadata is authoritative and is also persisted before its private
    // index, so account for orphaned records left by a crash in that gap.
    const resultsToDelete = new Set<string>()
    const resultMetaKeys = (await jsonFiles(storage, 'meta/results/')).filter(key => /^[a-f0-9]{64}$/.test(key.split('/').pop()?.replace(/\.json$/, '') ?? ''))
    for (const { key, value } of await readAll<{ photoId?: string }>(storage, resultMetaKeys)) {
      if (value?.photoId === photoId) resultsToDelete.add(key.split('/').pop()!.replace(/\.json$/, ''))
    }
    const indexed = (await readAll<{ key?: string }>(storage, resultIndexKeys)).map(r => r.value?.key).filter((k): k is string => Boolean(k && /^[a-f0-9]{64}$/.test(k)) && !resultsToDelete.has(k!))
    for (const { key, value } of await readAll<{ photoId?: string }>(storage, indexed.map(k => storage.resultMetaPath(k)))) {
      if (value?.photoId === photoId) resultsToDelete.add(key.split('/').pop()!.replace(/\.json$/, ''))
    }
    await deleteAll(storage, [...resultsToDelete].flatMap(k => [storage.resultPath(k), storage.resultMetaPath(k)]))
    await deleteAll(storage, [...jobIndexKeys, ...resultIndexKeys, ...requestIndexKeys])
    await deleteAll(storage, jobs.flatMap(({ id, record }) => [
      storage.pipelineJobPath(id), storage.jobPath(id), storage.finalisedMarkerPath(id),
      ...Array.from({ length: record?.steps.length ?? 0 }, (_, index) => storage.finalisedMarkerPath(`${id}-${index}`)),
    ]))
    await deleteAll(storage, [...cacheKeys].filter(key => !retainedCacheKeys.has(key)).flatMap(key => [storage.stepCacheFilePath(key), storage.stepCacheMetaPath(key)]))
    await Promise.all([...youCamFileIds].filter(id => !retainedFileIds.has(id)).map(id => deps.forgetFile(id)))

    await deleteKey(storage, storage.photoPath(photoId))
    await deleteKey(storage, storage.photoMetaPath(photoId))
    // The skin-tone estimate is derived from the photo, so it goes with it (written by /api/style).
    await deleteKey(storage, `style/${photoId}.json`)
  })
}

export async function deleteOwnedPhoto(deps: PrivateCleanupDeps, photoId: string, ownerId: string) {
  if (!/^[a-f0-9]{64}$/.test(photoId)) throw new AppError(ErrorCodes.NOT_FOUND, 'This private photo is unavailable.', 404)
  await removePhoto(deps, photoId, { ownerId, allowExpired: true, forceActive: false })
}

export async function cleanupExpiredPhoto(deps: PrivateCleanupDeps, photoId: string, meta: PhotoMeta) {
  const now = (deps.now ?? (() => new Date()))()
  if (!meta.ownerId || !meta.expiresAt || !expired({ expiresAt: meta.expiresAt }, now)) return false
  await removePhoto(deps, photoId, { allowExpired: true, forceActive: true })
  return true
}

export async function cleanupExpiredPrivateData(deps: PrivateCleanupDeps) {
  const { storage } = deps
  const now = (deps.now ?? (() => new Date()))()
  let removed = 0
  for (const key of await jsonFiles(storage, 'meta/photos/')) {
    const photoId = key.split('/').pop()?.replace(/\.json$/, '')
    if (!photoId || !/^[a-f0-9]{64}$/.test(photoId)) continue
    const meta = await storage.getJson<PhotoMeta>(key)
    if (meta && await cleanupExpiredPhoto(deps, photoId, meta)) removed++
  }

  for (const key of await jsonFiles(storage, 'staging-meta/')) {
    const ticket = await storage.getJson<{ ownerId?: string; key?: string; expiresAt?: string }>(key)
    if (!ticket?.ownerId || !ticket.key || !ticket.expiresAt || !expired({ expiresAt: ticket.expiresAt }, now)) continue
    if (!ticket.key.startsWith(`staging/${ticket.ownerId}/`)) continue
    await deleteKey(storage, ticket.key)
    await deleteKey(storage, key)
  }

  for (const key of await jsonFiles(storage, 'sessions/')) {
    const session = await storage.getJson<{ expiresAt?: string }>(key)
    if (session?.expiresAt && Date.parse(session.expiresAt) <= now.getTime()) await deleteKey(storage, key)
  }
  // Signed upload URLs may outlive the accepted ticket. Reap late re-uploads even
  // after their ticket metadata was consumed, using the server-generated key timestamp.
  for (const key of await storage.list?.('staging/') ?? []) {
    const match = /^staging\/[a-f0-9]{64}\/([0-9]{13})-[a-f0-9-]{36}$/.exec(key)
    if (match && now.getTime() - Number(match[1]) >= 24 * 60 * 60 * 1000) await deleteKey(storage, key)
  }
  return removed
}
