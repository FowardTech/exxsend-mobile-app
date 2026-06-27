import { useCallback } from "react";
import { useRouter, usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { checkDeviceTrust } from "@/api/devices";

/**
 * Call right before submitting any transaction (send/withdraw/convert/
 * fund). Returns true if the transaction should proceed, false if it
 * should be aborted — in the false case, this has already bounced the
 * user to the verify-device screen with a redirectTo back to the current
 * screen, so the caller just needs to stop and return.
 */
export function useDeviceTrustGate() {
  const router = useRouter();
  const pathname = usePathname();

  const ensureDeviceTrusted = useCallback(async (phoneOverride?: string): Promise<boolean> => {
    const phone = phoneOverride || (await AsyncStorage.getItem("user_phone")) || "";
    if (!phone) return true; // No phone on hand — let the normal auth gate handle it elsewhere.

    const result = await checkDeviceTrust(phone);
    if (result.allowed) return true;

    if (!result.success) {
      // Couldn't even reach the trust-check itself (network/server
      // error) — fails closed rather than silently letting the
      // transaction through unverified.
      Alert.alert("Couldn't verify this device", "Please check your connection and try again.");
      return false;
    }

    router.push({
      pathname: "/verifydevice" as any,
      params: { redirectTo: encodeURIComponent(pathname || "/(tabs)") } as any,
    });
    return false;
  }, [router, pathname]);

  return { ensureDeviceTrusted };
}
