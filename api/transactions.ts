import { Platform } from "react-native";
import { strictAPICall, TransactionError } from "../utils/networkGuard";

/**
 * Transactions API - Fetch wallet transactions for mobile app
 */
const API_BASE_URL =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID || "http://10.0.2.2:5000/api"
    : process.env.EXPO_PUBLIC_API_BASE_URL_IOS || "http://127.0.0.1:5000/api";

export interface WalletTransaction {
  id: number;
  reference: string;
  externalReference?: string;
  transactionType: string;
  currency: string;
  amount: number;
  fromCurrency?: string;
  toCurrency?: string;
  fromAmount?: number;
  toAmount?: number;
  exchangeRate?: number;
  counterpartyName?: string;
  counterpartyAccount?: string;
  counterpartyBank?: string;
  status: string;
  provider?: string;
  description?: string;
  feeAmount?: number;
  feeAmountInBaseCurrency?: number;
  baseCurrency?: string;
  baseCurrencySymbol?: string;
  feeCurrency?: string;
  createdAt: string;
  completedAt?: string;
  userId?: number;
  walletId?: number;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: WalletTransaction[];
  total: number;
  page: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
  message?: string;

  // ✅ added for UI network messaging
  code?: string;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
}

/**
 * Get all transactions for a user by phone number
 * ✅ never throws to UI
 * ✅ never calls response.json() (prevents JSON parse crashes)
 */
export async function getUserTransactions(
  phone: string,
  page = 1,
  limit = 50,
  currency?: string
): Promise<TransactionsResponse> {
  const encodedPhone = encodeURIComponent(phone);

  let url = `${API_BASE_URL}/wallet-transactions/by-phone?phone=${encodedPhone}&page=${page}&limit=${limit}`;
  if (currency) url += `&currency=${currency.toUpperCase()}`;

  try {
    const data = await strictAPICall<any>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 10000,
      context: "Fetch transactions",
      validateSuccess: false, // some endpoints may not include success
    });

    const rawTxs = Array.isArray(data?.transactions) ? data.transactions : [];
    const normalized = rawTxs.map(normalizeTransaction);

    return {
      success: true,
      transactions: normalized,
      total: data?.total || normalized.length,
      page: data?.page || page,
      pages: data?.pages || 1,
      hasNext: data?.hasNext || false,
      hasPrev: data?.hasPrev || false,
    };
  } catch (err: any) {
    if (err instanceof TransactionError) {
      return {
        success: false,
        transactions: [],
        total: 0,
        page: page,
        pages: 0,
        hasNext: false,
        hasPrev: false,
        message: err.message,
        code: err.code,
        isNetworkError: err.isNetworkError,
        isTimeoutError: err.isTimeoutError,
      };
    }

    return {
      success: false,
      transactions: [],
      total: 0,
      page: page,
      pages: 0,
      hasNext: false,
      hasPrev: false,
      message: "Failed to fetch transactions",
      code: "UNKNOWN_ERROR",
    };
  }
}

/**
 * Get a single transaction by reference
 * ✅ safe JSON parsing via strictAPICall
 */
export async function getTransactionByReference(
  reference: string
): Promise<{
  success: boolean;
  transaction?: WalletTransaction;
  message?: string;
  code?: string;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
}> {
  const url = `${API_BASE_URL}/wallet-transactions/${encodeURIComponent(reference)}`;

  try {
    const data = await strictAPICall<any>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 10000,
      context: "Fetch transaction detail",
      validateSuccess: false,
    });

    if (data?.success && data?.transaction) {
      return { success: true, transaction: normalizeTransaction(data.transaction) };
    }

    // if backend doesn’t use {success:true}, still try best-effort:
    if (data?.transaction) {
      return { success: true, transaction: normalizeTransaction(data.transaction) };
    }

    return { success: false, message: data?.message || "Transaction not found" };
  } catch (err: any) {
    if (err instanceof TransactionError) {
      return {
        success: false,
        message: err.message,
        code: err.code,
        isNetworkError: err.isNetworkError,
        isTimeoutError: err.isTimeoutError,
      };
    }
    return { success: false, message: "Failed to fetch transaction", code: "UNKNOWN_ERROR" };
  }
}

/**
 * Normalize transaction data from backend (snake_case to camelCase)
 */
function normalizeTransaction(tx: any): WalletTransaction {
  return {
    id: tx.id,
    reference: tx.reference,
    externalReference: tx.external_reference || tx.externalReference,
    transactionType: tx.transaction_type || tx.transactionType,
    currency: tx.currency,
    amount: parseFloat(tx.amount) || 0,
    fromCurrency: tx.from_currency || tx.fromCurrency,
    toCurrency: tx.to_currency || tx.toCurrency,
    fromAmount:
      tx.from_amount || tx.fromAmount ? parseFloat(tx.from_amount || tx.fromAmount) : undefined,
    toAmount: tx.to_amount || tx.toAmount ? parseFloat(tx.to_amount || tx.toAmount) : undefined,
    exchangeRate:
      tx.exchange_rate || tx.exchangeRate
        ? parseFloat(tx.exchange_rate || tx.exchangeRate)
        : undefined,
    counterpartyName: tx.counterparty_name || tx.counterpartyName,
    counterpartyAccount: tx.counterparty_account || tx.counterpartyAccount,
    counterpartyBank: tx.counterparty_bank || tx.counterpartyBank,
    status: tx.status,
    provider: tx.provider,
    description: tx.description,
    feeAmount: tx.fee_amount || tx.feeAmount ? parseFloat(tx.fee_amount || tx.feeAmount) : undefined,
    feeCurrency: tx.fee_currency || tx.feeCurrency,
    feeAmountInBaseCurrency: tx.fee_amount_in_base_currency || tx.feeAmountInBaseCurrency 
      ? parseFloat(tx.fee_amount_in_base_currency || tx.feeAmountInBaseCurrency) 
      : undefined,
    baseCurrency: tx.base_currency || tx.baseCurrency,
    baseCurrencySymbol: tx.base_currency_symbol || tx.baseCurrencySymbol,
    createdAt: tx.created_at || tx.createdAt,
    completedAt: tx.completed_at || tx.completedAt,
    userId: tx.user_id || tx.userId,
    walletId: tx.wallet_id || tx.walletId,
  };
}
