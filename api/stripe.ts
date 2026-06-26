/**
 * Stripe card top-up API client.
 *
 * Mobile App Workflow (per backend spec):
 * 1. getStripeConfig() — call once on screen load for publishableKey,
 *    enabled currencies, surcharge percent, and hold hours.
 * 2. createStripePaymentIntent() — creates the PaymentIntent server-side,
 *    returns clientSecret + paymentIntentId + surcharge/total to show the
 *    user before they pay.
 * 3. Collect card details via the Stripe React Native SDK's payment sheet
 *    (initPaymentSheet/presentPaymentSheet) using the clientSecret — handled
 *    in the screen component, not here, since it needs the useStripe() hook.
 * 4. confirmStripePayment() — call right after the SDK reports success.
 *    Idempotent; safe to retry if the network drops before this resolves.
 *
 * POST /api/stripe/webhook is server-side only (Stripe calls it directly) —
 * intentionally no client function for it.
 */
import { API_BASE_URL } from "./config";

export interface StripeConfig {
  success: boolean;
  publishableKey: string;
  currencies: string[];
  surchargePercent: number;
  holdHours: number;
  message?: string;
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  surchargeAmount?: number;
  totalCharged?: number;
  message?: string;
}

export interface ConfirmStripePaymentResponse {
  success: boolean;
  message?: string;
  status?: string;
}

let cachedConfig: StripeConfig | null = null;

/**
 * Fetches Stripe config (publishable key, enabled currencies, surcharge,
 * hold hours). Cached in-memory after the first successful call for the
 * lifetime of the app session, since this rarely changes — call
 * getStripeConfig(true) to force a fresh fetch if needed.
 */
export async function getStripeConfig(forceRefresh = false): Promise<StripeConfig> {
  if (cachedConfig && !forceRefresh) return cachedConfig;

  try {
    const res = await fetch(`${API_BASE_URL}/stripe/config`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      return {
        success: false,
        publishableKey: "",
        currencies: [],
        surchargePercent: 0,
        holdHours: 0,
        message: data?.message || `Could not load payment configuration (HTTP ${res.status}).`,
      };
    }

    const config: StripeConfig = {
      success: true,
      publishableKey: data.publishableKey || data.publishable_key || "",
      currencies: data.currencies || [],
      surchargePercent: typeof data.surchargePercent === "number" ? data.surchargePercent : (data.surcharge_percent ?? 0),
      holdHours: typeof data.holdHours === "number" ? data.holdHours : (data.hold_hours ?? 0),
    };
    cachedConfig = config;
    return config;
  } catch (e: any) {
    return {
      success: false,
      publishableKey: "",
      currencies: [],
      surchargePercent: 0,
      holdHours: 0,
      message: e?.message || "Network error while loading payment configuration.",
    };
  }
}

/**
 * Creates a Stripe PaymentIntent for a card top-up. Returns the clientSecret
 * to pass to the Stripe SDK's payment sheet, plus the surcharge/total amounts
 * to display to the user before they confirm payment.
 */
export async function createStripePaymentIntent(params: {
  phone: string;
  amount: number;
  currency: string;
  /** When true, asks the backend to set setup_future_usage so Stripe
   * attaches this payment method to the customer once confirmed —
   * enabling it to be charged again later without re-entering card
   * details. Assumed backend contract; not confirmed against a real spec
   * the way several other integrations in this app have been. */
  savePaymentMethod?: boolean;
}): Promise<CreatePaymentIntentResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/stripe/create-payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: params.phone,
        amount: params.amount,
        currency: params.currency,
        savePaymentMethod: params.savePaymentMethod,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      return { success: false, message: data?.message || `Could not start payment (HTTP ${res.status}).` };
    }

    return {
      success: true,
      clientSecret: data.clientSecret || data.client_secret,
      paymentIntentId: data.paymentIntentId || data.payment_intent_id,
      surchargeAmount: data.surchargeAmount ?? data.surcharge_amount,
      totalCharged: data.totalCharged ?? data.total_charged,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Network error while starting payment." };
  }
}

/**
 * Confirms the PaymentIntent on the backend right after the Stripe SDK
 * reports success client-side. This is what actually verifies the payment
 * and credits the user's wallet via CurrencyCloud — the SDK succeeding alone
 * doesn't credit anything. Idempotent; safe to call again if the first
 * attempt's response is lost (e.g. app backgrounded, network drop).
 */
export async function confirmStripePayment(paymentIntentId: string): Promise<ConfirmStripePaymentResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/stripe/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      return { success: false, message: data?.message || `Could not confirm payment (HTTP ${res.status}).` };
    }

    return { success: true, status: data.status, message: data.message };
  } catch (e: any) {
    return { success: false, message: e?.message || "Network error while confirming payment." };
  }
}

// ── Saved cards ──────────────────────────────────────────────────────────────
// Reasonable, standard-Stripe-pattern assumption about the backend contract
// (not a confirmed spec) — a saved card is a Stripe PaymentMethod already
// attached to this user's Stripe Customer object. Charging one doesn't
// involve the client SDK at all: the backend creates and confirms the
// PaymentIntent server-side using the existing payment_method + customer,
// since there's no new card data that needs to securely reach Stripe.

export interface SavedStripeCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export async function getSavedStripeCards(phone: string): Promise<{
  success: boolean;
  cards: SavedStripeCard[];
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/stripe/payment-methods?phone=${encodeURIComponent(phone)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return { success: false, cards: [], message: data?.message || `HTTP ${res.status}` };
    }
    const raw = Array.isArray(data?.paymentMethods) ? data.paymentMethods : Array.isArray(data?.cards) ? data.cards : [];
    const cards: SavedStripeCard[] = raw.map((c: any) => ({
      id: c.id || c.paymentMethodId,
      brand: c.brand || c.card?.brand || "Card",
      last4: c.last4 || c.card?.last4 || "",
      expMonth: c.expMonth ?? c.card?.exp_month ?? 0,
      expYear: c.expYear ?? c.card?.exp_year ?? 0,
    }));
    return { success: true, cards };
  } catch (e: any) {
    return { success: false, cards: [], message: e?.message || "Could not load saved cards." };
  }
}

export async function chargeWithSavedStripeCard(params: {
  phone: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
}): Promise<ConfirmStripePaymentResponse & { reference?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/stripe/charge-saved-card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false, message: data?.message || `Could not charge card (HTTP ${res.status}).` };
    }
    return { success: true, status: data.status, message: data.message, reference: data.reference || data.paymentIntentId };
  } catch (e: any) {
    return { success: false, message: e?.message || "Network error while charging saved card." };
  }
}
