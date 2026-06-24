/**
 * useSyncedWallets Hook - Database-First Wallet Data
 * 
 * This hook provides wallet data that ALWAYS comes from the database,
 * eliminating flickering and null balance issues.
 * 
 * Features:
 * - Immediate cache load on mount (stale-while-revalidate)
 * - Background sync with external APIs
 * - Auto-polling for real-time updates
 * - Never returns null balances
 * 
 * Usage:
 * ```tsx
 * const { wallets, totalBalance, loading, refresh } = useSyncedWallets(userPhone);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import {
  getSyncedWallets,
  getSyncedTotalBalance,
  SyncedWallet,
  WalletsResponse,
  TotalBalanceResponse,
} from '../api/sync';

// Cache key prefixes - will be scoped by user phone
const SYNCED_WALLETS_PREFIX = 'synced_wallets_';
const SYNCED_TOTAL_PREFIX = 'synced_total_';

// Polling interval (10 seconds)
const POLL_INTERVAL_MS = 10000;

// Helper to create user-scoped cache keys
const getUserCacheKey = (prefix: string, phone: string | null): string => {
  if (!phone) return `${prefix}anonymous`;
  // Sanitize phone for use as cache key
  const sanitized = phone.replace(/[^a-zA-Z0-9]/g, '_');
  return `${prefix}${sanitized}`;
};

export interface UseSyncedWalletsResult {
  wallets: SyncedWallet[];
  totalBalance: number;
  currency: string;
  currencySymbol: string;
  loading: boolean;
  refreshing: boolean;
  lastUpdated: string | null;
  error: string | null;
  refresh: () => Promise<void>;
  getWalletBalance: (currencyCode: string) => number;
}

export function useSyncedWallets(phone: string | null): UseSyncedWalletsResult {
  const [wallets, setWallets] = useState<SyncedWallet[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [currencySymbol, setCurrencySymbol] = useState<string>('$');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);
  const hasLoadedCacheRef = useRef<boolean>(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentPhoneRef = useRef<string | null>(null);

  // ============ CACHE HELPERS ============

  const loadCachedWallets = useCallback(async (userPhone: string | null): Promise<SyncedWallet[]> => {
    try {
      const cacheKey = getUserCacheKey(SYNCED_WALLETS_PREFIX, userPhone);
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.log('[useSyncedWallets] Cache load error:', e);
    }
    return [];
  }, []);

  const saveCachedWallets = useCallback(async (data: SyncedWallet[], userPhone: string | null): Promise<void> => {
    try {
      const cacheKey = getUserCacheKey(SYNCED_WALLETS_PREFIX, userPhone);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
      console.log('[useSyncedWallets] Cache save error:', e);
    }
  }, []);

  const loadCachedTotal = useCallback(async (userPhone: string | null): Promise<{
    total: number;
    currency: string;
    symbol: string;
  } | null> => {
    try {
      const cacheKey = getUserCacheKey(SYNCED_TOTAL_PREFIX, userPhone);
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.total === 'number') return parsed;
      }
    } catch (e) {
      console.log('[useSyncedWallets] Total cache load error:', e);
    }
    return null;
  }, []);

  const saveCachedTotal = useCallback(
    async (total: number, curr: string, sym: string, userPhone: string | null): Promise<void> => {
      try {
        const cacheKey = getUserCacheKey(SYNCED_TOTAL_PREFIX, userPhone);
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ total, currency: curr, symbol: sym })
        );
      } catch (e) {
        console.log('[useSyncedWallets] Total cache save error:', e);
      }
    },
    []
  );

  // ============ FETCH DATA ============

  const fetchWallets = useCallback(
    async (triggerRefresh: boolean = true): Promise<void> => {
      if (!phone || isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      setError(null);

      try {
        // Fetch wallets and total in parallel
        const [walletsRes, totalRes] = await Promise.all([
          getSyncedWallets(phone, triggerRefresh),
          getSyncedTotalBalance(phone),
        ]);

        // Process wallets response
        if (walletsRes.success && walletsRes.wallets.length > 0) {
          setWallets(walletsRes.wallets);
          setLastUpdated(walletsRes.lastUpdated);
          await saveCachedWallets(walletsRes.wallets, phone);
          
          // Use wallet total if available
          if (walletsRes.totalBalance > 0) {
            setTotalBalance(walletsRes.totalBalance);
            setCurrency(walletsRes.currency);
          }
        } else if (walletsRes.message) {
          console.log('[useSyncedWallets] Wallets warning:', walletsRes.message);
        }

        // Process total balance response
        if (totalRes.success) {
          setTotalBalance(totalRes.totalBalance);
          setCurrency(totalRes.currency);
          setCurrencySymbol(totalRes.currencySymbol);
          setLastUpdated(totalRes.lastUpdated);
          await saveCachedTotal(totalRes.totalBalance, totalRes.currency, totalRes.currencySymbol, phone);
        }
      } catch (e: any) {
        console.error('[useSyncedWallets] Fetch error:', e.message);
        setError(e.message || 'Failed to fetch data');
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [phone, saveCachedWallets, saveCachedTotal]
  );

  // ============ MANUAL REFRESH ============

  const refresh = useCallback(async (): Promise<void> => {
    if (!phone) return;
    setRefreshing(true);
    await fetchWallets(true);
  }, [phone, fetchWallets]);

  // ============ GET WALLET BALANCE HELPER ============

  const getWalletBalance = useCallback(
    (currencyCode: string): number => {
      const wallet = wallets.find(
        (w) => w.currencyCode.toUpperCase() === currencyCode.toUpperCase()
      );
      return wallet?.balance ?? 0;
    },
    [wallets]
  );

  // ============ LOAD CACHED DATA WHEN PHONE CHANGES ============

  useEffect(() => {
    // Reset state when phone changes (user switch)
    if (currentPhoneRef.current !== phone) {
      currentPhoneRef.current = phone;
      hasLoadedCacheRef.current = false;
      
      // Clear state for new user
      setWallets([]);
      setTotalBalance(0);
      setLoading(true);
    }

    if (!phone || hasLoadedCacheRef.current) return;
    hasLoadedCacheRef.current = true;

    const loadCache = async () => {
      console.log('[useSyncedWallets] Loading cached data for user:', phone);

      const cachedWallets = await loadCachedWallets(phone);
      if (cachedWallets.length > 0) {
        console.log('[useSyncedWallets] Using cached wallets:', cachedWallets.length);
        setWallets(cachedWallets);
        setLoading(false); // Show cached data immediately
      }

      const cachedTotal = await loadCachedTotal(phone);
      if (cachedTotal) {
        console.log('[useSyncedWallets] Using cached total:', cachedTotal.total);
        setTotalBalance(cachedTotal.total);
        setCurrency(cachedTotal.currency);
        setCurrencySymbol(cachedTotal.symbol);
      }
    };

    loadCache();
  }, [phone, loadCachedWallets, loadCachedTotal]);

  // ============ FETCH FRESH DATA WHEN PHONE AVAILABLE ============

  useEffect(() => {
    if (phone) {
      fetchWallets(true);
    }
  }, [phone, fetchWallets]);

  // ============ AUTO-POLLING ============

  useEffect(() => {
    if (!phone) return;

    // Start polling
    pollIntervalRef.current = setInterval(() => {
      fetchWallets(false); // Don't trigger background sync on polls
    }, POLL_INTERVAL_MS);

    // Pause polling when app is in background
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active' && pollIntervalRef.current === null) {
        // Resume polling
        pollIntervalRef.current = setInterval(() => {
          fetchWallets(false);
        }, POLL_INTERVAL_MS);
      } else if (state !== 'active' && pollIntervalRef.current) {
        // Pause polling
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      subscription.remove();
    };
  }, [phone, fetchWallets]);

  return {
    wallets,
    totalBalance,
    currency,
    currencySymbol,
    loading,
    refreshing,
    lastUpdated,
    error,
    refresh,
    getWalletBalance,
  };
}

/**
 * Helper to convert SyncedWallet to legacy UserAccount format
 * for backward compatibility with existing screens.
 */
export function toUserAccount(wallet: SyncedWallet): {
  id: string;
  currencyCode: string;
  accountName: string;
  balance: number;
  status: string;
  isExotic: boolean;
  currency: {
    code: string;
    name: string;
    countryName: string | null;
    flag: string;
    symbol: string;
    isExotic: boolean;
  } | null;
} {
  return {
    id: String(wallet.id),
    currencyCode: wallet.currencyCode,
    accountName: wallet.currencyName,
    balance: wallet.balance,
    status: wallet.status,
    isExotic: wallet.isExotic,
    currency: {
      code: wallet.currencyCode,
      name: wallet.currencyName,
      countryName: wallet.countryName,
      flag: wallet.flag,
      symbol: wallet.symbol,
      isExotic: wallet.isExotic,
    },
  };
}