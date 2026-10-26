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
    // whose originalPhotoId points at this photo.
    const jobsById = new Map<string, PipelineJobRecord>()
    for (const key of await jsonFiles(storage, 'meta/pipeline-jobs/')) {
      const record = await storage.getJson<PipelineJobRecord>(key)
      if (record?.jobId && record.originalPhotoId === photoId) jobsById.set(record.jobId, record)
    }
    const jobs = [...jobsById].map(([id, record]) => ({ id, record }))
    if (!options.forceActive && jobs.some(({ record }) => record && isActive(record))) {
      throw new AppError('PHOTO_IN_USE', 'This photo is still being processed. Please wait for the preview to finish before deleting it.', 409)
    }

    const deletingJobIds = new Set(jobs.map(({ id }) => id))
    const otherJobs: PipelineJobRecord[] = []
    for (const key of await jsonFiles(storage, 'meta/pipeline-jobs/')) {
      const record = await storage.getJson<PipelineJobRecord>(key)
      if (record && !deletingJobIds.has(record.jobId)) otherJobs.push(record)
    }
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
    for (const key of await jsonFiles(storage, 'meta/results/')) {
      const resultKey = key.split('/').pop()?.replace(/\.json$/, '')
      if (!resultKey || !/^[a-f0-9]{64}$/.test(resultKey)) continue
      const resultMeta = await storage.getJson<{ photoId?: string }>(key)
      if (resultMeta?.photoId === photoId) resultsToDelete.add(resultKey)
    }
    for (const key of resultIndexKeys) {
      const indexed = await storage.getJson<{ key?: string }>(key)
      if (!indexed?.key || !/^[a-f0-9]{64}$/.test(indexed.key)) continue
      const resultMeta = await storage.getJson<{ photoId?: string }>(storage.resultMetaPath(indexed.key))
      if (resultMeta?.photoId === photoId) resultsToDelete.add(indexed.key)
    }
    for (const resultKey of resultsToDelete) {
      await deleteKey(storage, storage.resultPath(resultKey))
      await deleteKey(storage, storage.resultMetaPath(resultKey))
    }
    for (const key of jobIndexKeys) await deleteKey(storage, key)
    for (const key of resultIndexKeys) await deleteKey(storage, key)
    for (const key of requestIndexKeys) await deleteKey(storage, key)

    for (const { id, record } of jobs) {
      await deleteKey(storage, storage.pipelineJobPath(id))
      await deleteKey(storage, storage.jobPath(id))
      await deleteKey(storage, storage.finalisedMarkerPath(id))
      for (let index = 0; index < (record?.steps.length ?? 0); index++) {
        await deleteKey(storage, storage.finalisedMarkerPath(`${id}-${index}`))
      }
    }

    for (const key of cacheKeys) {
      if (retainedCacheKeys.has(key)) continue
      await deleteKey(storage, storage.stepCacheFilePath(key))
      await deleteKey(storage, storage.stepCacheMetaPath(key))
    }
    for (const fileId of youCamFileIds) {
      if (!retainedFileIds.has(fileId)) await deps.forgetFile(fileId)
    }

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
