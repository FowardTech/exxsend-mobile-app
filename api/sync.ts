/**
 * Sync API Module - Database-First Architecture
 * 
 * This module provides API functions that always return data from the backend database,
 * never directly from external APIs. This eliminates flickering and null data issues.
 * 
 * How it works:
 * 1. Mobile app calls these endpoints
 * 2. Backend returns cached data from database IMMEDIATELY
 * 3. Backend triggers background sync to update cache from CurrencyCloud/Flutterwave
 * 4. Next request gets fresh data
 * 
 * This is the same pattern used by Wise and Remitly.
 */

import { Platform } from 'react-native';
import { normalizeMediaUrl } from './config';

export const API_BASE_URL =
  Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID
    : process.env.EXPO_PUBLIC_API_BASE_URL_IOS;

// ============ TYPE DEFINITIONS ============

export interface SyncedWallet {
  id: number;
  currencyCode: string;
  currencyName: string;
  countryName: string | null;
  flag: string;
  symbol: string;
  isExotic: boolean;
  balance: number; // ALWAYS a number, never null
  formattedBalance: string;
  status: string;
  balanceUpdatedAt: string | null;
}

export interface SyncedTransaction {
  id: string;
  userId: string;
  walletId: string | null;
  transactionType: string;
  currency: string;
  amount: number;
  counterpartyName: string | null;
  counterpartyAccount: string | null;
  counterpartyBank: string | null;
  fromCurrency: string | null;
  toCurrency: string | null;
  fromAmount: number | null;
  toAmount: number | null;
  exchangeRate: number | null;
  reference: string;
  externalReference: string | null;
  provider: string | null;
  status: string;
  description: string | null;
  feeAmount: number | null;
  feeCurrency: string | null;
  createdAt: string;
  updatedAt: string | null;
  completedAt: string | null;
}

export interface WalletsResponse {
  success: boolean;
  wallets: SyncedWallet[];
  totalBalance: number;
  currency: string;
  lastUpdated: string | null;
  synced: boolean;
  message?: string;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: SyncedTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

export interface TotalBalanceResponse {
  success: boolean;
  totalBalance: number;
  currency: string;
  currencySymbol: string;
  lastUpdated: string | null;
  cached: boolean;
  message?: string;
}

export interface SavedRecipientFromDB {
  id: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  countryCode: string;
  isInterac: boolean;
  /** "bank" | "momo" | "interac" | "wallet" */
  payoutMethod?: string;
  /** MoMo network code e.g. "MTN", "MPESA" */
  networkCode?: string;
  networkName?: string;
  /** True when account name was verified by the API */
  nameVerified?: boolean;
  createdAt: number;
  updatedAt: number | null;
}
export interface SaveRecipientRequest {
  phone: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  countryCode: string;
  isInterac?: boolean;
  /** "bank" | "momo" | "interac" | "wallet" — this app's internal method name */
  payoutMethod?: string;
  /** "bank" | "momo" | "iban" | "interac" — the field the backend's
   * POST /users/recipients/saved actually validates against. Required
   * and non-empty; this is NOT the same value space as payoutMethod above. */
  payoutType?: string;
  /** "CHECKING" | "SAVINGS" — optional */
  accountType?: string;
  /** MoMo network code */
  networkCode?: string;
  networkName?: string;
  /** True when account name was verified by the backend */
  nameVerified?: boolean;
  /** Only meaningful for payoutType:"exxsend" — the member's profile photo
   * URL, if they have one, captured at save time. */
  avatarUrl?: string;
}
// ============ FETCH HELPER ============

const DEFAULT_TIMEOUT_MS = 15000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============ SYNC API FUNCTIONS ============

/**
 * Get user wallets with DATABASE-CACHED balances.
 * 
 * This endpoint ALWAYS returns data - never null balances.
 * Background sync updates the cache for future requests.
 * 
 * @param phone - User's phone number
 * @param triggerRefresh - Whether to trigger background sync (default: true)
 */
export async function getSyncedWallets(
  phone: string,
  triggerRefresh: boolean = true
): Promise<WalletsResponse> {
  try {
    const encodedPhone = encodeURIComponent(phone);
    const refresh = triggerRefresh ? 'true' : 'false';
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/sync/wallets?phone=${encodedPhone}&refresh=${refresh}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      12000
    );

    if (!response.ok) {
      return {
        success: false,
        wallets: [],
        totalBalance: 0,
        currency: 'USD',
        lastUpdated: null,
        synced: false,
        message: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    
    if (data.success && Array.isArray(data.wallets)) {
      return {
        success: true,
        wallets: data.wallets.map((w: any) => ({
          id: w.id,
          currencyCode: w.currencyCode || w.currency_code,
          currencyName: w.currencyName || w.currency_name || w.currencyCode,
          countryName: w.countryName || w.country_name || null,
          flag: w.flag || '🏳️',
          symbol: w.symbol || w.currencyCode || '',
          isExotic: Boolean(w.isExotic || w.is_exotic),
          balance: typeof w.balance === 'number' ? w.balance : 0, // NEVER null
          formattedBalance: w.formattedBalance || w.formatted_balance || '0.00',
          status: w.status || 'active',
          balanceUpdatedAt: w.balanceUpdatedAt || w.balance_updated_at || null,
        })),
        totalBalance: data.totalBalance || 0,
        currency: data.currency || 'USD',
        lastUpdated: data.lastUpdated || null,
        synced: data.synced || false,
      };
    }

    return {
      success: false,
      wallets: [],
      totalBalance: 0,
      currency: 'USD',
      lastUpdated: null,
      synced: false,
      message: data.message || 'Failed to load wallets',
    };
  } catch (error: any) {
    console.error('[SyncAPI] getSyncedWallets error:', error.message);
    return {
      success: false,
      wallets: [],
      totalBalance: 0,
      currency: 'USD',
      lastUpdated: null,
      synced: false,
      message: error.message || 'Network error',
    };
  }
}

/**
 * Get user transactions from DATABASE.
 * 
 * All transactions are stored locally when they occur, so this
 * always returns complete data.
 * 
 * @param phone - User's phone number
 * @param options - Filter and pagination options
 */
export async function getSyncedTransactions(
  phone: string,
  options: {
    currency?: string;
    walletId?: number;
    page?: number;
    limit?: number;
    status?: string;
  } = {}
): Promise<TransactionsResponse> {
  try {
    const params = new URLSearchParams();
    params.append('phone', phone);
    
    if (options.currency) params.append('currency', options.currency);
    if (options.walletId) params.append('wallet_id', String(options.walletId));
    if (options.page) params.append('page', String(options.page));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.status) params.append('status', options.status);

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/sync/transactions?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      10000
    );

    if (!response.ok) {
      return {
        success: false,
        transactions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        message: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        transactions: (data.transactions || []).map((tx: any) => ({
          id: tx.id,
          userId: tx.userId || tx.user_id,
          walletId: tx.walletId || tx.wallet_id,
          transactionType: tx.transactionType || tx.transaction_type,
          currency: tx.currency,
          amount: tx.amount,
          counterpartyName: tx.counterpartyName || tx.counterparty_name,
          counterpartyAccount: tx.counterpartyAccount || tx.counterparty_account,
          counterpartyBank: tx.counterpartyBank || tx.counterparty_bank,
          fromCurrency: tx.fromCurrency || tx.from_currency,
          toCurrency: tx.toCurrency || tx.to_currency,
          fromAmount: tx.fromAmount || tx.from_amount,
          toAmount: tx.toAmount || tx.to_amount,
          exchangeRate: tx.exchangeRate || tx.exchange_rate,
          reference: tx.reference,
          externalReference: tx.externalReference || tx.external_reference,
          provider: tx.provider,
          status: tx.status,
          description: tx.description,
          feeAmount: tx.feeAmount || tx.fee_amount,
          feeCurrency: tx.feeCurrency || tx.fee_currency,
          createdAt: tx.createdAt || tx.created_at,
          updatedAt: tx.updatedAt || tx.updated_at,
          completedAt: tx.completedAt || tx.completed_at,
        })),
        pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }

    return {
      success: false,
      transactions: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      message: data.message || 'Failed to load transactions',
    };
  } catch (error: any) {
    console.error('[SyncAPI] getSyncedTransactions error:', error.message);
    return {
      success: false,
      transactions: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      message: error.message || 'Network error',
    };
  }
}

/**
 * Get user's total balance from DATABASE.
 * 
 * Returns cached total balance - never null.
 * 
 * @param phone - User's phone number
 * @param targetCurrency - Currency to display total in (optional)
 */
export async function getSyncedTotalBalance(
  phone: string,
  targetCurrency?: string
): Promise<TotalBalanceResponse> {
  try {
    const params = new URLSearchParams();
    params.append('phone', phone);
    if (targetCurrency) params.append('target_currency', targetCurrency);

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/sync/balance/total?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      10000
    );

    if (!response.ok) {
      return {
        success: false,
        totalBalance: 0,
        currency: 'USD',
        currencySymbol: '$',
        lastUpdated: null,
        cached: true,
        message: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      success: data.success || false,
      totalBalance: typeof data.totalBalance === 'number' ? data.totalBalance : 0,
      currency: data.currency || 'USD',
      currencySymbol: data.currencySymbol || data.currency || '$',
      lastUpdated: data.lastUpdated || null,
      cached: data.cached ?? true,
      message: data.message,
    };
  } catch (error: any) {
    console.error('[SyncAPI] getSyncedTotalBalance error:', error.message);
    return {
      success: false,
      totalBalance: 0,
      currency: 'USD',
      currencySymbol: '$',
      lastUpdated: null,
      cached: true,
      message: error.message || 'Network error',
    };
  }
}

/**
 * Manually trigger a full data sync.
 * 
 * This refreshes all cached data from external APIs.
 * Returns immediately - sync runs in background.
 * 
 * @param phone - User's phone number
 */
export async function triggerSync(phone: string): Promise<{
  success: boolean;
  syncing: boolean;
  message?: string;
}> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/sync/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      },
      5000
    );

    const data = await response.json();
    return {
      success: data.success || false,
      syncing: data.syncing || false,
      message: data.message,
    };
  } catch (error: any) {
    console.error('[SyncAPI] triggerSync error:', error.message);
    return {
      success: false,
      syncing: false,
      message: error.message || 'Network error',
    };
  }
}

/**
 * Helper to convert SyncedWallet to the format expected by existing screens.
 * Use this for backward compatibility with HomeScreen/WalletScreen.
 */
export function toUserAccount(wallet: SyncedWallet): {
  id: string;
  currencyCode: string;
  currencyName: string;
  countryName: string | null;
  flag: string;
  symbol: string;
  isExotic: boolean;
  balance: number;
  status: string;
} {
  return {
    id: String(wallet.id),
    currencyCode: wallet.currencyCode,
    currencyName: wallet.currencyName,
    countryName: wallet.countryName,
    flag: wallet.flag,
    symbol: wallet.symbol,
    isExotic: wallet.isExotic,
    balance: wallet.balance,
    status: wallet.status,
  };
}

// ============ RECENT RECIPIENTS API ============

export interface RecentRecipientFromDB {
  id: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  destCurrency: string;
  countryCode?: string;
  payoutMethod?: string;
  /** Only ever set for Exxsend-member recipients (payoutMethod==="exxsend")
   * who've uploaded a profile photo — RecipientAvatar shows this instead
   * of initials/the "@" glyph when present. */
  avatarUrl?: string;
  networkCode?: string;
  networkName?: string;
  nameVerified?: boolean;
  lastSentAt: number;
  lastAmount: number | null;
  createdAt: number;
}

export interface RecentRecipientsResponse {
  filter: any;
  success: boolean;
  recipients: RecentRecipientFromDB[];
  total: number;
  message?: string;
}

/**
 * Get recent recipients from the database.
 * This replaces the AsyncStorage-based approach for more reliability.
 * 
 * @param phone - User's phone number
 * @param limit - Maximum number of recipients to return (default: 10)
 */
export async function getRecentRecipientsFromDB(
  phone: string,
  limit: number = 10
): Promise<RecentRecipientsResponse> {
  try {
    if (!phone) {
      return { filter: null, success: true, recipients: [], total: 0 };
    }
    
    const encodedPhone = encodeURIComponent(phone);
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/users/recipients/recent?phone=${encodedPhone}&limit=${limit}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      10000
    );

    if (!response.ok) {
      console.log('[SyncAPI] getRecentRecipientsFromDB failed:', response.status);
      return {
        filter: null,
        success: false,
        recipients: [],
        total: 0,
        message: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    // Diagnostic only — if "recent recipients" goes missing again despite a
    // real recent send, this is the line to check in device logs: it shows
    // exactly what the backend actually returned, which is what's needed to
    // tell a shape mismatch apart from the backend genuinely not tracking
    // that send as "recent" yet.
    console.log('[SyncAPI] getRecentRecipientsFromDB raw response:', JSON.stringify(data).slice(0, 500));
    const rawList = Array.isArray(data?.recipients)
      ? data.recipients
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.result?.recipients)
      ? data.result.recipients
      : Array.isArray(data)
      ? data
      : null;

    if (data?.success !== false && Array.isArray(rawList)) {
      return {
        filter: data.filter ?? null,
        success: true,
        recipients: rawList,
        total: data.total || rawList.length,
      };
    }

    return {
      filter: null,
      success: false,
      recipients: [],
      total: 0,
      message: data.message || 'Invalid response',
    };
  } catch (error: any) {
    console.error('[SyncAPI] getRecentRecipientsFromDB error:', error.message);
    return {
      filter: null,
      success: false,
      recipients: [],
      total: 0,
      message: error.message || 'Network error',
    };
  }
}

/**
 * Normalizes a raw /users/recipients/saved row into RecentRecipientFromDB
 * shape, since the field this app already saves under is "currency" (see
 * SaveRecipientRequest) but the rest of the recipient-rendering UI
 * (RecipientBubble, BeneficiaryPickerModal, etc.) was all built around
 * RecentRecipientFromDB's "destCurrency" field. Normalizing here means
 * every screen that already knows how to render a RecentRecipientFromDB
 * can render a saved recipient too, with no separate parallel type needed.
 */
function normalizeSavedRecipient(r: any): RecentRecipientFromDB {
  return {
    id: String(r.id ?? r._id ?? ""),
    accountName: r.accountName || r.account_name || "",
    accountNumber: r.accountNumber || r.account_number || "",
    bankCode: r.bankCode || r.bank_code || "",
    bankName: r.bankName || r.bank_name || "",
    destCurrency: r.destCurrency || r.currency || "",
    countryCode: r.countryCode || r.country_code,
    payoutMethod: r.payoutMethod || r.payout_type,
    avatarUrl: normalizeMediaUrl(r.avatarUrl || r.avatar_url || r.avatar),
    networkCode: r.networkCode || r.network_code,
    networkName: r.networkName || r.network_name,
    nameVerified: !!(r.nameVerified ?? r.name_verified),
    lastSentAt: Number(r.lastSentAt ?? r.last_sent_at ?? r.updatedAt ?? 0) || 0,
    lastAmount: r.lastAmount ?? r.last_amount ?? null,
    createdAt: Number(r.createdAt ?? r.created_at ?? 0) || 0,
  };
}

/**
 * GET /users/recipients/saved — the general, cross-corridor saved-recipients
 * list (Interac/Flutterwave/CurrencyCloud all save here via
 * saveRecipientToDB). This is what "Choose a saved beneficiary" should read
 * from, rather than CurrencyCloud's own /currencycloud/beneficiaries
 * endpoint — that one only ever reflects CurrencyCloud's side and can fail
 * independently of whether the recipient is actually saved in this app.
 */
export async function getSavedRecipients(
  phone: string,
  currency?: string,
  limit: number = 50
): Promise<RecentRecipientsResponse> {
  try {
    if (!phone) {
      return { filter: null, success: true, recipients: [], total: 0 };
    }

    const qs = new URLSearchParams({ phone, limit: String(limit) });
    if (currency) qs.set("currency", currency.toUpperCase());

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/users/recipients/saved?${qs.toString()}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      10000
    );

    if (!response.ok) {
      console.log('[SyncAPI] getSavedRecipients failed:', response.status);
      return {
        filter: null,
        success: false,
        recipients: [],
        total: 0,
        message: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const rawList = Array.isArray(data?.recipients) ? data.recipients : Array.isArray(data) ? data : null;

    if (data.success !== false && Array.isArray(rawList)) {
      const recipients = rawList.map(normalizeSavedRecipient);
      return {
        filter: data.filter ?? null,
        success: true,
        recipients,
        total: data.total || recipients.length,
      };
    }

    return {
      filter: null,
      success: false,
      recipients: [],
      total: 0,
      message: data.message || 'Invalid response',
    };
  } catch (error: any) {
    console.error('[SyncAPI] getSavedRecipients error:', error.message);
    return {
      filter: null,
      success: false,
      recipients: [],
      total: 0,
      message: error.message || 'Network error',
    };
  }
}

export async function saveRecipientToDB(
  request: SaveRecipientRequest
): Promise<{ success: boolean; message?: string; recipient?: SavedRecipientFromDB }> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/users/recipients/saved`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
      10000
    );

    const data = await response.json();
    
    return {
      success: data.success || false,
      message: data.message,
      recipient: data.recipient,
    };
  } catch (error: any) {
    console.error('[SyncAPI] saveRecipientToDB error:', error.message);
    return {
      success: false,
      message: error.message || 'Network error',
    };
  }
}


// ─── Delete a saved recipient ──────────────────────────────────────────────────
export async function deleteRecipientFromDB(phone: string, recipientId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/recipients/saved/${recipientId}?phone=${encodeURIComponent(phone)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    return data;
  } catch (e: any) {
    console.error("[SyncAPI] deleteRecipientFromDB error:", e?.message);
    return { success: false, message: e?.message || "Delete failed" };
  }
}

// ── Local recent-recipient tracking (client-side safety net) ───────────────
// getRecentRecipientsFromDB above is the intended source of truth, but a
// recipient just sent to has repeatedly failed to show up there right after
// sending — whether that's backend computation lag, a transaction type
// (e.g. Exxsend-member transfers) not yet being included, or something else
// isn't diagnosable from the client. Rather than keep chasing that blind,
// this records the recipient locally the instant a transfer actually
// succeeds, and Home merges it with whatever the backend returns — so the
// person you just sent to shows up immediately regardless of what the
// backend is or isn't doing yet.
const LOCAL_RECENT_KEY_PREFIX = "local_recent_recipients:";
const LOCAL_RECENT_MAX = 6;

function localRecentKey(phone: string): string {
  return `${LOCAL_RECENT_KEY_PREFIX}${phone.replace(/[^a-zA-Z0-9]/g, "")}`;
}

export async function recordRecentRecipient(phone: string, recipient: Partial<RecentRecipientFromDB>): Promise<void> {
  if (!phone) return;
  try {
    const key = localRecentKey(phone);
    const raw = await AsyncStorage.getItem(key);
    const existing: RecentRecipientFromDB[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const entry: RecentRecipientFromDB = {
      id: recipient.id ? String(recipient.id) : `local_${now}`,
      accountName: recipient.accountName || "",
      accountNumber: recipient.accountNumber || "",
      bankCode: recipient.bankCode || "",
      bankName: recipient.bankName || "",
      destCurrency: recipient.destCurrency || "",
      countryCode: recipient.countryCode,
      payoutMethod: recipient.payoutMethod,
      avatarUrl: recipient.avatarUrl,
      networkCode: recipient.networkCode,
      networkName: recipient.networkName,
      nameVerified: recipient.nameVerified,
      lastSentAt: now,
      lastAmount: recipient.lastAmount ?? null,
      createdAt: now,
    };
    // Same recipient sent to again — replace the old entry rather than
    // showing them twice, and bump them back to the top.
    const filtered = existing.filter(
      (r) => !(r.accountNumber === entry.accountNumber && r.bankCode === entry.bankCode && r.destCurrency === entry.destCurrency)
    );
    const updated = [entry, ...filtered].slice(0, LOCAL_RECENT_MAX);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    console.log(`[SyncAPI] recordRecentRecipient: saved "${entry.accountName}" locally, list now has ${updated.length} entries`);
  } catch (e: any) {
    console.log("[SyncAPI] recordRecentRecipient: threw, nothing recorded:", e?.message);
  }
}

export async function getLocalRecentRecipients(phone: string): Promise<RecentRecipientFromDB[]> {
  if (!phone) return [];
  try {
    const raw = await AsyncStorage.getItem(localRecentKey(phone));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
