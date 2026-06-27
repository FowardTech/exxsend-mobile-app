import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { API_BASE_URL } from "./config";

const DEVICE_UUID_KEY = "exxsend_device_uuid";

/** Pure-JS, no native module needed — a device identifier doesn't need
 * cryptographically-secure randomness, just enough entropy to be unique
 * per install. Avoids expo-crypto entirely, which previously crashed the
 * whole app at startup (this file is imported from app/_layout.tsx, so a
 * missing native module here took down everything, not just this
 * feature) whenever the native module wasn't linked yet. */
function generateRandomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Combines the platform's native vendor/install ID (survives reinstall on
 * iOS specifically — Android's equivalent does not survive reinstall the
 * same way) with a SecureStore-persisted random ID (which *does* reset
 * on reinstall). The combination is deliberate: it's what lets the
 * backend tell "same physical device, fresh install" apart from "brand
 * new device" in some cases, while still reliably triggering a fresh
 * verification after a reinstall since the SecureStore half always
 * resets then.
 */
export async function getDeviceId(): Promise<string> {
  let stored = await SecureStore.getItemAsync(DEVICE_UUID_KEY);
  if (!stored) {
    stored = generateRandomId();
    await SecureStore.setItemAsync(DEVICE_UUID_KEY, stored);
  }
  let native: string | null = null;
  try {
    native = Platform.OS === "ios"
      ? await Application.getIosIdForVendorAsync()
      : Application.getAndroidId();
  } catch {}
  return `${Platform.OS}:${native || "unknown"}:${stored}`;
}

function getDeviceMetadata() {
  return {
    deviceName: Device.deviceName || `${Platform.OS === "ios" ? "iPhone" : "Android device"}`,
    platform: Platform.OS,
    osVersion: Device.osVersion || String(Platform.Version || ""),
    appVersion: Application.nativeApplicationVersion || "",
    model: Device.modelName || "",
  };
}

export interface DeviceCheckInResult {
  success: boolean;
  isNewDevice?: boolean;
  trusted?: boolean;
  requiresVerification?: boolean;
  message?: string;
}

/**
 * Call on every app launch once a logged-in session is confirmed. Pass a
 * push token along when one's already on hand (registerPushTokenWithBackend
 * sends its own separately, so this is best-effort/optional here) so a
 * brand-new device check-in doesn't need a second round trip just to
 * attach push delivery.
 */
export async function checkInDevice(phone: string, pushToken?: string): Promise<DeviceCheckInResult> {
  try {
    const deviceId = await getDeviceId();
    const meta = getDeviceMetadata();
    const res = await fetch(`${API_BASE_URL}/devices/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, deviceId, ...meta, pushToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return { success: false, message: data?.message || `HTTP ${res.status}` };
    }
    return {
      success: true,
      isNewDevice: !!data.isNewDevice,
      trusted: !!data.trusted,
      requiresVerification: !!data.requiresVerification,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Could not check in this device" };
  }
}

/** Marks this device trusted after the SMS OTP step succeeds. */
export async function verifyDevice(phone: string): Promise<{ success: boolean; message?: string }> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${API_BASE_URL}/devices/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, deviceId, otpVerified: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return { success: false, message: data?.message || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error?.message || "Could not verify this device" };
  }
}

export interface DeviceTrustCheckResult {
  success: boolean;
  allowed?: boolean;
  message?: string;
}

/**
 * Gate before every transaction submit (send/withdraw/convert/fund) — if
 * allowed is false, the caller should bounce the user to the verify-device
 * screen instead of letting the transaction through.
 */
export async function checkDeviceTrust(phone: string): Promise<DeviceTrustCheckResult> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${API_BASE_URL}/devices/trust-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, deviceId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      // Fails closed on a network/server error — better to ask for
      // re-verification unnecessarily than to silently let a transaction
      // through a trust check that couldn't actually be confirmed.
      return { success: false, allowed: false, message: data?.message || `HTTP ${res.status}` };
    }
    return { success: true, allowed: !!data.allowed };
  } catch (error: any) {
    return { success: false, allowed: false, message: error?.message || "Could not verify this device" };
  }
}

export interface DeviceRecord {
  deviceId: string;
  deviceName?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  model?: string;
  trusted?: boolean;
  lastSeenAt?: string;
  isCurrent?: boolean;
  [key: string]: any;
}

export async function listDevices(phone: string): Promise<{ success: boolean; devices: DeviceRecord[]; message?: string }> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${API_BASE_URL}/devices/list?phone=${encodeURIComponent(phone)}&deviceId=${encodeURIComponent(deviceId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return { success: false, devices: [], message: data?.message || `HTTP ${res.status}` };
    }
    const rawList = Array.isArray(data?.devices) ? data.devices : [];
    const devices: DeviceRecord[] = rawList.map((d: any) => ({
      ...d,
      deviceId: d.deviceId ?? d.device_id,
      isCurrent: (d.deviceId ?? d.device_id) === deviceId,
    }));
    return { success: true, devices };
  } catch (error: any) {
    return { success: false, devices: [], message: error?.message || "Could not load devices" };
  }
}

export async function revokeDevice(phone: string, targetDeviceId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/devices/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, deviceId: targetDeviceId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return { success: false, message: data?.message || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error?.message || "Could not revoke this device" };
  }
}
