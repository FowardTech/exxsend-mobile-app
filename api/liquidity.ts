/**
 * api/liquidity.ts
 *
 * Pre-flight liquidity checks. Call this before letting the user press
 * Confirm on any conversion or withdrawal, so we can show a friendly
 * "try again in mm:ss" banner instead of letting the real execute call
 * fail with a generic error.
 *
 * Endpoint: POST /api/liquidity/check
 *   Request:  { currency, amount, operation }
 *   Response (200): { ok: true }
 *   Response (503): {
 *     ok: false,
 *     error_code: "LIQUIDITY_LOW",
 *     severity: "critical" | "low",
 *     currency, balance, required, shortfall,
 *     retryAfterSeconds,
 *     message,
 *   }
 */
import { API_BASE_URL } from "./config";

export type LiquidityOperation =
  | "interac_withdrawal"
  | "bank_withdrawal"
  | "conversion";

export type LiquiditySeverity = "low" | "critical";

export interface LiquidityCheckParams {
  currency: string;
  amount: number;
  operation: LiquidityOperation;
}

/** Normalized result — always returns this shape, never throws. */
export interface LiquidityResult {
  ok: boolean;
  currency: string;
  /** Present only when ok === false */
  severity?: LiquiditySeverity;
  balance?: number;
  required?: number;
  shortfall?: number;
  retryAfterSeconds?: number;
  message: string;
  /** True if we couldn't reach the endpoint at all — fail-open by default */
  networkError?: boolean;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Hit the liquidity pre-flight endpoint.
 *
 * Fails open on network errors (returns ok: true) so a flaky connection to
 * this non-critical check never blocks a transfer the real execute call
 * would otherwise allow. The execute call itself is still the source of
 * truth — see isLiquidityLowResponse for catching it there too.
 */
export async function checkLiquidity(
  params: LiquidityCheckParams
): Promise<LiquidityResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/liquidity/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 503 && data) {
      return {
        ok: false,
        currency: data.currency || params.currency,
        severity: data.severity === "critical" ? "critical" : "low",
        balance: typeof data.balance === "number" ? data.balance : undefined,
        required: typeof data.required === "number" ? data.required : undefined,
        shortfall: typeof data.shortfall === "number" ? data.shortfall : undefined,
        retryAfterSeconds:
          typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : 600,
        message: data.message || "Service not available at this time, try again later.",
      };
    }

    if (res.ok && data) {
      return { ok: true, currency: params.currency, message: "OK" };
    }

    // Unexpected status/shape — fail open rather than blocking the user
    return { ok: true, currency: params.currency, message: "OK", networkError: true };
  } catch {
    // Network/timeout error — fail open
    return { ok: true, currency: params.currency, message: "OK", networkError: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Detect a LIQUIDITY_LOW failure coming back from an already-issued
 * execute call (convertCurrency, sendNGN, sendInteracPayout, etc.) rather
 * than from the pre-flight checkLiquidity endpoint.
 *
 * Handles both response shapes seen in this codebase:
 *   - raw API bodies spread directly onto the return value (error_code at top level)
 *   - thrown TransactionError objects with details.error_code from a non-2xx response
 */
export function isLiquidityLowResponse(resp: any): LiquidityResult | null {
  if (!resp) return null;

  const body = resp?.details && typeof resp.details === "object" ? resp.details : resp;

  const code = body?.error_code || body?.errorCode || resp?.code;
  if (code !== "LIQUIDITY_LOW") return null;

  return {
    ok: false,
    currency: body?.currency || "",
    severity: body?.severity === "critical" ? "critical" : "low",
    balance: typeof body?.balance === "number" ? body.balance : undefined,
    required: typeof body?.required === "number" ? body.required : undefined,
    shortfall: typeof body?.shortfall === "number" ? body.shortfall : undefined,
    retryAfterSeconds:
      typeof body?.retryAfterSeconds === "number" ? body.retryAfterSeconds : 600,
    message:
      body?.message ||
      resp?.message ||
      "Service not available at this time, try again later.",
  };
}
