import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

// ── Cache helpers ────────────────────────────────────────────────────────────
// Mirrors the same per-phone caching convention used elsewhere in this app
// (e.g. api/investments.ts) — sanitize the phone number before using it as
// a cache key, since it can contain characters ('+', spaces) that aren't
// ideal as raw key suffixes.
function sanitizePhone(phone: string): string {
  return phone.replace(/[^a-zA-Z0-9]/g, "");
}

async function setCached(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface FeeWaiverQualifyingCurrency {
  currency: string;
  min_amount: number;
}

export interface FeeWaiverPromo {
  id: number;
  name: string;
  qualifyingCurrencies: FeeWaiverQualifyingCurrency[];
  requiredCount: number;
  windowDays: number;
  progress: number;
  remainingToEarn: number;
  waiveTarget: string;
}

export interface FeeWaiverCredit {
  id: number;
  promoId: number;
  usesRemaining: number;
  expiresAt: string;
  /** 'unused' | 'used' | 'expired' — informational only on the client;
   * totalFreeTransactions below is what actually gates the banner, not a
   * client-side count of entries with status:'unused'. */
  status?: "unused" | "used" | "expired";
}

export interface FeeWaiversResponse {
  success: boolean;
  totalFreeTransactions: number;
  promos: FeeWaiverPromo[];
  credits: FeeWaiverCredit[];
  qualifyingSendsCount?: number;
  message?: string;
}

const EMPTY_RESPONSE: FeeWaiversResponse = {
  success: false,
  totalFreeTransactions: 0,
  promos: [],
  credits: [],
};

/**
 * GET /api/fee-waivers/me — the user's current free-transaction credits and
 * progress toward earning more through any active promo. Read-only; the fee
 * waiver itself is applied server-side automatically by the send/transfer/
 * conversion endpoints, this is purely for showing the right UI (badges,
 * progress cards) beforehand.
 *
 * Fails closed: any fetch failure returns success:false (which
 * FeeWaiverBanner renders as nothing), rather than falling back to a
 * cached value. Caching here would risk showing a credit as still
 * available after it's actually been consumed, if the refresh that should
 * have caught that happens to hit a network blip.
 */
export async function fetchMyFeeWaivers(phone: string): Promise<FeeWaiversResponse> {
  if (!phone) return EMPTY_RESPONSE;
  const cacheKey = `fee-waivers:${sanitizePhone(phone)}`;

  try {
    const res = await fetch(`${API_BASE_URL}/fee-waivers/me?phone=${encodeURIComponent(phone)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.success !== false) {
      const result: FeeWaiversResponse = {
        success: true,
        totalFreeTransactions: Number(data?.totalFreeTransactions) || 0,
        promos: Array.isArray(data?.promos) ? data.promos : [],
        credits: Array.isArray(data?.credits) ? data.credits : [],
        qualifyingSendsCount: data?.qualifyingSendsCount != null ? Number(data.qualifyingSendsCount) : undefined,
      };
      setCached(cacheKey, result);
      return result;
    }

    // Non-2xx or success:false — fail closed (hide the banner) rather than
    // showing a possibly-stale cached value. A credit that was just used
    // server-side but hasn't been reflected here yet should disappear, not
    // keep showing as available until the next successful fetch happens
    // to catch up.
    return { ...EMPTY_RESPONSE, message: data?.message || `HTTP ${res.status}` };
  } catch (error: any) {
    return { ...EMPTY_RESPONSE, message: error?.message || "Network error" };
  }
}

/** The smallest qualifying minimum amount across a promo's currencies — used
 * to phrase the progress card ("Send 1 more USD 1,000+ transfer..."). */
export function getSmallestQualifyingAmount(promo: FeeWaiverPromo): FeeWaiverQualifyingCurrency | null {
  if (!promo.qualifyingCurrencies?.length) return null;
  return [...promo.qualifyingCurrencies].sort((a, b) => a.min_amount - b.min_amount)[0];
}
