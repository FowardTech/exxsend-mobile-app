import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";
import { strictAPICall, TransactionError } from "../utils/networkGuard";

// ── Cache helpers ──────────────────────────────────────────────────────────
// Phone numbers can contain characters (+, spaces) that aren't ideal as raw
// key suffixes, so sanitize before using as a cache key — matches the
// project's existing per-phone cache key conventions elsewhere (e.g.
// cached_total_balance_v1) but namespaced under "investments:" as specified.
function sanitizePhone(phone: string): string {
  return phone.replace(/[^a-zA-Z0-9]/g, "");
}

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setCached(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// The backend's /snaptrade/accounts (and /snaptrade/sync) responses carry
// the logo under brokerLogoUrl — confirmed as the same field the admin
// dashboard uses — not logoUrl, which is what BrokerageAccount's type (and
// every screen reading it) actually expects. Normalizing here, once, means
// every caller gets a correctly-populated logoUrl regardless of which
// endpoint the account data came from, rather than each screen needing to
// know about this field-name mismatch itself.
function normalizeAccounts(accounts: any[]): BrokerageAccount[] {
  if (!Array.isArray(accounts)) return [];
  return accounts.map((a) => ({
    ...a,
    logoUrl: a.logoUrl ?? a.brokerLogoUrl ?? a.broker_logo_url ?? null,
  }));
}

// ── Shared types ────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  price: number;
  currency: string;
  priceInBase: number;
  priceInUsd: number;
  baseCurrency: string;
  billingInterval: string;
  features: string[];
}

export interface PlansResponse {
  success: boolean;
  plans: SubscriptionPlan[];
  message?: string;
}

export interface SubscriptionState {
  isActive: boolean;
  subscription: any;
  plan: {
    price: number;
    currency: string;
    priceInBase: number;
    priceInUsd: number;
    baseCurrency: string;
  } | null;
}

export interface SubscriptionMeResponse {
  success: boolean;
  isActive: boolean;
  subscription: any;
  plan: SubscriptionState["plan"];
  message?: string;
}

export interface SubscribeWalletResult {
  success: boolean;
  ok?: boolean;
  subscription?: any;
  // Surfaced when the backend returns HTTP 402 insufficient_funds
  insufficientFunds?: {
    required: number;
    currency: string;
    available: number;
    priceCurrency?: string;
    price?: number;
  };
  message?: string;
}

export interface WalletOption {
  currency: string;
  balance: number;
  requiredAmount: number;
  rate: number;
  source: "identity" | "cached" | "oxr" | string;
  sufficient: boolean;
}

export interface WalletOptionsResponse {
  success: boolean;
  priceCurrency: string;
  price: number;
  options: WalletOption[];
  message?: string;
}

export interface SubscribeStripeResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  message?: string;
}

export interface SnapTradePortalResult {
  success: boolean;
  redirectUri?: string;
  sessionId?: string;
  subscriptionRequired?: boolean;
  message?: string;
}

export interface SnapTradeSyncResult {
  success: boolean;
  ok?: boolean;
  accounts?: BrokerageAccount[];
  holdings?: Holding[];
  subscriptionRequired?: boolean;
  message?: string;
}

export interface BrokerageAccount {
  id?: string;
  brokerageName: string;
  /** Brokerage logo URL, returned by the backend alongside the rest of the
   * account data on /snaptrade/accounts. Optional/undefined whenever the
   * backend doesn't have a logo for that particular brokerage. */
  logoUrl?: string | null;
  accountNumberMasked: string;
  currency: string;
  balance: number;
  balanceInUsd: number;
  balanceInBase: number;
  cash: number;
  cashInUsd: number;
  cashInBase: number;
  lastSyncedAt: string;
}

export interface AccountsResponse {
  success: boolean;
  baseCurrency: string;
  accounts: BrokerageAccount[];
  subscriptionRequired?: boolean;
  message?: string;
}

export interface Holding {
  symbol: string;
  description: string;
  quantity: number;
  marketPrice: number;
  marketPriceInUsd: number;
  marketPriceInBase: number;
  marketValue: number;
  marketValueInUsd: number;
  marketValueInBase: number;
  currency: string;
  brokerageName: string;
  avgCostInUsd?: number;
}

export interface HoldingsResponse {
  success: boolean;
  baseCurrency: string;
  totalValueInBase: number;
  totalValueInUsd: number;
  holdings: Holding[];
  subscriptionRequired?: boolean;
  message?: string;
}

export interface InvestmentTransaction {
  type: "BUY" | "SELL" | "DIV" | string;
  symbol: string;
  quantity: number;
  price: number;
  priceInUsd?: number;
  priceInBase?: number;
  amount: number;
  amountInUsd?: number;
  amountInBase?: number;
  currency: string;
  tradeDate: string;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: InvestmentTransaction[];
  subscriptionRequired?: boolean;
  message?: string;
}

// ── Subscription-required (402) detection ───────────────────────────────────
// SnapTrade endpoints return HTTP 402 subscription_required when the user
// isn't subscribed. strictAPICall throws a TransactionError on non-2xx
// responses (see utils/networkGuard.ts), so we catch and translate that into
// a consistent { subscriptionRequired: true } shape the screens can check
// without needing to know the raw HTTP status code.
function isSubscriptionRequiredError(err: unknown): boolean {
  if (err instanceof TransactionError) {
    const details = (err as any).details;
    return (
      err.code === "HTTP_402" && details?.error === "subscription_required"
    ) || details?.error === "subscription_required";
  }
  return false;
}

function isInsufficientFundsError(err: unknown): { required: number; currency: string; available: number; priceCurrency?: string; price?: number } | null {
  if (err instanceof TransactionError) {
    const details = (err as any).details;
    if (details?.error === "insufficient_funds") {
      return {
        required: Number(details.required) || 0,
        currency: String(details.currency || ""),
        available: Number(details.available) || 0,
        priceCurrency: details.priceCurrency ? String(details.priceCurrency) : undefined,
        price: details.price !== undefined ? Number(details.price) : undefined,
      };
    }
  }
  return null;
}

// ── Subscription endpoints ───────────────────────────────────────────────

export interface InvestContentResponse {
  success: boolean;
  key?: string;
  title?: string;
  bodyMd?: string;
  updatedAt?: string;
  message?: string;
}

export async function getInvestContent(): Promise<InvestContentResponse> {
  const cacheKey = "investments:content";
  try {
    const data = await strictAPICall<{ key: string; title: string; bodyMd: string; updatedAt: string }>(
      `${API_BASE_URL}/snaptrade/content`,
      { method: "GET", timeoutMs: 12000, context: "Get Invest info content" }
    );
    const result = { success: true, key: data.key, title: data.title, bodyMd: data.bodyMd, updatedAt: data.updatedAt };
    await setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    const cached = await getCached<InvestContentResponse>(cacheKey);
    if (cached) return { ...cached, message: err?.message };
    return { success: false, message: err?.message || "Could not load this content." };
  }
}

export async function getSubscriptionPlans(baseCurrency: string): Promise<PlansResponse> {
  try {
    const data = await strictAPICall<PlansResponse>(
      `${API_BASE_URL}/subscriptions/plans?baseCurrency=${encodeURIComponent(baseCurrency)}`,
      { method: "GET", timeoutMs: 12000, context: "Get subscription plans" }
    );
    return { success: true, plans: data.plans || [] };
  } catch (err: any) {
    return { success: false, plans: [], message: err?.message || "Could not load plans." };
  }
}

export async function getMySubscription(phone: string): Promise<SubscriptionState & { success: boolean; message?: string }> {
  const cacheKey = `investments:me:${sanitizePhone(phone)}`;
  try {
    const data = await strictAPICall<{ isActive: boolean; subscription: any; plan: SubscriptionState["plan"] }>(
      `${API_BASE_URL}/subscriptions/me?phone=${encodeURIComponent(phone)}`,
      { method: "GET", timeoutMs: 12000, context: "Get subscription status" }
    );
    const result = { success: true, isActive: !!data.isActive, subscription: data.subscription, plan: data.plan };
    await setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    const cached = await getCached<SubscriptionState & { success: boolean }>(cacheKey);
    if (cached) return { ...cached, message: err?.message };
    return { success: false, isActive: false, subscription: null, plan: null, message: err?.message || "Could not load subscription status." };
  }
}

export async function getWalletOptions(phone: string): Promise<WalletOptionsResponse> {
  try {
    const data = await strictAPICall<{ priceCurrency: string; price: number; options: WalletOption[] }>(
      `${API_BASE_URL}/subscriptions/wallet-options?phone=${encodeURIComponent(phone)}`,
      { method: "GET", timeoutMs: 15000, context: "Get wallet payment options" }
    );
    return { success: true, priceCurrency: data.priceCurrency, price: data.price, options: data.options || [] };
  } catch (err: any) {
    return { success: false, priceCurrency: "", price: 0, options: [], message: err?.message || "Could not load your wallets." };
  }
}

export async function subscribeWithWallet(phone: string, walletCurrency?: string): Promise<SubscribeWalletResult> {
  try {
    const data = await strictAPICall<any>(`${API_BASE_URL}/subscriptions/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(walletCurrency ? { phone, method: "wallet", walletCurrency } : { phone, method: "wallet" }),
      timeoutMs: 15000,
      context: "Subscribe with wallet",
    });
    // Subscription state just changed — drop the cached /subscriptions/me
    // response so the next read (e.g. the Invest tab re-checking status) is
    // forced to hit the network instead of serving the stale "not active"
    // snapshot from before this call.
    await AsyncStorage.removeItem(`investments:me:${sanitizePhone(phone)}`);
    return { success: true, ok: data.ok, subscription: data.subscription };
  } catch (err: any) {
    const insufficientFunds = isInsufficientFundsError(err);
    if (insufficientFunds) {
      return { success: false, insufficientFunds, message: "Insufficient wallet balance." };
    }
    return { success: false, message: err?.message || "Could not complete subscription." };
  }
}

export async function subscribeWithStripe(
  phone: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<SubscribeStripeResult> {
  try {
    const data = await strictAPICall<{ checkoutUrl?: string; sessionId?: string }>(
      `${API_BASE_URL}/subscriptions/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, method: "stripe", successUrl, cancelUrl }),
        timeoutMs: 15000,
        context: "Subscribe with card",
      }
    );
    return { success: true, checkoutUrl: data.checkoutUrl, sessionId: data.sessionId };
  } catch (err: any) {
    return { success: false, message: err?.message || "Could not start checkout." };
  }
}

export interface SubscriptionPaymentIntentResult {
  success: boolean;
  clientSecret?: string;
  subscriptionId?: string;
  customerId?: string;
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
  ephemeralKey?: string | null;
  publishableKey?: string;
  message?: string;
}

/**
 * Creates the subscription's first invoice + PaymentIntent server-side
 * without charging yet (payment_behavior='default_incomplete' on the
 * backend) — mirrors the wallet top-up's createStripePaymentIntent exactly,
 * for confirming directly in-app via our own styled CardField instead of
 * Stripe's hosted Checkout page. The backend's invoice.payment_succeeded
 * webhook activates the subscription once the client confirms the card;
 * there's no separate "confirm" call needed on our side afterward.
 */
export async function createSubscriptionPaymentIntent(phone: string): Promise<SubscriptionPaymentIntentResult> {
  try {
    const data = await strictAPICall<{
      clientSecret?: string;
      subscriptionId?: string;
      customerId?: string;
      paymentIntentId?: string;
      amount?: number;
      currency?: string;
      ephemeralKey?: string | null;
      publishableKey?: string;
    }>(`${API_BASE_URL}/subscriptions/subscribe/payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      timeoutMs: 15000,
      context: "Start card subscription",
    });
    return {
      success: true,
      clientSecret: data.clientSecret,
      subscriptionId: data.subscriptionId,
      customerId: data.customerId,
      paymentIntentId: data.paymentIntentId,
      amount: data.amount,
      currency: data.currency,
      ephemeralKey: data.ephemeralKey,
      publishableKey: data.publishableKey,
    };
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      // Shouldn't realistically happen on this specific endpoint (the user
      // is actively subscribing), but handled defensively for consistency
      // with every other gated call in this module.
      return { success: false, message: "Please try again." };
    }
    return { success: false, message: err?.message || "Could not start payment." };
  }
}

export async function cancelSubscription(phone: string): Promise<{ success: boolean; ok?: boolean; subscription?: any; message?: string }> {
  try {
    const data = await strictAPICall<any>(`${API_BASE_URL}/subscriptions/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      timeoutMs: 12000,
      context: "Cancel subscription",
    });
    await AsyncStorage.removeItem(`investments:me:${sanitizePhone(phone)}`);
    return { success: true, ok: data.ok, subscription: data.subscription };
  } catch (err: any) {
    return { success: false, message: err?.message || "Could not cancel subscription." };
  }
}

// ── SnapTrade endpoints (all subscription-gated) ────────────────────────────

export async function getSnapTradePortalUrl(
  phone: string,
  redirectUrl?: string
): Promise<SnapTradePortalResult> {
  try {
    const data = await strictAPICall<{ redirectUri?: string; sessionId?: string }>(
      `${API_BASE_URL}/snaptrade/portal-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, redirectUrl }),
        timeoutMs: 15000,
        context: "Get broker connection link",
      }
    );
    return { success: true, redirectUri: data.redirectUri, sessionId: data.sessionId };
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, subscriptionRequired: true, message: "An active Invest subscription is required." };
    }
    return { success: false, message: err?.message || "Could not start broker connection." };
  }
}

export async function syncSnapTrade(phone: string): Promise<SnapTradeSyncResult> {
  try {
    const data = await strictAPICall<{ ok?: boolean; accounts?: BrokerageAccount[]; holdings?: Holding[] }>(
      `${API_BASE_URL}/snaptrade/sync`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
        timeoutMs: 20000,
        context: "Sync brokerage accounts",
      }
    );
    // IMPORTANT: these caches must match the exact shape getSnapTradeAccounts
    // / getSnapTradeHoldings expect to read back ({ success, baseCurrency,
    // accounts/holdings, ... }) — caching the bare arrays here previously
    // meant that if a later GET call failed and fell back to this cache,
    // spreading a bare array (`{...cached}`) produced an object with no
    // .accounts/.holdings property at all, crashing every screen that maps
    // over it. baseCurrency isn't part of this endpoint's payload, so it's
    // preserved from whatever's already cached rather than guessed at.
    const accountsCacheKey = `investments:accounts:${sanitizePhone(phone)}`;
    const holdingsCacheKey = `investments:holdings:${sanitizePhone(phone)}`;
    if (data.accounts) {
      const prior = await getCached<AccountsResponse>(accountsCacheKey);
      await setCached(accountsCacheKey, { success: true, baseCurrency: prior?.baseCurrency || "", accounts: normalizeAccounts(data.accounts) });
    }
    if (data.holdings) {
      const prior = await getCached<HoldingsResponse>(holdingsCacheKey);
      await setCached(holdingsCacheKey, {
        success: true,
        baseCurrency: prior?.baseCurrency || "",
        totalValueInBase: prior?.totalValueInBase || 0,
        totalValueInUsd: prior?.totalValueInUsd || 0,
        holdings: data.holdings,
      });
    }
    return { success: true, ok: data.ok, accounts: normalizeAccounts(data.accounts), holdings: data.holdings };
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, subscriptionRequired: true, message: "An active Invest subscription is required." };
    }
    return { success: false, message: err?.message || "Could not sync brokerage data." };
  }
}

export async function getSnapTradeAccounts(phone: string): Promise<AccountsResponse> {
  const cacheKey = `investments:accounts:${sanitizePhone(phone)}`;
  try {
    const data = await strictAPICall<{ baseCurrency: string; accounts: BrokerageAccount[] }>(
      `${API_BASE_URL}/snaptrade/accounts?phone=${encodeURIComponent(phone)}`,
      { method: "GET", timeoutMs: 15000, context: "Get brokerage accounts" }
    );
    const result = { success: true, baseCurrency: data.baseCurrency, accounts: normalizeAccounts(data.accounts) };
    await setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, baseCurrency: "", accounts: [], subscriptionRequired: true, message: "An active Invest subscription is required." };
    }
    const cached = await getCached<AccountsResponse>(cacheKey);
    if (cached && Array.isArray(cached.accounts)) return { ...cached, message: err?.message };
    return { success: false, baseCurrency: "", accounts: [], message: err?.message || "Could not load brokerage accounts." };
  }
}

export async function getSnapTradeHoldings(phone: string): Promise<HoldingsResponse> {
  const cacheKey = `investments:holdings:${sanitizePhone(phone)}`;
  try {
    const data = await strictAPICall<{ baseCurrency: string; totalValueInBase: number; totalValueInUsd: number; holdings: Holding[] }>(
      `${API_BASE_URL}/snaptrade/holdings?phone=${encodeURIComponent(phone)}`,
      { method: "GET", timeoutMs: 15000, context: "Get holdings" }
    );
    const result = {
      success: true,
      baseCurrency: data.baseCurrency,
      totalValueInBase: data.totalValueInBase,
      totalValueInUsd: data.totalValueInUsd,
      holdings: data.holdings || [],
    };
    await setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, baseCurrency: "", totalValueInBase: 0, totalValueInUsd: 0, holdings: [], subscriptionRequired: true, message: "An active Invest subscription is required." };
    }
    const cached = await getCached<HoldingsResponse>(cacheKey);
    if (cached && Array.isArray(cached.holdings)) return { ...cached, message: err?.message };
    return { success: false, baseCurrency: "", totalValueInBase: 0, totalValueInUsd: 0, holdings: [], message: err?.message || "Could not load holdings." };
  }
}

export async function getSnapTradeTransactions(phone: string): Promise<TransactionsResponse> {
  const cacheKey = `investments:transactions:${sanitizePhone(phone)}`;
  try {
    const data = await strictAPICall<{ transactions: InvestmentTransaction[] }>(
      `${API_BASE_URL}/snaptrade/transactions?phone=${encodeURIComponent(phone)}`,
      { method: "GET", timeoutMs: 15000, context: "Get investment transactions" }
    );
    const result = { success: true, transactions: data.transactions || [] };
    await setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, transactions: [], subscriptionRequired: true, message: "An active Invest subscription is required." };
    }
    const cached = await getCached<TransactionsResponse>(cacheKey);
    if (cached) return { ...cached, message: err?.message };
    return { success: false, transactions: [], message: err?.message || "Could not load transactions." };
  }
}

// ── Dividends, performance, and tax reporting (subscription-gated) ─────────

export interface DividendsBySymbol {
  symbol: string;
  totalInBase: number;
  count: number;
  currency: string;
}

export interface DividendTransaction {
  symbol: string;
  amount: number;
  currency: string;
  tradeDate: string;
  [key: string]: any;
}

export interface DividendsResponse {
  success: boolean;
  baseCurrency: string;
  totalInBase: number;
  byYear: Record<string, number>;
  bySymbol: DividendsBySymbol[];
  transactions: DividendTransaction[];
  subscriptionRequired?: boolean;
  message?: string;
}

export async function getDividends(phone: string, year?: number): Promise<DividendsResponse> {
  const cacheKey = `investments:dividends:${sanitizePhone(phone)}:${year || "all"}`;
  try {
    const qs = `phone=${encodeURIComponent(phone)}${year ? `&year=${year}` : ""}`;
    const data = await strictAPICall<{ baseCurrency: string; totalInBase: number; byYear: Record<string, number>; bySymbol: DividendsBySymbol[]; transactions: DividendTransaction[] }>(
      `${API_BASE_URL}/snaptrade/dividends?${qs}`,
      { method: "GET", timeoutMs: 15000, context: "Get dividend history" }
    );
    const result = {
      success: true,
      baseCurrency: data.baseCurrency,
      totalInBase: data.totalInBase || 0,
      byYear: data.byYear || {},
      bySymbol: data.bySymbol || [],
      transactions: data.transactions || [],
    };
    await setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, baseCurrency: "", totalInBase: 0, byYear: {}, bySymbol: [], transactions: [], subscriptionRequired: true, message: "An active Invest subscription is required." };
    }
    const cached = await getCached<DividendsResponse>(cacheKey);
    if (cached) return { ...cached, message: err?.message };
    return { success: false, baseCurrency: "", totalInBase: 0, byYear: {}, bySymbol: [], transactions: [], message: err?.message || "Could not load dividend history." };
  }
}

export type PerformanceRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "ALL";

export interface PerformancePoint {
  date: string;
  totalValueInBase: number;
}

export interface PerformanceResponse {
  success: boolean;
  baseCurrency: string;
  range: PerformanceRange;
  series: PerformancePoint[];
  changeInBase: number;
  changePct: number;
  subscriptionRequired?: boolean;
  message?: string;
}

export async function getPerformance(phone: string, range: PerformanceRange = "1M"): Promise<PerformanceResponse> {
  const cacheKey = `investments:performance:${sanitizePhone(phone)}:${range}`;
  try {
    const data = await strictAPICall<{ baseCurrency: string; range: PerformanceRange; series: PerformancePoint[]; changeInBase: number; changePct: number }>(
      `${API_BASE_URL}/snaptrade/performance?phone=${encodeURIComponent(phone)}&range=${encodeURIComponent(range)}`,
      { method: "GET", timeoutMs: 15000, context: "Get performance history" }
    );
    const result = {
      success: true,
      baseCurrency: data.baseCurrency,
      range: data.range || range,
      series: data.series || [],
      changeInBase: data.changeInBase || 0,
      changePct: data.changePct || 0,
    };
    await setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, baseCurrency: "", range, series: [], changeInBase: 0, changePct: 0, subscriptionRequired: true, message: "An active Invest subscription is required." };
    }
    const cached = await getCached<PerformanceResponse>(cacheKey);
    if (cached) return { ...cached, message: err?.message };
    return { success: false, baseCurrency: "", range, series: [], changeInBase: 0, changePct: 0, message: err?.message || "Could not load performance history." };
  }
}

export interface TaxLot {
  symbol: string;
  tradeDate: string;
  quantity: number;
  proceedsInBase: number;
  costBasisInBase: number;
  gainLossInBase: number;
  currency: string;
}

export interface TaxReportResponse {
  success: boolean;
  baseCurrency: string;
  year: number;
  dividendIncome: number;
  totalFees: number;
  realizedGains: number;
  realizedLoss: number;
  netRealized: number;
  lots: TaxLot[];
  disclaimer?: string;
  subscriptionRequired?: boolean;
  message?: string;
}

export async function getTaxReport(phone: string, year?: number): Promise<TaxReportResponse> {
  const targetYear = year || new Date().getFullYear();
  const cacheKey = `investments:tax:${sanitizePhone(phone)}:${targetYear}`;
  try {
    const data = await strictAPICall<{
      baseCurrency: string; year: number; dividendIncome: number; totalFees: number;
      realizedGains: number; realizedLoss: number; netRealized: number; lots: TaxLot[]; disclaimer?: string;
    }>(
      `${API_BASE_URL}/snaptrade/tax-report?phone=${encodeURIComponent(phone)}&year=${targetYear}`,
      { method: "GET", timeoutMs: 15000, context: "Get tax report" }
    );
    const result = {
      success: true,
      baseCurrency: data.baseCurrency,
      year: data.year || targetYear,
      dividendIncome: data.dividendIncome || 0,
      totalFees: data.totalFees || 0,
      realizedGains: data.realizedGains || 0,
      realizedLoss: data.realizedLoss || 0,
      netRealized: data.netRealized || 0,
      lots: data.lots || [],
      disclaimer: data.disclaimer,
    };
    await setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, baseCurrency: "", year: targetYear, dividendIncome: 0, totalFees: 0, realizedGains: 0, realizedLoss: 0, netRealized: 0, lots: [], subscriptionRequired: true, message: "An active Invest subscription is required." };
    }
    const cached = await getCached<TaxReportResponse>(cacheKey);
    if (cached) return { ...cached, message: err?.message };
    return { success: false, baseCurrency: "", year: targetYear, dividendIncome: 0, totalFees: 0, realizedGains: 0, realizedLoss: 0, netRealized: 0, lots: [], message: err?.message || "Could not load tax report." };
  }
}

// ── Generic trading-error classifier ────────────────────────────────────────
// The trading endpoints (search/quotes/trade/orders/performance/benchmark)
// share one uniform error contract across very different failure modes —
// rather than have every screen re-check error.code strings itself, this
// gives a single consistent shape to branch on, with a sensible
// user-facing message already attached. For "snaptrade_error" specifically,
// the spec calls out showing payload.detail when present (e.g. "Insufficient
// buying power") since that's the actual brokerage-side rejection reason,
// not a generic failure.
export type SnapTradeErrorType =
  | "subscription_required"
  | "user_not_found"
  | "account_not_found"
  | "missing_fields"
  | "snaptrade_user_not_initialized"
  | "snaptrade_error"
  | "unknown";

export interface SnapTradeApiError {
  type: SnapTradeErrorType;
  message: string;
  payload?: any;
}

export function classifySnapTradeError(err: unknown): SnapTradeApiError {
  if (err instanceof TransactionError) {
    const details = (err as any).details || {};
    const code = details?.error;
    switch (code) {
      case "subscription_required":
        return { type: "subscription_required", message: "An active Investments subscription is required." };
      case "user_not_found":
        return { type: "user_not_found", message: "We couldn't find your account. Please try signing in again." };
      case "account_not_found":
        return { type: "account_not_found", message: "That brokerage account couldn't be found — it may have been disconnected." };
      case "missing_fields":
        return { type: "missing_fields", message: "Something's missing from this request. Please try again." };
      case "snaptrade_user_not_initialized":
        return { type: "snaptrade_user_not_initialized", message: "Please connect a brokerage account for trading first." };
      case "snaptrade_error":
        return { type: "snaptrade_error", message: details?.payload?.detail || details?.message || "The brokerage rejected this request.", payload: details?.payload };
      default:
        return { type: "unknown", message: details?.message || err.message || "Something went wrong." };
    }
  }
  return { type: "unknown", message: (err as any)?.message || "Something went wrong." };
}

// ── Trade-enabled brokerage connection ──────────────────────────────────────
// Separate from getSnapTradePortalUrl (read-only connect) — this upgrades an
// existing connection to trading-capable, or connects a new one directly
// with trade permissions.
export async function getTradePortalUrl(
  phone: string,
  redirectUrl?: string
): Promise<{ success: boolean; redirectUri?: string; sessionId?: string; snaptradeUserId?: string; message?: string; subscriptionRequired?: boolean }> {
  try {
    const data = await strictAPICall<{ redirectUri?: string; sessionId?: string; snaptradeUserId?: string }>(
      `${API_BASE_URL}/snaptrade/trade-portal-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(redirectUrl ? { phone, redirectUrl } : { phone }),
        timeoutMs: 15000,
        context: "Connect brokerage for trading",
      }
    );
    return { success: true, redirectUri: data.redirectUri, sessionId: data.sessionId, snaptradeUserId: data.snaptradeUserId };
  } catch (err: any) {
    if (isSubscriptionRequiredError(err)) {
      return { success: false, subscriptionRequired: true, message: "An active Investments subscription is required." };
    }
    return { success: false, message: classifySnapTradeError(err).message };
  }
}

// ── Symbol search + quotes ──────────────────────────────────────────────────

export interface TradeSymbol {
  id: string;
  symbol: string;
  description: string;
  exchange: string;
  type: string;
  currency: string;
}

export async function searchSymbols(phone: string, accountId: string, query: string): Promise<{
  success: boolean;
  symbols: TradeSymbol[];
  error?: SnapTradeApiError;
}> {
  try {
    const qs = new URLSearchParams({ phone, accountId, q: query });
    const data = await strictAPICall<{ symbols: TradeSymbol[] }>(
      `${API_BASE_URL}/snaptrade/symbols/search?${qs.toString()}`,
      { method: "GET", headers: { "Content-Type": "application/json" }, timeoutMs: 12000, context: "Search symbols" }
    );
    return { success: true, symbols: Array.isArray(data?.symbols) ? data.symbols : [] };
  } catch (err: any) {
    return { success: false, symbols: [], error: classifySnapTradeError(err) };
  }
}

export interface Quote {
  symbol: string;
  bid_price?: number;
  ask_price?: number;
  last_trade_price?: number;
  [key: string]: any;
}

export async function getQuotes(phone: string, accountId: string, symbolIds: string[]): Promise<{
  success: boolean;
  quotes: Quote[];
  error?: SnapTradeApiError;
}> {
  try {
    const qs = new URLSearchParams({ phone, accountId, symbols: symbolIds.join(",") });
    const data = await strictAPICall<{ quotes: Quote[] }>(
      `${API_BASE_URL}/snaptrade/quotes?${qs.toString()}`,
      { method: "GET", headers: { "Content-Type": "application/json" }, timeoutMs: 12000, context: "Get quotes" }
    );
    return { success: true, quotes: Array.isArray(data?.quotes) ? data.quotes : [] };
  } catch (err: any) {
    return { success: false, quotes: [], error: classifySnapTradeError(err) };
  }
}

// ── Order ticket: preview (impact) → place ──────────────────────────────────

export type TradeAction = "BUY" | "SELL";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type TimeInForce = "Day" | "GTC" | "FOK" | "IOC";

export interface TradeImpactParams {
  phone: string;
  accountId: string;
  action: TradeAction;
  orderType: OrderType;
  timeInForce: TimeInForce;
  universalSymbolId: string;
  units?: number;
  price?: number;
  stop?: number;
  notionalValue?: number;
}

export interface TradeImpactResult {
  success: boolean;
  tradeId?: string;
  trade?: any;
  impact?: { estimated_commission?: number; buying_power?: number; [key: string]: any };
  error?: SnapTradeApiError;
}

/** Always call this first — it's a dry-run preview (commission, buying
 * power impact, etc.) before the user confirms via placeTrade(). */
export async function previewTrade(params: TradeImpactParams): Promise<TradeImpactResult> {
  try {
    const data = await strictAPICall<{ tradeId: string; trade: any; impact: any }>(
      `${API_BASE_URL}/snaptrade/trade/impact`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        timeoutMs: 15000,
        context: "Preview trade",
      }
    );
    return { success: true, tradeId: data.tradeId, trade: data.trade, impact: data.impact };
  } catch (err: any) {
    return { success: false, error: classifySnapTradeError(err) };
  }
}

export interface PlaceTradeParams {
  phone: string;
  /** Confirm a previously-previewed order — preferred path, since the user
   * should always see a preview first per the recommended UI flow. */
  tradeId?: string;
  // Direct-place fields (skips preview) — only used if tradeId is omitted.
  accountId?: string;
  action?: TradeAction;
  orderType?: OrderType;
  timeInForce?: TimeInForce;
  universalSymbolId?: string;
  units?: number;
  price?: number;
  stop?: number;
  notionalValue?: number;
}

export async function placeTrade(params: PlaceTradeParams): Promise<{
  success: boolean;
  order?: { brokerage_order_id: string; status: string; [key: string]: any };
  error?: SnapTradeApiError;
}> {
  try {
    const data = await strictAPICall<{ ok: boolean; order: any }>(
      `${API_BASE_URL}/snaptrade/trade/place`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        timeoutMs: 20000,
        context: "Place trade",
      }
    );
    return { success: !!data.ok, order: data.order };
  } catch (err: any) {
    return { success: false, error: classifySnapTradeError(err) };
  }
}

// ── Pending orders management ───────────────────────────────────────────────

export interface BrokerageOrder {
  brokerage_order_id: string;
  status: string;
  action: string;
  symbol: string;
  quantity: number;
  price?: number;
  time_in_force: string;
  open_quantity?: number;
  filled_quantity?: number;
  time_placed?: string;
  [key: string]: any;
}

export async function getOrders(
  phone: string,
  accountId: string,
  state: "open" | "executed" | "all" = "open",
  days: number = 30
): Promise<{ success: boolean; orders: BrokerageOrder[]; error?: SnapTradeApiError }> {
  try {
    const qs = new URLSearchParams({ phone, accountId, state, days: String(days) });
    const data = await strictAPICall<{ orders: BrokerageOrder[] }>(
      `${API_BASE_URL}/snaptrade/orders?${qs.toString()}`,
      { method: "GET", headers: { "Content-Type": "application/json" }, timeoutMs: 12000, context: "Get orders" }
    );
    return { success: true, orders: Array.isArray(data?.orders) ? data.orders : [] };
  } catch (err: any) {
    return { success: false, orders: [], error: classifySnapTradeError(err) };
  }
}

export async function cancelOrder(phone: string, accountId: string, brokerageOrderId: string): Promise<{
  success: boolean;
  order?: BrokerageOrder;
  error?: SnapTradeApiError;
}> {
  try {
    const data = await strictAPICall<{ ok: boolean; order: BrokerageOrder }>(
      `${API_BASE_URL}/snaptrade/orders/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, accountId, brokerageOrderId }),
        timeoutMs: 15000,
        context: "Cancel order",
      }
    );
    return { success: !!data.ok, order: data.order };
  } catch (err: any) {
    return { success: false, error: classifySnapTradeError(err) };
  }
}

// ── Account performance + benchmark ─────────────────────────────────────────

export interface AccountPerformanceResult {
  success: boolean;
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  performance?: {
    return_rate?: number;
    contributions?: number;
    withdrawals?: number;
    dividends?: number;
    fees?: number;
    total_equity_timeline?: { date: string; value: number }[];
    [key: string]: any;
  };
  error?: SnapTradeApiError;
}

export async function getAccountPerformance(params: {
  phone: string;
  accountId?: string;
  range?: PerformanceRange;
  startDate?: string;
  endDate?: string;
  frequency?: "monthly" | "quarterly" | "yearly";
}): Promise<AccountPerformanceResult> {
  try {
    const qs = new URLSearchParams({ phone: params.phone });
    if (params.accountId) qs.set("accountId", params.accountId);
    if (params.startDate) qs.set("startDate", params.startDate);
    if (params.endDate) qs.set("endDate", params.endDate);
    if (!params.startDate && !params.endDate) qs.set("range", params.range || "1M");
    if (params.frequency) qs.set("frequency", params.frequency);

    const data = await strictAPICall<{ startDate: string; endDate: string; accountIds: string[]; performance: any }>(
      `${API_BASE_URL}/snaptrade/account-performance?${qs.toString()}`,
      { method: "GET", headers: { "Content-Type": "application/json" }, timeoutMs: 15000, context: "Get account performance" }
    );
    return { success: true, startDate: data.startDate, endDate: data.endDate, accountIds: data.accountIds, performance: data.performance };
  } catch (err: any) {
    return { success: false, error: classifySnapTradeError(err) };
  }
}

export interface BenchmarkPoint {
  date: string;
  close: number;
  normalized: number;
}

export interface BenchmarkResult {
  success: boolean;
  symbol?: string;
  currency?: string;
  range?: string;
  series?: BenchmarkPoint[];
  changePct?: number;
  error?: SnapTradeApiError;
}

/** symbol defaults to SPY (S&P 500) — "you vs S&P 500" is the suggested
 * comparison, but any benchmark ticker the backend supports works. */
export async function getBenchmark(symbol: string = "SPY", range: PerformanceRange = "1Y"): Promise<BenchmarkResult> {
  try {
    const qs = new URLSearchParams({ symbol, range });
    const data = await strictAPICall<{ symbol: string; currency: string; range: string; series: BenchmarkPoint[]; changePct: number }>(
      `${API_BASE_URL}/snaptrade/benchmark?${qs.toString()}`,
      { method: "GET", headers: { "Content-Type": "application/json" }, timeoutMs: 15000, context: "Get benchmark" }
    );
    return { success: true, symbol: data.symbol, currency: data.currency, range: data.range, series: Array.isArray(data?.series) ? data.series : [], changePct: data.changePct };
  } catch (err: any) {
    return { success: false, error: classifySnapTradeError(err) };
  }
}

export async function disconnectSnapTradeAccount(
  phone: string,
  accountId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await strictAPICall<any>(`${API_BASE_URL}/snaptrade/accounts/${encodeURIComponent(accountId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      timeoutMs: 15000,
      context: "Disconnect brokerage account",
    });
    // Stale cached accounts/holdings would otherwise still show the
    // disconnected account until the next successful sync overwrites them.
    await AsyncStorage.removeItem(`investments:accounts:${sanitizePhone(phone)}`);
    await AsyncStorage.removeItem(`investments:holdings:${sanitizePhone(phone)}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || "Could not disconnect this account." };
  }
}

// ── Replace (modify) a pending order ────────────────────────────────────────

export interface ReplaceOrderParams {
  phone: string;
  accountId: string;
  brokerageOrderId: string;
  action: TradeAction;
  orderType: "Market" | "Limit" | "Stop" | "StopLimit";
  timeInForce: TimeInForce;
  units?: number;
  price?: number;
  stop?: number | null;
  symbol: string;
}

export async function replaceOrder(params: ReplaceOrderParams): Promise<{
  success: boolean;
  order?: BrokerageOrder;
  error?: SnapTradeApiError;
}> {
  try {
    const data = await strictAPICall<{ ok: boolean; order: BrokerageOrder }>(
      `${API_BASE_URL}/snaptrade/orders/replace`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        timeoutMs: 15000,
        context: "Modify order",
      }
    );
    return { success: !!data.ok, order: data.order };
  } catch (err: any) {
    return { success: false, error: classifySnapTradeError(err) };
  }
}

// ── Crypto trading ───────────────────────────────────────────────────────────

export type CryptoSide = "BUY" | "SELL";
export type CryptoOrderType = "MARKET" | "LIMIT" | "STOP_LOSS_MARKET" | "STOP_LOSS_LIMIT" | "TAKE_PROFIT_MARKET" | "TAKE_PROFIT_LIMIT";
export type CryptoTimeInForce = "GTC" | "FOK" | "IOC" | "GTD";

export interface CryptoOrderParams {
  phone: string;
  accountId: string;
  instrument: { symbol: string; type: "CRYPTOCURRENCY_PAIR" };
  side: CryptoSide;
  type: CryptoOrderType;
  timeInForce: CryptoTimeInForce;
  amount: string;
  limitPrice?: string | null;
  stopPrice?: string | null;
  postOnly?: boolean;
  /** ISO8601 — required when timeInForce is "GTD". */
  expirationDate?: string | null;
}

export async function previewCryptoTrade(params: CryptoOrderParams): Promise<{
  success: boolean;
  preview?: { estimated_fees?: number; [key: string]: any };
  error?: SnapTradeApiError;
}> {
  try {
    const data = await strictAPICall<{ ok: boolean; preview: any }>(
      `${API_BASE_URL}/snaptrade/trade/crypto/preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        timeoutMs: 15000,
        context: "Preview crypto trade",
      }
    );
    return { success: !!data.ok, preview: data.preview };
  } catch (err: any) {
    return { success: false, error: classifySnapTradeError(err) };
  }
}

/** Always call previewCryptoTrade first per the recommended UI flow — this
 * places directly with the same body, no separate confirmation token. */
export async function placeCryptoTrade(params: CryptoOrderParams): Promise<{
  success: boolean;
  order?: BrokerageOrder;
  error?: SnapTradeApiError;
}> {
  try {
    const data = await strictAPICall<{ ok: boolean; order: BrokerageOrder }>(
      `${API_BASE_URL}/snaptrade/trade/crypto/place`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        timeoutMs: 20000,
        context: "Place crypto trade",
      }
    );
    return { success: !!data.ok, order: data.order };
  } catch (err: any) {
    return { success: false, error: classifySnapTradeError(err) };
  }
}

// ── Multi-leg options orders ────────────────────────────────────────────────

export type OptionLegAction = "BUY_TO_OPEN" | "SELL_TO_OPEN" | "BUY_TO_CLOSE" | "SELL_TO_CLOSE";

export interface OptionLeg {
  instrument: { symbol: string; instrument_type: "OPTION" };
  action: OptionLegAction;
  units: number;
}

export interface OptionsOrderParams {
  phone: string;
  accountId: string;
  orderType: "MARKET" | "LIMIT" | "STOP_LOSS_MARKET" | "STOP_LOSS_LIMIT";
  timeInForce: TimeInForce;
  limitPrice?: string;
  priceEffect: "CREDIT" | "DEBIT" | "EVEN";
  legs: OptionLeg[];
}

/** No preview step documented for this one — places directly. Brokerage
 * support for multi-leg options is limited, so a 400 from SnapTrade here
 * is expected sometimes and should be shown as a friendly "not supported
 * by your brokerage" message rather than a generic error. */
export async function placeOptionsOrder(params: OptionsOrderParams): Promise<{
  success: boolean;
  order?: BrokerageOrder;
  error?: SnapTradeApiError;
}> {
  try {
    const data = await strictAPICall<{ ok: boolean; order: BrokerageOrder }>(
      `${API_BASE_URL}/snaptrade/trade/options/place`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        timeoutMs: 20000,
        context: "Place options order",
      }
    );
    return { success: !!data.ok, order: data.order };
  } catch (err: any) {
    const classified = classifySnapTradeError(err);
    if (classified.type === "snaptrade_error") {
      classified.message = classified.message || "This options strategy isn't supported by your connected brokerage.";
    }
    return { success: false, error: classified };
  }
}
