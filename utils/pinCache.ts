import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PIN_CACHE_KEY = "cached_txn_pin";

/**
 * Caches the PIN securely (hardware-backed Keychain/Keystore via
 * expo-secure-store, not AsyncStorage) so a future biometric success can
 * auto-submit it to the backend's PIN-verify endpoint without the user
 * re-typing it. Only call this immediately after the backend has confirmed
 * the PIN is correct/has just been set (i.e. right after a successful
 * verifyPin or createPin call) — never cache an unverified guess.
 *
 * Only actually writes the cache if biometric_enabled is currently "true";
 * otherwise it's a no-op, so a user who has never opted into biometrics
 * never has their PIN cached at all.
 */
export async function cachePinIfBiometricEnabled(pin: string): Promise<void> {
  try {
    const bioEnabled = await AsyncStorage.getItem("biometric_enabled");
    if (bioEnabled === "true") {
      await SecureStore.setItemAsync(PIN_CACHE_KEY, pin, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  } catch {
    // Caching is a convenience feature — never let a failure here block the
    // actual PIN-change/verification flow that just succeeded.
  }
}

/** Returns the cached PIN, or null if none is cached / biometrics aren't enabled. */
export async function getCachedPin(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PIN_CACHE_KEY);
  } catch {
    return null;
  }
}

/**
 * Clears the cached PIN. Call this whenever biometrics are disabled (the
 * user opted out — a cached PIN should never persist after that) and
 * whenever the PIN changes but the new value hasn't been re-cached yet
 * (e.g. on failure partway through a change-PIN flow).
 */
export async function clearCachedPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_CACHE_KEY);
  } catch {
    // Already absent or platform error — nothing more to do.
  }
}
