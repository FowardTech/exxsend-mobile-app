import { Platform } from "react-native";
import { strictAPICall, TransactionError } from "../utils/networkGuard";

// Use the same base URL as the main api config
export const API_BASE_URL =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID || "http://10.0.2.2:5000/api"
    : process.env.EXPO_PUBLIC_API_BASE_URL_IOS || "http://127.0.0.1:5000/api";
/**
 * Currency to country code mapping for Flutterwave-supported countries
 * (Used by recipient screens + UI labels)
 */
export const CURRENCY_TO_COUNTRY: Record<string, string> = {
  NGN: "NG",
  KES: "KE",
  GHS: "GH",
  TZS: "TZ",
  UGX: "UG",
  ZAR: "ZA",
  XOF: "SN",
  XAF: "CM",
  ZMW: "ZM",
  MWK: "MW",
  SLL: "SL",
  RWF: "RW",
  ETB: "ET",
  EGP: "EG",
};

/**
 * Country names for display
 */
export const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  TZ: "Tanzania",
  UG: "Uganda",
  ZA: "South Africa",
  SN: "Senegal",
  CM: "Cameroon",
  ZM: "Zambia",
  MW: "Malawi",
  SL: "Sierra Leone",
  RW: "Rwanda",
  ET: "Ethiopia",
  EG: "Egypt",
};

export const getCurrencySymbol = (code: string): string => {
  const symbols: Record<string, string> = {
    NGN: "₦",
    GHS: "₵",
    KES: "KSh",
    UGX: "USh",
    TZS: "TSh",
    ZAR: "R",
    RWF: "FRw",
    XOF: "CFA",
    XAF: "FCFA",
    ZMW: "ZK",
    MWK: "MK",
    SLL: "Le",
    ETB: "Br",
    EGP: "E£",
    CAD: "$",
    USD: "$",
  };
  return symbols[code] || code;
};


/**
 * Check if a currency is supported by Flutterwave
 */
export function isFlutterwaveCurrency(currencyCode: string): boolean {
  const c = String(currencyCode || "").toUpperCase().trim();
  return !!CURRENCY_TO_COUNTRY[c];
}

export type Bank = { code: string; name: string };

export type VerifyAccountResponse = {
  success: boolean;
  accountName?: string;
  accountNumber?: string;
  message?: string;
  /** "UNSUPPORTED" when the corridor doesn't support real-time verification */
  code?: string;
  verified?: boolean;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
};

export type SendNGNRequest = {
  phone: string;
  amount: number;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  narration?: string;
};

export type SendNGNResponse = {
  success: boolean;
  message?: string;
  newBalance?: number;
  payout?: {
    id: string;
    flwReference: string;
    amount: number;
    recipientName: string;
    recipientBank: string;
    status: string;
  };
  code?: string;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
};

export type FlutterwaveTransaction = {
  id: string;
  flwReference: string;
  currency: string;
  amount: number;
  recipientName: string;
  recipientBankName: string;
  recipientAccountNumber: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type NGNBalanceResponse = {
  success: boolean;
  balance: number;
  currency?: string;
  message?: string;
  code?: string;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
};

export type LocalBalanceResponse = {
  success: boolean;
  balance: number;
  currency?: string;
  message?: string;
  code?: string;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
};

export type FlutterwaveTransactionsResponse = {
  success: boolean;
  transactions: FlutterwaveTransaction[];
  message?: string;
  code?: string;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
};

function mapTxError(err: any, fallbackMsg: string) {
  if (err instanceof TransactionError) {
    // strictAPICall throws with a generic code like "HTTP_400" for any non-2xx
    // response, but the backend's actual error body (stashed in `details`) often
    // carries a more specific, actionable code (e.g. "BVN_OR_NIN_REQUIRED"). Prefer
    // that real code whenever the backend supplied one, so callers can branch on it.
    const backendCode = err.details?.code;
    return {
      success: false,
      message: err.message,
      code: backendCode || err.code,
      isNetworkError: err.isNetworkError,
      isTimeoutError: err.isTimeoutError,
    };
  }
  return { success: false, message: fallbackMsg, code: "UNKNOWN_ERROR" };
}

/**
 * Get list of banks for any Flutterwave-supported country
 */
export async function getBanksByCountry(countryCode: string): Promise<Bank[]> {
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${API_BASE_URL}/flutterwave/banks/${countryCode.toUpperCase()}`;
      const data = await strictAPICall<any>(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        timeoutMs: 30000,
        context: "Fetch banks",
        validateSuccess: false,
      });

      const banksRaw: any[] = Array.isArray(data?.banks)
        ? data.banks
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.data?.banks)
        ? data.data.banks
        : [];

      const banks = banksRaw
        .map((b: any) => ({
          code: String(b?.code ?? b?.bank_code ?? b?.bankCode ?? "").trim(),
          name: String(b?.name ?? b?.bank_name ?? b?.bankName ?? "").trim(),
        }))
        .filter((b: Bank) => Boolean(b.code) && Boolean(b.name));

      if (banks.length > 0 || attempt === MAX_RETRIES) return banks;

      // Empty but no error — retry
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      console.error(`Failed to fetch banks for ${countryCode} after ${MAX_RETRIES + 1} attempts:`, error);
      return [];
    }
  }
  return [];
}

export async function getNigerianBanks(): Promise<Bank[]> {
  return getBanksByCountry("NG");
}

/**
 * Verify a bank account (currently only supports Nigeria)
 */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string,
  countryCode?: string
): Promise<VerifyAccountResponse> {
  try {
    const data = await strictAPICall<any>(`${API_BASE_URL}/flutterwave/verify-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_number: accountNumber,
        bank_code: bankCode,
        ...(countryCode ? { country: countryCode.toUpperCase() } : {}),
      }),
      timeoutMs: 12000,
      context: "Verify bank account",
      validateSuccess: false,
    });

    return {
      success: !!data?.success,
      accountName: data?.accountName ?? data?.account_name,
      accountNumber: data?.accountNumber ?? data?.account_number,
      message: data?.message,
      code: data?.code,
      verified: !!data?.success,
    };
  } catch (err) {
    return mapTxError(err, "Failed to verify account. Please try again.");
  }
}

/**
 * Get user's wallet balance from local ledger for any exotic currency
 */
export async function getLocalBalance(phone: string, currency: string): Promise<LocalBalanceResponse> {
  const encodedPhone = encodeURIComponent(phone);
  const upperCurrency = currency.toUpperCase().trim();
  const url = `${API_BASE_URL}/flutterwave/user/balance/${upperCurrency}?phone=${encodedPhone}`;

  try {
    const data = await strictAPICall<any>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 10000,
      context: `Fetch ${upperCurrency} balance`,
      validateSuccess: false,
    });

    const bal = Number(data?.balance ?? 0);
    return {
      success: !!data?.success,
      balance: Number.isFinite(bal) ? bal : 0,
      currency: data?.currency || upperCurrency,
      message: data?.message,
    };
  } catch (err) {
    const e = mapTxError(err, "Failed to fetch balance");
    return { ...e, balance: 0, currency: upperCurrency };
  }
}

export async function getNGNBalance(phone: string): Promise<NGNBalanceResponse> {
  return getLocalBalance(phone, "NGN");
}

/**
 * Send NGN to any Nigerian bank account
 */
export async function sendNGN(request: SendNGNRequest): Promise<SendNGNResponse> {
  try {
    const data = await strictAPICall<any>(`${API_BASE_URL}/flutterwave/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: request.phone,
        amount: request.amount,
        account_number: request.accountNumber,
        bank_code: request.bankCode,
        bank_name: request.bankName,
        account_name: request.accountName,
        narration: request.narration || "Transfer",
      }),
      timeoutMs: 15000,
      context: "Send NGN transfer",
      validateSuccess: false,
    });

    return data;
  } catch (err) {
    return mapTxError(err, "Failed to send money. Please try again.");
  }
}

/**
 * Send money to any Flutterwave-supported country
 */
export type SendFlutterwaveRequest = {
  phone: string;
  amount: number;
  currency: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  fromCurrency?: string;
  fromAmount?: number;
  narration?: string;
};

export async function sendFlutterwave(request: SendFlutterwaveRequest): Promise<SendNGNResponse> {
  try {
    const data = await strictAPICall<any>(
      `${API_BASE_URL}/flutterwave/send/${request.currency.toLowerCase()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: request.phone,
          currency: request.currency,
          amount: request.amount,
          from_currency: request.fromCurrency,
          from_amount: request.fromAmount,
          account_number: request.accountNumber,
          bank_code: request.bankCode,
          bank_name: request.bankName,
          account_name: request.accountName,
          narration: request.narration || "Transfer",
        }),
        timeoutMs: 15000,
        context: `Send ${request.currency} transfer`,
        validateSuccess: false,
      }
    );

    return data;
  } catch (err) {
    return mapTxError(err, "Failed to send money. Please try again.");
  }
}

/**
 * Get user's Flutterwave transaction history
 */
export async function getFlutterwaveTransactions(phone: string): Promise<FlutterwaveTransactionsResponse> {
  const encodedPhone = encodeURIComponent(phone);
  const url = `${API_BASE_URL}/flutterwave/user/transactions?phone=${encodedPhone}`;

  try {
    const data = await strictAPICall<any>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 10000,
      context: "Fetch Flutterwave transactions",
      validateSuccess: false,
    });

    return {
      success: !!data?.success,
      transactions: Array.isArray(data?.transactions) ? data.transactions : [],
      message: data?.message,
    };
  } catch (err) {
    return { ...mapTxError(err, "Failed to fetch transactions"), transactions: [] };
  }
}

// ─── Virtual Account (NGN Deposit) ───────────────────────────────────────────

export interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  accountName: string;
  expiresAt?: string;
  currency: string;
  reference?: string;
}

export interface VirtualAccountResponse {
  success: boolean;
  account?: VirtualAccount;
  message?: string;
  /** "BVN_OR_NIN_REQUIRED" when the backend needs identity verification before issuing an account */
  code?: string;
}

/** Fetch the user's existing NGN virtual account (if one already exists). */
export async function getVirtualAccount(phone: string): Promise<VirtualAccountResponse> {
  try {
    const url = `${API_BASE_URL}/flutterwave/virtual-account?phone=${encodeURIComponent(phone)}`;
    const data = await strictAPICall<any>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 15000,
      context: "Get virtual account",
      validateSuccess: false,
    });
    if (data?.success && data?.account) {
      return { success: true, account: data.account };
    }
    return { success: false, message: data?.message || "No virtual account found", code: data?.code };
  } catch (err) {
    return mapTxError(err, "Failed to fetch virtual account");
  }
}

/**
 * Create or refresh a Flutterwave NGN virtual account for deposits.
 * Flutterwave requires a Nigerian BVN or NIN to issue a live virtual account —
 * the backend returns code "BVN_OR_NIN_REQUIRED" if neither is on file, and the
 * UI must collect one before retrying this call.
 */
export async function createVirtualAccount(
  phone: string,
  opts?: { bvn?: string; nin?: string; email?: string; name?: string }
): Promise<VirtualAccountResponse> {
  try {
    const data = await strictAPICall<any>(`${API_BASE_URL}/flutterwave/virtual-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, ...opts }),
      timeoutMs: 20000,
      context: "Create virtual account",
      validateSuccess: false,
    });
    if (data?.success && data?.account) {
      return { success: true, account: data.account };
    }
    return { success: false, message: data?.message || "Could not create virtual account", code: data?.code };
  } catch (err) {
    return mapTxError(err, "Failed to create virtual account");
  }
}

/**
 * Submit a BVN or NIN for the current user (stored server-side, used for
 * virtual-account issuance and any future KYC needs). Call this once the
 * person enters their ID in the collection sheet, then retry createVirtualAccount.
 */
export async function submitIdentityNumber(
  phone: string,
  params: { bvn?: string; nin?: string }
): Promise<{ success: boolean; message?: string }> {
  try {
    const data = await strictAPICall<any>(`${API_BASE_URL}/users/identity-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, ...params }),
      timeoutMs: 15000,
      context: "Submit identity number",
      validateSuccess: false,
    });
    return { success: !!data?.success, message: data?.message };
  } catch (err) {
    return mapTxError(err, "Failed to submit identity number");
  }
}

// ─── Mobile Money Charge ──────────────────────────────────────────────────────

export interface MobileMoneyChargeRequest {
  phone: string;
  amount: number;
  currency: string;       // e.g. "KES", "GHS", "UGX"
  mobileNumber: string;   // payer's mobile number
  network: string;        // e.g. "MTN", "MPESA", "VODAFONE"
  fullName: string;
  email?: string;
}

export interface MobileMoneyChargeResponse {
  success: boolean;
  transactionId?: string;
  flwRef?: string;
  status?: string;        // "pending" | "successful" | "failed"
  redirectUrl?: string;
  message?: string;
  code?: string;
}

export async function chargeMobileMoney(
  req: MobileMoneyChargeRequest
): Promise<MobileMoneyChargeResponse> {
  try {
    const data = await strictAPICall<any>(`${API_BASE_URL}/flutterwave/charge/mobile-money`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      timeoutMs: 30000,
      context: "Mobile money charge",
      validateSuccess: false,
    });
    return {
      success: !!data?.success,
      transactionId: data?.transactionId ?? data?.transaction_id,
      flwRef: data?.flwRef ?? data?.flw_ref,
      status: data?.status,
      redirectUrl: data?.redirectUrl ?? data?.redirect_url,
      message: data?.message,
      code: data?.code,
    };
  } catch (err) {
    return mapTxError(err, "Mobile money charge failed");
  }
}

// ─── Card Charge (local card checkout link) ───────────────────────────────────

export interface CardChargeRequest {
  phone: string;
  amount: number;
  currency: string;
  email?: string;
  name?: string;
}

export interface CardChargeResponse {
  success: boolean;
  checkoutUrl?: string;   // hosted payment link from Flutterwave
  transactionId?: string;
  message?: string;
  code?: string;
}

export async function chargeCard(req: CardChargeRequest): Promise<CardChargeResponse> {
  try {
    const data = await strictAPICall<any>(`${API_BASE_URL}/flutterwave/charge/card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      timeoutMs: 20000,
      context: "Card charge",
      validateSuccess: false,
    });
    return {
      success: !!data?.success,
      checkoutUrl: data?.checkoutUrl ?? data?.checkout_url ?? data?.link,
      transactionId: data?.transactionId ?? data?.transaction_id,
      message: data?.message,
      code: data?.code,
    };
  } catch (err) {
    return mapTxError(err, "Card charge failed");
  }
}

// ─── Recommended deposit method per currency ──────────────────────────────────

export type DepositMethod = "virtual_account" | "mobile_money" | "card_checkout" | "unsupported";

export interface RecommendedDepositResponse {
  success: boolean;
  method: DepositMethod;
  currency: string;
  momoNetworks?: Array<{ code: string; name: string }>;
  message?: string;
}

/**
 * Ask the backend which deposit method to surface for a given currency.
 * Falls back to a client-side lookup if the network is unavailable.
 */
export async function recommendedDepositMethod(
  phone: string,
  currency: string
): Promise<RecommendedDepositResponse> {
  // Client-side fallback table
  const FALLBACK: Record<string, DepositMethod> = {
    NGN: "virtual_account",
    KES: "mobile_money",
    GHS: "mobile_money",
    UGX: "mobile_money",
    TZS: "mobile_money",
    RWF: "mobile_money",
    ZMW: "mobile_money",
    ZAR: "card_checkout",
    XOF: "mobile_money",
    XAF: "mobile_money",
  };

  try {
    const url = `${API_BASE_URL}/flutterwave/deposit-method?phone=${encodeURIComponent(phone)}&currency=${encodeURIComponent(currency.toUpperCase())}`;
    const data = await strictAPICall<any>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 10000,
      context: "Recommended deposit method",
      validateSuccess: false,
    });
    if (data?.success) {
      return {
        success: true,
        method: data.method || FALLBACK[currency.toUpperCase()] || "unsupported",
        currency: currency.toUpperCase(),
        momoNetworks: data.momoNetworks,
        message: data.message,
      };
    }
    throw new Error(data?.message || "Bad response");
  } catch {
    // Network unavailable — use client-side fallback silently
    return {
      success: true,
      method: FALLBACK[currency.toUpperCase()] || "unsupported",
      currency: currency.toUpperCase(),
    };
  }
}
