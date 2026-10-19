import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGuard } from '@/lib/guard'
import { createStorage } from '@/lib/storage'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { AppError, ErrorCodes } from '@/lib/errors'

describe('Guard Service', () => {
  let tempDir: string
  let storage: ReturnType<typeof createStorage>
  let guard: ReturnType<typeof createGuard>
  let mockNow: Date
  let mockGetBalance: ReturnType<typeof vi.fn>

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darpan-test-'))
    storage = createStorage({ rootDir: tempDir })
    mockNow = new Date('2024-01-01T10:00:00Z')
    mockGetBalance = vi.fn()
    
    guard = createGuard({
      getBalance: mockGetBalance,
      storage,
      reserveFloor: 10, // Reserve floor of 10 units
      visitorCap: 5, // Visitor cap of 5 units per day
      now: () => mockNow,
    })
  })

  afterEach(() => {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  describe('assertCanSpend', () => {
    it('should allow spending when balance > reserve floor', async () => {
      mockGetBalance.mockResolvedValue(100) // 100 units available
      
      await expect(guard.assertCanSpend('visitor-1', 1))
        .resolves.toBeUndefined()
      
      expect(mockGetBalance).toHaveBeenCalledTimes(1)
    })

    it('should block spending when balance - units < reserve floor', async () => {
      mockGetBalance.mockResolvedValue(15) // 15 units available
      // 15 - 6 = 9, which is less than reserve floor (10)
      
      await expect(guard.assertCanSpend('visitor-1', 6))
        .rejects.toThrow(AppError)
      
      const error = await guard.assertCanSpend('visitor-1', 6).catch(e => e)
      expect(error.code).toBe(ErrorCodes.BUDGET_RESERVED)
      expect(error.httpStatus).toBe(503)
      // Should only call getBalance once due to caching
      expect(mockGetBalance).toHaveBeenCalledTimes(1)
    })

    it('should enforce visitor daily cap', async () => {
      mockGetBalance.mockResolvedValue(1000) // Plenty of balance
      
      // First 5 units should be allowed and recorded
      for (let i = 0; i < 5; i++) {
        await guard.assertCanSpend('visitor-2', 1)
        await guard.recordSpend('visitor-2', 1)
      }
      
      // 6th unit should be blocked
      await expect(guard.assertCanSpend('visitor-2', 1))
        .rejects.toThrow(AppError)
      
      const error = await guard.assertCanSpend('visitor-2', 1).catch(e => e)
      expect(error.code).toBe(ErrorCodes.VISITOR_CAP)
      expect(error.httpStatus).toBe(429)
      
      // Different visitor should still be allowed
      await expect(guard.assertCanSpend('visitor-3', 1))
        .resolves.toBeUndefined()
    })

    it('should reset visitor cap on new day', async () => {
      mockGetBalance.mockResolvedValue(1000)
      
      // Use up the cap for today
      for (let i = 0; i < 5; i++) {
        await guard.assertCanSpend('visitor-4', 1)
        await guard.recordSpend('visitor-4', 1)
      }
      
      // Should be blocked
      await expect(guard.assertCanSpend('visitor-4', 1))
        .rejects.toThrow(AppError)
      
      // Move to next day
      mockNow = new Date('2024-01-02T10:00:00Z')
      guard = createGuard({
        getBalance: mockGetBalance,
        storage,
        reserveFloor: 10,
        visitorCap: 5,
        now: () => mockNow,
      })
      
      // Should be allowed again
      await expect(guard.assertCanSpend('visitor-4', 1))
        .resolves.toBeUndefined()
    })

    it('should cache balance for 60 seconds', async () => {
      mockGetBalance.mockResolvedValue(50)
      
      // First call should fetch balance
      await guard.assertCanSpend('visitor-5', 1)
      expect(mockGetBalance).toHaveBeenCalledTimes(1)
      
      // Second call within 60s should use cache
      await guard.assertCanSpend('visitor-5', 1)
      expect(mockGetBalance).toHaveBeenCalledTimes(1) // Still 1
      
      // Move forward 61 seconds
      const originalTime = mockNow.getTime()
      mockNow = new Date(originalTime + 61 * 1000)
      guard = createGuard({
        getBalance: mockGetBalance,
        storage,
        reserveFloor: 10,
        visitorCap: 5,
        now: () => mockNow,
      })
      
      // Should fetch balance again
      await guard.assertCanSpend('visitor-5', 1)
      expect(mockGetBalance).toHaveBeenCalledTimes(2)
    })
  })

  describe('recordSpend', () => {
    it('should record spend and accumulate per visitor per day', async () => {
      mockGetBalance.mockResolvedValue(1000)
      
      await guard.assertCanSpend('visitor-6', 2)
      await guard.recordSpend('visitor-6', 2)
      
      await guard.assertCanSpend('visitor-6', 2)
      await guard.recordSpend('visitor-6', 2)
      
      // Total spent should be 4, so 1 more unit should be allowed (cap is 5)
      await expect(guard.assertCanSpend('visitor-6', 1))
        .resolves.toBeUndefined()
      
      // But 2 more units should be blocked (would make total 6 > 5)
      await guard.recordSpend('visitor-6', 1)
      await expect(guard.assertCanSpend('visitor-6', 2))
        .rejects.toThrow(AppError)
    })

    it('should invalidate balance cache when recording spend', async () => {
      mockGetBalance.mockResolvedValueOnce(100)
        .mockResolvedValueOnce(99) // After spending 1 unit
      
      await guard.assertCanSpend('visitor-7', 1)
      expect(mockGetBalance).toHaveBeenCalledTimes(1)
      
      await guard.recordSpend('visitor-7', 1)
      
      // Balance cache should be invalidated, so next check should fetch again
      await guard.assertCanSpend('visitor-8', 1)
      expect(mockGetBalance).toHaveBeenCalledTimes(2)
    })
  })

  describe('getCurrentBalance', () => {
    it('should return cached balance', async () => {
      mockGetBalance.mockResolvedValue(75)
      
      const balance1 = await guard.getCurrentBalance()
      expect(balance1).toBe(75)
      expect(mockGetBalance).toHaveBeenCalledTimes(1)
      
      const balance2 = await guard.getCurrentBalance()
      expect(balance2).toBe(75)
      expect(mockGetBalance).toHaveBeenCalledTimes(1) // Still cached
    })
  })
})