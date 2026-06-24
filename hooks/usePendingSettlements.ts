import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_SETTLEMENTS_KEY = 'pending_settlements_v1';
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const MAX_PENDING_AGE_MS = 30 * 60 * 1000; // Remove pending entries older than 30 minutes

export const normalizeCurrencyCode = (code: string) =>
  String(code || '').toUpperCase().trim();

export interface PendingSettlement {
  id: string;
  sellCurrency: string;
  buyCurrency: string;
  sellAmount: number;
  buyAmount: number;
  createdAt: number;
  conversionId?: string;

  /**
   * Optional baseline balances captured at conversion time.
   * Used to confirm settlement without double-applying optimistic deltas.
   */
  sellBalanceBefore?: number;
  buyBalanceBefore?: number;
}

export interface PendingSettlementsByWallet {
  [currencyCode: string]: {
    pendingDebit: number;  // Amount being deducted (show as negative adjustment)
    pendingCredit: number; // Amount being added (show as positive adjustment)
    hasPending: boolean;
    // Baselines: used to detect if API already reflects the settlement
    sellBalanceBefore?: number;
    buyBalanceBefore?: number;
  };
}

// Load pending settlements from storage
export async function loadPendingSettlements(): Promise<PendingSettlement[]> {
  try {
    const data = await AsyncStorage.getItem(PENDING_SETTLEMENTS_KEY);
    if (!data) return [];
    
    const settlements: PendingSettlement[] = JSON.parse(data);
    const now = Date.now();
    
    // Filter out expired entries
    const valid = settlements.filter(s => (now - s.createdAt) < MAX_PENDING_AGE_MS);
    
    // Save cleaned list if we removed any
    if (valid.length !== settlements.length) {
      await AsyncStorage.setItem(PENDING_SETTLEMENTS_KEY, JSON.stringify(valid));
    }
    
    return valid;
  } catch (e) {
    console.log('[PendingSettlements] Failed to load:', e);
    return [];
  }
}

// Save a new pending settlement
export async function addPendingSettlement(
  settlement: Omit<PendingSettlement, 'id' | 'createdAt'>
): Promise<void> {
  try {
    const existing = await loadPendingSettlements();

    const sellCurrency = normalizeCurrencyCode(settlement.sellCurrency);
    const buyCurrency = normalizeCurrencyCode(settlement.buyCurrency);

    const newSettlement: PendingSettlement = {
      ...settlement,
      sellCurrency,
      buyCurrency,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
    };

    await AsyncStorage.setItem(
      PENDING_SETTLEMENTS_KEY,
      JSON.stringify([newSettlement, ...existing])
    );

    console.log('[PendingSettlements] Added:', newSettlement);
  } catch (e) {
    console.log('[PendingSettlements] Failed to add:', e);
  }
}

// Remove a pending settlement (called when balance confirmed)
export async function removePendingSettlement(id: string): Promise<void> {
  try {
    const existing = await loadPendingSettlements();
    const filtered = existing.filter(s => s.id !== id);
    await AsyncStorage.setItem(PENDING_SETTLEMENTS_KEY, JSON.stringify(filtered));
    console.log('[PendingSettlements] Removed:', id);
  } catch (e) {
    console.log('[PendingSettlements] Failed to remove:', e);
  }
}

// Clear all pending settlements for a currency (when balance matches expected)
export async function clearPendingForCurrency(currencyCode: string): Promise<void> {
  try {
    const target = normalizeCurrencyCode(currencyCode);
    const existing = await loadPendingSettlements();
    const filtered = existing.filter((s) => {
      const sell = normalizeCurrencyCode(s.sellCurrency);
      const buy = normalizeCurrencyCode(s.buyCurrency);
      return sell !== target && buy !== target;
    });
    await AsyncStorage.setItem(PENDING_SETTLEMENTS_KEY, JSON.stringify(filtered));
    console.log('[PendingSettlements] Cleared for currency:', target);
  } catch (e) {
    console.log('[PendingSettlements] Failed to clear:', e);
  }
}

// Aggregate pending settlements by currency
export function aggregatePendingByCurrency(settlements: PendingSettlement[]): PendingSettlementsByWallet {
  const result: PendingSettlementsByWallet = {};

  for (const s of settlements) {
    const sell = normalizeCurrencyCode(s.sellCurrency);
    const buy = normalizeCurrencyCode(s.buyCurrency);

    // Debit from sell currency
    if (!result[sell]) {
      result[sell] = { pendingDebit: 0, pendingCredit: 0, hasPending: false };
    }
    result[sell].pendingDebit += Number(s.sellAmount || 0);
    result[sell].hasPending = true;
    // Track baseline for sell side
    if (typeof s.sellBalanceBefore === 'number') {
      result[sell].sellBalanceBefore = s.sellBalanceBefore;
    }

    // Credit to buy currency
    if (!result[buy]) {
      result[buy] = { pendingDebit: 0, pendingCredit: 0, hasPending: false };
    }
    result[buy].pendingCredit += Number(s.buyAmount || 0);
    result[buy].hasPending = true;
    // Track baseline for buy side
    if (typeof s.buyBalanceBefore === 'number') {
      result[buy].buyBalanceBefore = s.buyBalanceBefore;
    }
  }

  return result;
}

export async function clearAllPendingSettlements(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_SETTLEMENTS_KEY, JSON.stringify([]));
    console.log('[PendingSettlements] Cleared ALL pending settlements');
  } catch (e) {
    console.log('[PendingSettlements] Failed to clear all:', e);
  }
}

// Calculate optimistic balance - only applies delta if API hasn't already settled
// export function getOptimisticBalance(
//   actualBalance: number,
//   currencyCode: string,
//   pendingByCurrency: PendingSettlementsByWallet
// ): number {
//   const key = normalizeCurrencyCode(currencyCode);
//   const pending = pendingByCurrency[key];
//   if (!pending) return actualBalance;

//   const tolerance = 0.01;

//   // For DEBIT (sell side): only adjust if we have baseline AND balance hasn't changed
//   if (pending.pendingDebit > 0) {
//     if (typeof pending.sellBalanceBefore === 'number') {
//       // Check if balance is still at baseline (not yet settled by API)
//       if (Math.abs(actualBalance - pending.sellBalanceBefore) < tolerance) {
//         // API hasn't settled yet - show optimistic (debited) balance
//         return pending.sellBalanceBefore - pending.pendingDebit;
//       }
//       // API already shows different balance - trust the API
//       return actualBalance;
//     }
//     // No baseline stored - trust actual balance (don't guess)
//     return actualBalance;
//   }

//   // For CREDIT (buy side): only adjust if we have baseline AND balance hasn't changed
//   if (pending.pendingCredit > 0) {
//     if (typeof pending.buyBalanceBefore === 'number') {
//       // Check if balance is still at baseline (not yet settled by API)
//       if (Math.abs(actualBalance - pending.buyBalanceBefore) < tolerance) {
//         // API hasn't settled yet - show optimistic (credited) balance
//         return pending.buyBalanceBefore + pending.pendingCredit;
//       }
//       // API already shows different balance - trust the API
//       return actualBalance;
//     }
//     // No baseline stored - trust actual balance (don't guess)
//     return actualBalance;
//   }

//   return actualBalance;
// }

export function getOptimisticBalance(
  actualBalance: number,
  currencyCode: string,
  pendingByCurrency: PendingSettlementsByWallet
): number {
  // DEPRECATED: Always return actual balance - no more optimistic adjustments
  return actualBalance;
}

// Check if a currency has pending settlements
export function hasPendingSettlement(
  currencyCode: string,
  pendingByCurrency: PendingSettlementsByWallet
): boolean {
  const key = normalizeCurrencyCode(currencyCode);
  return !!pendingByCurrency[key]?.hasPending;
}

/**
 * React Hook for managing pending settlements with auto-polling
 */
export function usePendingSettlements(
  onSettlementConfirmed?: () => void,
  pollingEnabled: boolean = true
) {
  const [settlements, setSettlements] = useState<PendingSettlement[]>([]);
  const [pendingByCurrency, setPendingByCurrency] = useState<PendingSettlementsByWallet>({});
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep latest callback in a ref to avoid re-triggering the polling effect
  // when the caller passes an inline arrow function (which changes every render).
  const onSettlementConfirmedRef = useRef<(() => void) | undefined>(onSettlementConfirmed);
  useEffect(() => {
    onSettlementConfirmedRef.current = onSettlementConfirmed;
  }, [onSettlementConfirmed]);

  // Load settlements on mount - returns fresh settlements for caller to use
  const refresh = useCallback(async (): Promise<PendingSettlement[]> => {
    const loaded = await loadPendingSettlements();
    // Only update state if settlements actually changed (prevent unnecessary re-renders)
    setSettlements((prev) => {
      const prevIds = prev.map((s) => s.id).sort().join(',');
      const loadedIds = loaded.map((s) => s.id).sort().join(',');
      if (prevIds === loadedIds) return prev; // No change
      return loaded;
    });
    setPendingByCurrency(aggregatePendingByCurrency(loaded));
    return loaded; // Return fresh data for caller
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Start/stop polling based on whether there are pending settlements.
  // IMPORTANT: do NOT depend on onSettlementConfirmed directly; use the ref instead.
  useEffect(() => {
    const hasPending = settlements.length > 0;

    if (hasPending && pollingEnabled && !pollIntervalRef.current) {
      console.log('[PendingSettlements] Starting polling...');
      setIsPolling(true);

      pollIntervalRef.current = setInterval(async () => {
        const current = await loadPendingSettlements();

        if (current.length === 0) {
          console.log('[PendingSettlements] All settlements confirmed');
          setSettlements([]);
          setPendingByCurrency({});
          setIsPolling(false);

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          onSettlementConfirmedRef.current?.();
        } else {
          // Only update state if settlements actually changed (prevent flicker from redundant updates)
          setSettlements((prev) => {
            const prevIds = prev.map((s) => s.id).sort().join(',');
            const currentIds = current.map((s) => s.id).sort().join(',');
            if (prevIds === currentIds) return prev;
            return current;
          });
          setPendingByCurrency(aggregatePendingByCurrency(current));
        }
      }, POLL_INTERVAL_MS);
    } else if ((!hasPending || !pollingEnabled) && pollIntervalRef.current) {
      console.log('[PendingSettlements] Stopping polling');
      setIsPolling(false);
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [settlements.length, pollingEnabled]);

  // Add a new pending settlement
  const addSettlement = useCallback(async (
    settlement: Omit<PendingSettlement, 'id' | 'createdAt'>
  ) => {
    await addPendingSettlement(settlement);
    await refresh();
  }, [refresh]);

  // Remove a settlement and optionally show notification
  const removeSettlement = useCallback(async (id: string, showNotification: boolean = false) => {
    // Find the settlement before removing it (for notification)
    if (showNotification) {
      const settlement = settlements.find((s) => s.id === id);
      if (settlement) {
        try {
          // Dynamically import to avoid circular dependencies
          const { showSettlementNotification } = await import('../services/pushNotifications');
          await showSettlementNotification(
            settlement.sellCurrency,
            settlement.buyCurrency,
            settlement.sellAmount,
            settlement.buyAmount,
            settlement.conversionId
          );
        } catch (e) {
          console.log('[PendingSettlements] Failed to show notification:', e);
        }
      }
    }

    await removePendingSettlement(id);
    await refresh();
  }, [refresh, settlements]);

  // Check balance and clear if confirmed
  const checkAndClearIfSettled = useCallback(async (
    currencyCode: string,
    actualBalance: number,
    expectedBalance: number,
    tolerance: number = 0.01
  ) => {
    const diff = Math.abs(actualBalance - expectedBalance);
    if (diff <= tolerance) {
      await clearPendingForCurrency(currencyCode);
      await refresh();
      return true;
    }
    return false;
  }, [refresh]);

  return {
    settlements,
    pendingByCurrency,
    isPolling,
    hasPending: settlements.length > 0,
    refresh,
    addSettlement,
    removeSettlement,
    checkAndClearIfSettled,
    getOptimisticBalance: (balance: number, currency: string) => 
      getOptimisticBalance(balance, currency, pendingByCurrency),
    hasPendingForCurrency: (currency: string) => 
      hasPendingSettlement(currency, pendingByCurrency),
  };
}

export default usePendingSettlements;