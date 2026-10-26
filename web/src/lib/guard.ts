import { env } from './env'
import { AppError, ErrorCodes } from './errors'
import { StorageInstance } from './storage'

export interface GuardDeps {
  getBalance: () => Promise<number>
  storage: StorageInstance
  reserveFloor: number
  visitorCap: number
  now: () => Date
  getBudgetSnapshot?: () => Promise<{ balance: number; accountId: string }>
}

export function createGuard(deps: GuardDeps) {
  const { getBalance, storage, reserveFloor, visitorCap, now } = deps
  
  // Cache balance for 60 seconds
  let balanceCache: { value: number; timestamp: number } | null = null
  const BALANCE_CACHE_MS = 60 * 1000

  async function getCachedBalance(): Promise<number> {
    const currentTime = now().getTime()
    
    if (balanceCache && currentTime - balanceCache.timestamp < BALANCE_CACHE_MS) {
      return balanceCache.value
    }
    
    try {
      const balance = await getBalance()
      balanceCache = { value: balance, timestamp: currentTime }
      return balance
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCodes.INVALID_KEY) {
        throw error
      }
      // If balance check fails, assume worst case
      return 0
    }
  }

  async function assertCanSpend(visitorId: string, units: number): Promise<void> {
    // (a) Global balance check
    const balance = await getCachedBalance()
    
    if (balance - units < reserveFloor) {
      throw new AppError(
        ErrorCodes.BUDGET_RESERVED,
        `Insufficient balance: ${balance} units available, need ${units} units, reserve floor is ${reserveFloor}`,
        503,
        'Try-on is paused to save demo credits. Please use the sample photo.'
      )
    }
    
    // (b) Per-visitor daily cap
    const today = now().toISOString().split('T')[0] // yyyy-mm-dd
    const visitorKey = storage.visitorPath(visitorId, today)
    const visitorData = await storage.getJson<{ spent: number }>(visitorKey)
    const spentToday = visitorData?.spent || 0
    
    if (spentToday + units > visitorCap) {
      throw new AppError(
        ErrorCodes.VISITOR_CAP,
        `Visitor ${visitorId} has spent ${spentToday} units today, cannot spend ${units} more (cap: ${visitorCap})`,
        429,
        'Daily limit reached. Please try again tomorrow.'
      )
    }
  }

  async function recordSpend(visitorId: string, units: number): Promise<void> {
    const today = now().toISOString().split('T')[0]
    const visitorKey = storage.visitorPath(visitorId, today)
    const visitorData = await storage.getJson<{ spent: number }>(visitorKey)
    const spentToday = visitorData?.spent || 0
    
    await storage.putJson(visitorKey, {
      spent: spentToday + units,
      lastSpent: now().toISOString(),
    })
    
    // Invalidate balance cache
    balanceCache = null
  }

  /** Reserve attempts atomically before jobs are created. Failed/abandoned attempts remain capped. */
  async function reserveSpend(visitorId: string, units: number): Promise<void> {
    const action = async () => {
      const snapshot = deps.getBudgetSnapshot ? await deps.getBudgetSnapshot() : { balance: await getBalance(), accountId: 'default' }
      const today = now().toISOString().split('T')[0]
      const budgetKey = `budget/${snapshot.accountId}/${today}.json`
      const budget = await storage.getJson<{ available: number; observedBalance?: number }>(budgetKey)
      const restored = budget?.observedBalance !== undefined ? Math.max(0, snapshot.balance - budget.observedBalance) : 0
      const available = Math.min(snapshot.balance, budget ? budget.available + restored : snapshot.balance)
      if (available - units < reserveFloor) throw new AppError(ErrorCodes.BUDGET_RESERVED, 'Demo credits are reserved.', 503, 'Fresh previews are paused. Please explore a sample.')
      const visitorKey = storage.visitorPath(visitorId, today)
      if (storage.reserveVisitorUnits) {
        if (!(await storage.reserveVisitorUnits(visitorId, today, units, visitorCap))) throw new AppError(ErrorCodes.VISITOR_CAP, 'Daily preview limit reached.', 429)
      } else {
        const visitor = await storage.getJson<{ spent: number }>(visitorKey)
        if ((visitor?.spent || 0) + units > visitorCap) throw new AppError(ErrorCodes.VISITOR_CAP, 'Daily preview limit reached.', 429)
        await storage.putJson(visitorKey, { spent: (visitor?.spent || 0) + units, lastSpent: now().toISOString() })
      }
      // Conservative ledger protects the floor even if provider balances lag submitted work.
      await storage.putJson(budgetKey, { available: available - units, observedBalance: snapshot.balance })
      balanceCache = null
    }
    if (storage.withLock) await storage.withLock('budget-reservations', action)
    else await action()
  }

  async function getCurrentBalance(): Promise<number> {
    return getCachedBalance()
  }

  function invalidateBalanceCache(): void {
    balanceCache = null
  }

  return {
    assertCanSpend,
    recordSpend,
    getCurrentBalance,
    invalidateBalanceCache,
    reserveSpend,
  }
}

// Default dependencies
import { getBalance, getBudgetSnapshot } from './youcam'
import { defaultStorage } from './storage'

const defaultDeps: GuardDeps = {
  getBalance,
  getBudgetSnapshot,
  storage: defaultStorage,
  reserveFloor: env.UNIT_RESERVE_FLOOR,
  visitorCap: env.VISITOR_UNIT_CAP,
  now: () => new Date(),
}

// Default guard instance
export const guard = createGuard(defaultDeps)
export const { assertCanSpend, recordSpend, getCurrentBalance, invalidateBalanceCache, reserveSpend } = guard

