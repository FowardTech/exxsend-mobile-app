import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_SETTLEMENTS_KEY = 'pending_settlements_v1';
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const MAX_PENDING_AGE_MS = 30 * 60 * 1000; // Remove pending entries older than 30 minutes

export interface PendingSettlement {
  id: string;
  sellCurrency: string;
  buyCurrency: string;
  sellAmount: number;
  buyAmount: number;
  createdAt: number;
  conversionId?: string;
}

export interface PendingSettlementsByWallet {
  [currencyCode: string]: {
    pendingDebit: number;  // Amount being deducted (show as negative adjustment)
    pendingCredit: number; // Amount being added (show as positive adjustment)
    hasPending: boolean;
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
export async function addPendingSettlement(settlement: Omit<PendingSettlement, 'id' | 'createdAt'>): Promise<void> {
  try {
    const existing = await loadPendingSettlements();
    const newSettlement: PendingSettlement = {
      ...settlement,
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
    const existing = await loadPendingSettlements();
    const filtered = existing.filter(
      s => s.sellCurrency !== currencyCode && s.buyCurrency !== currencyCode
    );
    await AsyncStorage.setItem(PENDING_SETTLEMENTS_KEY, JSON.stringify(filtered));
    console.log('[PendingSettlements] Cleared for currency:', currencyCode);
  } catch (e) {
    console.log('[PendingSettlements] Failed to clear:', e);
  }
}

// Aggregate pending settlements by currency
export function aggregatePendingByCurrency(settlements: PendingSettlement[]): PendingSettlementsByWallet {
  const result: PendingSettlementsByWallet = {};
  
  for (const s of settlements) {
    // Debit from sell currency
    if (!result[s.sellCurrency]) {
      result[s.sellCurrency] = { pendingDebit: 0, pendingCredit: 0, hasPending: false };
    }
    result[s.sellCurrency].pendingDebit += s.sellAmount;
    result[s.sellCurrency].hasPending = true;
    
    // Credit to buy currency
    if (!result[s.buyCurrency]) {
      result[s.buyCurrency] = { pendingDebit: 0, pendingCredit: 0, hasPending: false };
    }
    result[s.buyCurrency].pendingCredit += s.buyAmount;
    result[s.buyCurrency].hasPending = true;
  }
  
  return result;
}

// Calculate optimistic balance
export function getOptimisticBalance(
  actualBalance: number,
  currencyCode: string,
  pendingByCurrency: PendingSettlementsByWallet
): number {
  const pending = pendingByCurrency[currencyCode];
  if (!pending) return actualBalance;
  
  return actualBalance - pending.pendingDebit + pending.pendingCredit;
}

// Check if a currency has pending settlements
export function hasPendingSettlement(
  currencyCode: string, 
  pendingByCurrency: PendingSettlementsByWallet
): boolean {
  return !!pendingByCurrency[currencyCode]?.hasPending;
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
  
  // Load settlements on mount
  const refresh = useCallback(async () => {
    const loaded = await loadPendingSettlements();
    setSettlements(loaded);
    setPendingByCurrency(aggregatePendingByCurrency(loaded));
  }, []);
  
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  // Start/stop polling based on whether there are pending settlements
  useEffect(() => {
    const hasPending = settlements.length > 0;
    
    if (hasPending && pollingEnabled && !pollIntervalRef.current) {
      console.log('[PendingSettlements] Starting polling...');
      setIsPolling(true);
      
      pollIntervalRef.current = setInterval(async () => {
        // Refresh settlements list
        const current = await loadPendingSettlements();
        
        if (current.length === 0) {
          // All settled
          console.log('[PendingSettlements] All settlements confirmed');
          setSettlements([]);
          setPendingByCurrency({});
          setIsPolling(false);
          
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          onSettlementConfirmed?.();
        } else {
          setSettlements(current);
          setPendingByCurrency(aggregatePendingByCurrency(current));
        }
      }, POLL_INTERVAL_MS);
    } else if (!hasPending && pollIntervalRef.current) {
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
  }, [settlements.length, pollingEnabled, onSettlementConfirmed]);
  
  // Add a new pending settlement
  const addSettlement = useCallback(async (
    settlement: Omit<PendingSettlement, 'id' | 'createdAt'>
  ) => {
    await addPendingSettlement(settlement);
    await refresh();
  }, [refresh]);
  
  // Remove a settlement
  const removeSettlement = useCallback(async (id: string) => {
    await removePendingSettlement(id);
    await refresh();
  }, [refresh]);
  
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