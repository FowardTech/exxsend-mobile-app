/**
 * Cache Utilities - Handles clearing of legacy/shared cache keys
 * to prevent data leakage between user sessions.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

// Legacy non-user-scoped cache keys that must be cleared on login/signup
const LEGACY_CACHE_KEYS = [
  // Old account/balance caches (v1 - shared across users)
  "cached_accounts_v1",
  "cached_total_balance_v1",

  // Pending settlements (shared across users)
  "pending_settlements_v1",

  // Recent recipients (older builds)
  "recent_recipients_v1",
];

// Currency-specific balance caches (dynamically named)
const CACHED_WALLET_BALANCE_PREFIX = "cached_wallet_balance_";

/**
 * Clears all legacy/shared cache keys to ensure a new user
 * doesn't see previous user's data.
 *
 * Call this after successful login/signup, before navigating to HomeScreen.
 */
export async function clearLegacyCaches(): Promise<void> {
  try {
    await Promise.all(LEGACY_CACHE_KEYS.map((key) => AsyncStorage.removeItem(key)));

    const allKeys = await AsyncStorage.getAllKeys();
    const walletBalanceKeys = allKeys.filter((key) => key.startsWith(CACHED_WALLET_BALANCE_PREFIX));

    if (walletBalanceKeys.length > 0) {
      await AsyncStorage.multiRemove(walletBalanceKeys);
    }

    console.log("[CacheUtils] Cleared legacy caches:", {
      legacyKeys: LEGACY_CACHE_KEYS.length,
      walletBalanceKeys: walletBalanceKeys.length,
    });
  } catch (e) {
    console.log("[CacheUtils] Error clearing legacy caches:", e);
  }
}

/**
 * Clears user-scoped caches for a specific phone number.
 * Call this when switching users (if not doing a full logout).
 */
export async function clearUserScopedCaches(phone: string): Promise<void> {
  if (!phone) return;

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter((key) => key.includes(phone));

    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
      console.log("[CacheUtils] Cleared user-scoped caches for", phone, ":", userKeys.length);
    }
  } catch (e) {
    console.log("[CacheUtils] Error clearing user-scoped caches:", e);
  }
}

/** Check if legacy caches exist (for migration detection) */
export async function hasLegacyCaches(): Promise<boolean> {
  try {
    const results = await Promise.all(LEGACY_CACHE_KEYS.map((key) => AsyncStorage.getItem(key)));
    return results.some((value) => value !== null);
  } catch {
    return false;
  }
}
