import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as apiConfig from "../../../api/config";
import { getFlutterwaveTransactions, getLocalBalance, getVirtualAccount, VirtualAccount } from "../../../api/flutterwave";
import { getUserTransactions, WalletTransaction } from "../../../api/transactions";
import { usePendingSettlements } from "../../../hooks/usePendingSettlements";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE, TYPE } from "../../../theme/designSystem";
import { useStyles } from "../../../theme/styles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import CountryFlag from "../../CountryFlag";
import DetailRow from "../../DetailRow";
import ScreenShell from "../../ScreenShell";

const CACHED_ACCOUNTS_KEY = "cached_accounts_v1";
const CACHED_WALLET_BALANCE_PREFIX = "cached_wallet_balance_";

/** ✅ Get cached balance for a specific currency (stale-while-revalidate) */
async function getCachedWalletBalance(currencyCode: string): Promise<number | null> {
  try {
    const key = `${CACHED_WALLET_BALANCE_PREFIX}${String(currencyCode || "").toUpperCase().trim()}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw !== null) {
      const num = Number(raw);
      if (Number.isFinite(num)) return num;
    }
  } catch (e) {
    console.log("[WalletScreen] Failed to load cached balance:", e);
  }
  return null;
}

/** ✅ Save cached balance for a specific currency */
async function saveCachedWalletBalance(currencyCode: string, balance: number): Promise<void> {
  try {
    const key = `${CACHED_WALLET_BALANCE_PREFIX}${String(currencyCode || "").toUpperCase().trim()}`;
    await AsyncStorage.setItem(key, String(balance));
  } catch (e) {
    console.log("[WalletScreen] Failed to save cached balance:", e);
  }
}

/** Update a single currency's balance in the shared accounts cache */
async function updateCachedAccountBalance(currencyCode: string, newBalance: number) {
  try {
    const raw = await AsyncStorage.getItem(CACHED_ACCOUNTS_KEY);
    if (!raw) return;
    const accounts = JSON.parse(raw);
    if (!Array.isArray(accounts)) return;

    const ccy = String(currencyCode || "").toUpperCase().trim();
    const updated = accounts.map((acc: any) => {
      if (String(acc?.currencyCode || "").toUpperCase().trim() === ccy) {
        return { ...acc, balance: newBalance };
      }
      return acc;
    });

    await AsyncStorage.setItem(CACHED_ACCOUNTS_KEY, JSON.stringify(updated));
    await saveCachedWalletBalance(currencyCode, newBalance);
  } catch (e) {
    console.log("[WalletScreen] Failed to update cached account balance:", e);
  }
}

interface AccountDetails {
  id: string;
  currencyCode: string;
  accountName: string;
  iban?: string;
  bicSwift?: string;
  status: string;
  balance: number | null;
  flag: string;
  currencyName: string;
  isExotic?: boolean;
  accountNumber?: string;
  routingNumber?: string;
  sortCode?: string;
  bankName?: string;
  bankAddress?: string;
}

interface NGNTransaction {
  id: string; // stable
  amount: number;
  recipientName: string;
  recipientBank: string;
  status: string;
  createdAt: string;
}

/** ---------- Skeleton Components ---------- */
function SkeletonPulse({ style }: { style?: any }) {
  const { colors } = useAppTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.borderLight,
          borderRadius: 8,
        },
        style,
        { opacity },
      ]}
    />
  );
}

function WalletHeaderSkeleton() {
  return (
    <View style={{ alignItems: "center", paddingVertical: 18 }}>
      <SkeletonPulse style={{ width: 60, height: 60, borderRadius: 30, marginBottom: 12 }} />
      <SkeletonPulse style={{ width: 140, height: 14, marginBottom: 10 }} />
      <SkeletonPulse style={{ width: 220, height: 34, borderRadius: 10 }} />
      <View style={{ height: 16 }} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SkeletonPulse style={{ width: 70, height: 44, borderRadius: 16 }} />
        <SkeletonPulse style={{ width: 70, height: 44, borderRadius: 16 }} />
        <SkeletonPulse style={{ width: 70, height: 44, borderRadius: 16 }} />
        <SkeletonPulse style={{ width: 70, height: 44, borderRadius: 16 }} />
      </View>
    </View>
  );
}

function BalanceLineSkeleton() {
  return (
    <View style={{ alignItems: "center", marginVertical: 10 }}>
      <SkeletonPulse style={{ width: 220, height: 34, borderRadius: 10 }} />
    </View>
  );
}

function TransactionRowSkeleton() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}>
      <SkeletonPulse style={{ width: 44, height: 44, borderRadius: 22 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonPulse style={{ width: "70%", height: 16, marginBottom: 6 }} />
        <SkeletonPulse style={{ width: "50%", height: 12, marginBottom: 4 }} />
        <SkeletonPulse style={{ width: "40%", height: 10 }} />
      </View>
      <SkeletonPulse style={{ width: 80, height: 20, borderRadius: 8 }} />
    </View>
  );
}

function TransactionsSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginTop: 8 }}>
      <SkeletonPulse style={{ width: 120, height: 14, marginBottom: 10, marginLeft: 16 }} />

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          marginHorizontal: 12,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: "#EEF3FA",
        }}
      >
        <TransactionRowSkeleton />
        <View style={{ height: 1, backgroundColor: colors.borderLight, marginHorizontal: 16 }} />
        <TransactionRowSkeleton />
        <View style={{ height: 1, backgroundColor: colors.borderLight, marginHorizontal: 16 }} />
        <TransactionRowSkeleton />
      </View>

      <SkeletonPulse style={{ width: 90, height: 14, marginBottom: 10, marginLeft: 16 }} />

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          marginHorizontal: 12,
          borderWidth: 1,
          borderColor: "#EEF3FA",
        }}
      >
        <TransactionRowSkeleton />
        <View style={{ height: 1, backgroundColor: colors.borderLight, marginHorizontal: 16 }} />
        <TransactionRowSkeleton />
      </View>
    </View>
  );
}

/** ---------- helpers ---------- */
function safeNumber(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCcy(v: any) {
  return String(v || "").toUpperCase().trim();
}

function dayKey(dateString: string) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "unknown";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function prettyDayLabel(yyyyMmDd: string) {
  if (yyyyMmDd === "unknown") return "Unknown date";
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stableTxId(parts: Array<string | number | undefined | null>) {
  const raw = parts.map((p) => String(p ?? "")).join("|");
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return `h_${h}`;
}

export default function WalletScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const ws = useMemo(() => StyleSheet.create({

    plainHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.md, paddingBottom: SPACE.sm },
    plainHeaderTitle: { ...TYPE.subtitle, color: colors.text },
    plainRefreshBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, backgroundColor: colors.card, justifyContent: "center", alignItems: "center", ...GLASS_BORDER, ...CARD_SHADOW },
    offlineBanner: { flexDirection: "row", alignItems: "center", backgroundColor: colors.accentLight, borderRadius: RADIUS.sm, padding: SPACE.md, marginBottom: SPACE.md },
    offlineText: { ...TYPE.caption, color: colors.accentDark },
    balanceCard: {
      marginHorizontal: SCREEN_PADDING, marginTop: SPACE.sm, marginBottom: SPACE.sm,
      borderRadius: RADIUS.xl, padding: SPACE.xxl,
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 16,
    },
    heroCenter: { alignItems: "center", marginBottom: SPACE.xxl },
    balCardLabel: { ...TYPE.eyebrow, color: "#FFFFFF", opacity: 0.8, marginTop: SPACE.md, marginBottom: SPACE.sm },
    balCardAmount: { ...TYPE.heroNumber, fontSize: 34, color: "#FFFFFF" },
    balSkel: { width: 160, height: 30, borderRadius: RADIUS.xs, marginTop: SPACE.xs },
    actionRow: { flexDirection: "row", justifyContent: "space-around" },
    balCardActionIcon: { width: 50, height: 50, borderRadius: RADIUS.full, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center" },
    actionLabel: { ...TYPE.caption, color: "#FFFFFF", marginTop: SPACE.xs },
    tabs: { flexDirection: "row", backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
    tab: { flex: 1, paddingVertical: SPACE.md + 1, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabActive: { borderBottomColor: colors.primary },
    tabText: { ...TYPE.caption, color: colors.muted },
    tabTextActive: { color: colors.primary, fontWeight: "600" as const },
    limitsPill: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: SPACE.xs, marginTop: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, backgroundColor: colors.primaryLight, borderRadius: RADIUS.full },
    limitsPillText: { ...TYPE.caption, fontWeight: "600" as const, color: colors.primary },
    detailCard: { backgroundColor: colors.card, borderRadius: RADIUS.md, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
    detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
    detailHeaderTitle: { ...TYPE.eyebrow, color: colors.muted },
    copyAllBtn: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, backgroundColor: colors.primaryLight, borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm + 2, paddingVertical: SPACE.xs + 2 },
    copyAllText: { ...TYPE.caption, fontWeight: "600" as const, color: colors.primary },
  }), [colors]);

  const [tab, setTab] = useState("Transactions");
  const [account, setAccount] = useState<AccountDetails | null>(null);

  // Transactions state
  const [ngnTransactions, setNgnTransactions] = useState<NGNTransaction[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);

  // ✅ Loading flags (skeletons only)
  const [txInitialLoading, setTxInitialLoading] = useState(true);
  const [txRefreshing, setTxRefreshing] = useState(false);
  const [balanceInitialLoading, setBalanceInitialLoading] = useState(true);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);

  const hasLoadedOnceRef = useRef(false);
  const isFetchingBalanceRef = useRef(false);

  const isNGN = account?.currencyCode?.toUpperCase() === "NGN";

  // Currencies that settle via Mobile Money (no virtual-account / IBAN concept)
  const MOMO_ONLY_CURRENCIES = ["GHS", "KES", "UGX", "TZS", "RWF", "ZMW", "XOF", "XAF"];
  const isMomoOnly = MOMO_ONLY_CURRENCIES.includes((account?.currencyCode || "").toUpperCase());
  // NGN gets the virtual-account view; MoMo-only exotic currencies get no Account tab at all;
  // everything else (CAD, USD, EUR, GBP, ...) keeps the standard IBAN/SWIFT details.
  const showAccountTab = !isMomoOnly;

  // ── NGN Virtual Account (for the Account Details tab) ──
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [vaLoading, setVaLoading] = useState(false);
  const [vaError, setVaError] = useState<string | null>(null);
  const vaFetchedRef = useRef(false);

  const fetchVirtualAccount = useCallback(async (forceRefresh = false) => {
    if (!isNGN) return;
    const phone = await AsyncStorage.getItem("user_phone");
    if (!phone) return;

    setVaLoading(true);
    setVaError(null);
    try {
      const res = await getVirtualAccount(phone);
      if (res.success && res.account) {
        setVirtualAccount(res.account);
        // Keep cache fresh / in sync so other screens (Add Money) don't show stale data
        await AsyncStorage.setItem("cached_virtual_account", JSON.stringify(res.account));
      } else if (forceRefresh) {
        // Explicit refresh found nothing — clear any stale cached account rather than
        // leaving the old (possibly admin-deleted) details on screen
        setVirtualAccount(null);
        await AsyncStorage.removeItem("cached_virtual_account");
        setVaError(res.message || "No virtual account found.");
      } else {
        setVirtualAccount(null);
        setVaError(res.message || "No virtual account found.");
      }
    } catch (e: any) {
      setVaError(e?.message || "Could not load account details.");
    } finally {
      setVaLoading(false);
    }
  }, [isNGN]);

  useEffect(() => {
    if (!showAccountTab && tab === "Account") {
      setTab("Transactions");
    }
  }, [showAccountTab, tab]);

  useEffect(() => {
    if (tab === "Account" && isNGN && !vaFetchedRef.current) {
      vaFetchedRef.current = true;
      fetchVirtualAccount();
    }
    if (tab !== "Account") {
      // Allow a fresh fetch next time the tab is opened, so admin-side changes
      // (e.g. a deleted virtual account) are picked up instead of showing stale data
      vaFetchedRef.current = false;
    }
  }, [tab, isNGN, fetchVirtualAccount]);

  const [offlineMsg, setOfflineMsg] = useState<string | null>(null);
  const lastOfflineShownRef = useRef<number>(0);
  const showOfflineOnce = (msg: string) => {
    const now = Date.now();
    if (now - lastOfflineShownRef.current < 8000) return;
    lastOfflineShownRef.current = now;
    setOfflineMsg(msg);
  };

  /** ---- Pending settlements (hybrid balance) ---- **/
  const {
    getOptimisticBalance,
    refresh: refreshPendingSettlements,
    settlements,
    checkAndClearIfSettled,
    removeSettlement,
  } = usePendingSettlements();

  const currencyCode = normalizeCcy(account?.currencyCode);
  const displayBalance =
    account?.balance !== null && account?.balance !== undefined
      ? getOptimisticBalance(account.balance, currencyCode)
      : account?.balance;

  // ✅ Parse initial account data (with SWR cache hydration)
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!params.accountData) return;

      try {
        const parsed = JSON.parse(params.accountData as string);
        const rawBalance = (parsed as any)?.balance;
        const balanceNum =
          typeof rawBalance === "number"
            ? rawBalance
            : typeof rawBalance === "string" && rawBalance.trim() !== ""
              ? Number(rawBalance)
              : NaN;

        let initialBalance = Number.isFinite(balanceNum) ? balanceNum : null;
        const ccy = normalizeCcy((parsed as any)?.currencyCode);

        if (initialBalance === null && ccy) {
          const cachedIndividual = await getCachedWalletBalance(ccy);
          if (cachedIndividual !== null) initialBalance = cachedIndividual;
        }

        if (initialBalance === null && ccy) {
          const cachedAccountsRaw = await AsyncStorage.getItem(CACHED_ACCOUNTS_KEY);
          if (cachedAccountsRaw) {
            const cached = JSON.parse(cachedAccountsRaw);
            if (Array.isArray(cached)) {
              const cachedMatch = cached.find((a: any) => normalizeCcy(a?.currencyCode) === ccy);
              const cachedBal = cachedMatch?.balance;
              const cachedNum =
                typeof cachedBal === "number"
                  ? cachedBal
                  : typeof cachedBal === "string" && cachedBal.trim() !== ""
                    ? Number(cachedBal)
                    : NaN;

              if (Number.isFinite(cachedNum)) initialBalance = cachedNum;
            }
          }
        }

        if (cancelled) return;
        setAccount({ ...(parsed as any), balance: initialBalance });
      } catch (e) {
        console.log("Error parsing account data:", e);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [params.accountData]);

  // ✅ Refresh balance (no spinner: skeleton only)
  const refreshBalance = useCallback(async () => {
    if (!account?.currencyCode) return;

    if (isFetchingBalanceRef.current) return;
    isFetchingBalanceRef.current = true;

    const isLocalLedger = Boolean(account?.isExotic) || isNGN;

    try {
      // Skeleton behavior:
      // - first load: show skeleton
      // - background refresh: keep current number visible BUT add a thin skeleton line below (or replace line if you prefer)
      if (!hasLoadedOnceRef.current) setBalanceInitialLoading(true);
      else setBalanceRefreshing(true);

      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) return;

      let nextBalance: number | null | undefined = undefined;

      if (isLocalLedger) {
        const response = await getLocalBalance(phone, account.currencyCode);
        const next = safeNumber((response as any)?.balance, NaN);
        if ((response as any)?.success && Number.isFinite(next)) {
          nextBalance = next;
          setAccount((prev) => (prev ? { ...prev, balance: next } : null));
          await updateCachedAccountBalance(account.currencyCode, next);
        }
      } else {
        const response = (apiConfig as any).getUserWallets
          ? await (apiConfig as any).getUserWallets(phone)
          : { success: false };

        if ((response as any)?.success) {
          const updatedWallet = ((response as any).wallets || []).find(
            (w: any) => normalizeCcy(w.currencyCode) === normalizeCcy(account.currencyCode)
          );
          const raw = updatedWallet?.balance;
          const next = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;

          if (Number.isFinite(next)) {
            nextBalance = next;
            setAccount((prev) => (prev ? { ...prev, balance: next } : null));
            await updateCachedAccountBalance(account.currencyCode, next);
          }
        }
      }

      // Clear pending settlement once balances match
      if (typeof nextBalance === "number" && settlements.length > 0) {
        const ccy = normalizeCcy(account.currencyCode);
        const related = settlements.filter(
          (s) => normalizeCcy(s.sellCurrency) === ccy || normalizeCcy(s.buyCurrency) === ccy
        );

        for (const s of related) {
          const sellCcy = normalizeCcy(s.sellCurrency);
          const buyCcy = normalizeCcy(s.buyCurrency);

          const sellNeedsConfirm = safeNumber(s.sellAmount, 0) !== 0;
          const buyNeedsConfirm = safeNumber(s.buyAmount, 0) !== 0;

          const sellSettled =
            !sellNeedsConfirm
              ? true
              : sellCcy === ccy && typeof s.sellBalanceBefore === "number"
                ? await checkAndClearIfSettled(
                  sellCcy,
                  nextBalance,
                  safeNumber(s.sellBalanceBefore, 0) - safeNumber(s.sellAmount, 0),
                  0.01
                )
                : false;

          const buySettled =
            !buyNeedsConfirm
              ? true
              : buyCcy === ccy && typeof s.buyBalanceBefore === "number"
                ? await checkAndClearIfSettled(
                  buyCcy,
                  nextBalance,
                  safeNumber(s.buyBalanceBefore, 0) + safeNumber(s.buyAmount, 0),
                  0.01
                )
                : false;

          if (sellSettled && buySettled) {
            await removeSettlement(s.id, true);
          }
        }
      }

      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.log("Failed to refresh balance:", error);
    } finally {
      isFetchingBalanceRef.current = false;
      setBalanceInitialLoading(false);
      setBalanceRefreshing(false);
    }
  }, [account?.currencyCode, account?.isExotic, isNGN, settlements, checkAndClearIfSettled, removeSettlement]);

  // ✅ NGN transactions
  const fetchNGNTransactions = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isNGN) return;
      const silent = !!opts?.silent;

      try {
        if (!silent) setTxInitialLoading(true);
        else setTxRefreshing(true);

        const phone = await AsyncStorage.getItem("user_phone");
        if (!phone) return;

        const response = await getFlutterwaveTransactions(phone);
        if ((response as any)?.success) {
          const mapped: NGNTransaction[] = (response.transactions || []).map((t: any) => ({
            id:
              t.id ??
              t.transaction_id ??
              t.tx_ref ??
              t.flw_ref ??
              stableTxId([t.created_at, t.amount, t.recipient_name]),
            amount: Number(t.amount ?? t.amount_paid ?? t.charge ?? 0),
            recipientName:
              t.recipientName ??
              t.recipient_name ??
              t.recipient?.name ??
              t.customer?.name ??
              t.name ??
              t.beneficiary_name ??
              t.account_name ??
              t.counterparty_name ??
              "—",
            recipientBank:
              t.recipientBankName ??
              t.recipient_bank_name ??
              t.recipient?.bank ??
              t.customer?.bank ??
              t.beneficiary_bank ??
              t.bank ??
              t.account_bank ??
              t.counterparty_bank ??
              "—",
            status: t.status ?? t.transaction_status ?? t.response_code ?? "pending",
            createdAt: t.created_at ?? t.createdAt ?? t.date ?? new Date().toISOString(),
          }));
          setNgnTransactions(mapped);
        }
      } catch (error) {
        console.log("Failed to fetch NGN transactions:", error);
      } finally {
        setTxInitialLoading(false);
        setTxRefreshing(false);
      }
    },
    [isNGN]
  );

  // ✅ non-NGN transactions
  const fetchWalletTransactions = useCallback(async (opts?: { silent?: boolean }) => {
    if (!account?.currencyCode) return;

    const silent = !!opts?.silent;

    try {
      if (!silent) setTxInitialLoading(true);
      else setTxRefreshing(true);

      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) return;

      const response = await getUserTransactions(phone, 1, 50, account.currencyCode);
      if ((response as any)?.success) {
        const next = (response as any).transactions || [];
        if (Array.isArray(next)) setWalletTransactions(next);
      } else {
        if ((response as any).isNetworkError) {
          showOfflineOnce((response as any).message || "Please check your connection.");
        }
      }
    } catch (error) {
      console.log("Failed to fetch wallet transactions:", error);
    } finally {
      setTxInitialLoading(false);
      setTxRefreshing(false);
    }
  }, [account?.currencyCode]);


  const initialLoadDoneRef = useRef(false);
  // ✅ Initial load once account is ready
  useEffect(() => {
    if (!account?.currencyCode) return;
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    (async () => {
      await refreshPendingSettlements();
      // await refreshBalance();

      if (isNGN) {
        await Promise.all([fetchNGNTransactions({ silent: false }), fetchWalletTransactions({ silent: false })]);
      } else {
        await fetchWalletTransactions({ silent: false });
      }
    })();
  }, [account?.currencyCode]);

  // ✅ Auto polling (silent refresh => skeleton overlay only, no spinner)
  // const fetchAllData = useCallback(async () => {
  //   if (!account) return;
  //   await refreshPendingSettlements();
  //   await refreshBalance();

  //   if (isNGN) {
  //     await Promise.all([fetchNGNTransactions({ silent: true }), fetchWalletTransactions({ silent: true })]);
  //   } else {
  //     await fetchWalletTransactions({ silent: true });
  //   }
  // }, [account, refreshPendingSettlements, refreshBalance, isNGN, fetchNGNTransactions, fetchWalletTransactions]);

  // useAutoPolling(fetchAllData, {
  //   intervalMs: settlements.length > 0 ? 15000 : 60000,
  //   enabled: !!account?.currencyCode,
  //   fetchOnMount: false,
  // });

  // ✅ Manual refresh button (no RefreshControl spinner)
  const onPressRefresh = useCallback(async () => {
    setTxRefreshing(true);
    try {
      await refreshPendingSettlements();
      await refreshBalance();
      if (isNGN) {
        await Promise.all([fetchNGNTransactions({ silent: true }), fetchWalletTransactions({ silent: true })]);
      } else {
        await fetchWalletTransactions({ silent: true });
      }
    } finally {
      setTxRefreshing(false);
    }
  }, [isNGN, refreshPendingSettlements, refreshBalance, fetchNGNTransactions, fetchWalletTransactions]);

  const formatBalance = (balance: number | null | undefined, ccy: string) => {
    if (balance === null || balance === undefined) return `— ${ccy}`;
    return `${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;
  };

  const normalizeStatus = (s: string) => {
    const x = String(s || "").toLowerCase().trim();
    if (x.includes("complete") || x.includes("success")) return "completed";
    if (x.includes("pend") || x.includes("process") || x.includes("queue")) return "pending";
    if (x.includes("fail") || x.includes("error") || x.includes("cancel")) return "failed";
    return "pending";
  };

  const statusLabel = (s: string) => {
    const key = normalizeStatus(s);
    if (key === "completed") return "Completed";
    if (key === "pending") return "Processing";
    return "Failed";
  };

  const getTransactionIcon = (type: string) => {
    const t = type?.toLowerCase() || "";
    if (t.includes("deposit") || t.includes("credit") || t.includes("inbound") || t.includes("funding")) return "↓";
    if (t.includes("withdraw") || t.includes("debit") || t.includes("payout") || t.includes("send")) return "↑";
    if (t.includes("convert") || t.includes("exchange")) return "↻";
    return "⇄";
  };

  const isCredit = (type: string) => {
    const t = type?.charAt(0).toUpperCase() + type?.slice(1) || "";
    return t.includes("Deposit") || t.includes("Credit") || t.includes("Inbound") || t.includes("Funding");
  };

  const ngnGroups = useMemo(() => {
    const groups: Record<string, NGNTransaction[]> = {};
    for (const tx of ngnTransactions) {
      const key = dayKey(tx.createdAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }
    const entries = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    entries.forEach(([, arr]) => arr.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()));
    return entries;
  }, [ngnTransactions]);

  const walletGroups = useMemo(() => {
    const groups: Record<string, WalletTransaction[]> = {};
    for (const tx of walletTransactions) {
      const key = dayKey(tx.createdAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }
    const entries = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    entries.forEach(([, arr]) => arr.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()));
    return entries;
  }, [walletTransactions]);

  // ✅ No spinner when account missing: show skeleton header
  if (!account) {
    return (
      <ScreenShell>
        <WalletHeaderSkeleton />
        <TransactionsSkeleton />
      </ScreenShell>
    );
  }

  const renderTransactionsList = () => {
    // skeleton on first load
    if (txInitialLoading) return <TransactionsSkeleton />;

    // while refreshing: keep list AND show skeleton overlay at top (no spinner)
    const refreshingOverlay = txRefreshing ? (
      <View style={{ marginTop: 8 }}>
        <TransactionsSkeleton />
      </View>
    ) : null;

    if (isNGN) {
      const hasLedger = walletTransactions.length > 0;
      const hasPayouts = ngnTransactions.length > 0;
      if (!hasLedger && !hasPayouts) {
        return (
          <View>
            {refreshingOverlay}
            <AppText style={styles.walletTxEmpty}>No transactions yet</AppText>
          </View>
        );
      }

      return (
        <ScrollView showsVerticalScrollIndicator={false}>
          {refreshingOverlay}

          {/* Ledger tx */}
          {hasLedger &&
            walletGroups.map(([day, items]) => (
              <View key={`ledger-${day}`}>
                <AppText style={styles.walletTxGroupTitle}>{prettyDayLabel(day)}</AppText>

                <View style={styles.walletTxCard}>
                  {items.map((tx, idx) => {
                    const sKey = normalizeStatus(tx.status);
                    const statusStyle =
                      sKey === "completed"
                        ? styles.walletTxStatusCompleted
                        : sKey === "failed"
                          ? styles.walletTxStatusFailed
                          : styles.walletTxStatusPending;

                    const txIsCredit = isCredit(tx.transactionType);
                    const rowKey = String(
                      tx.id ||
                      tx.reference ||
                      stableTxId([tx.createdAt, tx.amount, tx.transactionType, tx.currency, tx.counterpartyName])
                    );

                    return (
                      <View key={rowKey}>
                        <Pressable
                          style={styles.walletTxRow}
                          onPress={() =>
                            router.push({
                              pathname: "/transactiondetail/[reference]",
                              params: { reference: encodeURIComponent(String(tx.reference)) },
                            } as any)
                          }
                        >
                          <View style={styles.walletTxIconWrap}>
                            <AppText style={styles.walletTxIconText}>{getTransactionIcon(tx.transactionType)}</AppText>
                          </View>

                          <View style={styles.walletTxMid}>
                            <AppText style={styles.walletTxName} numberOfLines={1}>
                              {tx.counterpartyName || tx.description || tx.transactionType || "Transaction"}
                            </AppText>

                            <AppText style={styles.walletTxBank} numberOfLines={1}>
                              {tx.counterpartyBank || tx.transactionType}
                            </AppText>

                            <View style={styles.walletTxMetaRow}>
                              <AppText style={styles.walletTxTime}>
                                {new Date(tx.createdAt).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </AppText>
                              <AppText style={[styles.walletTxStatus, statusStyle]}>• {statusLabel(tx.status)}</AppText>
                            </View>
                          </View>

                          <View style={styles.walletTxRight}>
                            <AppText style={[styles.walletTxAmt, txIsCredit ? styles.walletTxAmtPos : styles.walletTxAmtNeg]}>
                              {txIsCredit ? "+" : "-"}
                              {tx.currency}{" "}
                              {safeNumber(tx.amount, 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </AppText>
                          </View>
                        </Pressable>

                        {idx !== items.length - 1 && <View style={styles.walletTxDivider} />}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

          {/* NGN payouts (Flutterwave) */}
          {hasPayouts &&
            ngnGroups.map(([day, items]) => (
              <View key={`payout-${day}`}>
                <AppText style={styles.walletTxGroupTitle}>{prettyDayLabel(day)}</AppText>

                <View style={styles.walletTxCard}>
                  {items.map((tx, idx) => {
                    const sKey = normalizeStatus(tx.status);
                    const statusStyle =
                      sKey === "completed"
                        ? styles.walletTxStatusCompleted
                        : sKey === "failed"
                          ? styles.walletTxStatusFailed
                          : styles.walletTxStatusPending;

                    return (
                      <View key={tx.id}>
                        <Pressable style={styles.walletTxRow}>
                          <View style={styles.walletTxIconWrap}>
                            <AppText style={styles.walletTxIconText}>⇄</AppText>
                          </View>

                          <View style={styles.walletTxMid}>
                            <AppText style={styles.walletTxName} numberOfLines={1}>
                              {tx.recipientName}
                            </AppText>

                            <AppText style={styles.walletTxBank} numberOfLines={1}>
                              {tx.recipientBank}
                            </AppText>

                            <View style={styles.walletTxMetaRow}>
                              <AppText style={styles.walletTxTime}>
                                {new Date(tx.createdAt).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </AppText>
                              <AppText style={[styles.walletTxStatus, statusStyle]}>• {statusLabel(tx.status)}</AppText>
                            </View>
                          </View>

                          <View style={styles.walletTxRight}>
                            <AppText style={[styles.walletTxAmt, styles.walletTxAmtNeg]}>
                              -₦{safeNumber(tx.amount, 0).toLocaleString()}
                            </AppText>
                          </View>
                        </Pressable>

                        {idx !== items.length - 1 && <View style={styles.walletTxDivider} />}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

          <View style={{ height: 18 }} />
        </ScrollView>
      );
    }

    // non-NGN
    if (walletTransactions.length === 0) {
      return (
        <View>
          {refreshingOverlay}
          <AppText style={styles.walletTxEmpty}>No transactions yet</AppText>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {refreshingOverlay}

        {walletGroups.map(([day, items]) => (
          <View key={day} style={{ padding: 12 }}>
            <AppText style={styles.walletTxGroupTitle}>{prettyDayLabel(day)}</AppText>

            <View style={styles.walletTxCard}>
              {items.map((tx, idx) => {
                const sKey = normalizeStatus(tx.status);
                const statusStyle =
                  sKey === "completed"
                    ? styles.walletTxStatusCompleted
                    : sKey === "failed"
                      ? styles.walletTxStatusFailed
                      : styles.walletTxStatusPending;

                const txIsCredit = isCredit(tx.transactionType);
                const rowKey = String(
                  tx.id || tx.reference || stableTxId([tx.createdAt, tx.amount, tx.transactionType, tx.currency, tx.counterpartyName])
                );

                return (
                  <View key={rowKey}>
                    <Pressable
                      style={styles.walletTxRow}
                      onPress={() =>
                        router.push({
                          pathname: "/transactiondetail/[reference]",
                          params: { reference: encodeURIComponent(String(tx.reference)) },
                        } as any)
                      }
                    >
                      <View style={styles.walletTxIconWrap}>
                        <AppText style={styles.walletTxIconText}>{getTransactionIcon(tx.transactionType)}</AppText>
                      </View>

                      <View style={styles.walletTxMid}>
                        <AppText style={styles.walletTxName} numberOfLines={1}>
                          {tx.counterpartyName || tx.description || tx.transactionType || "Transaction"}
                        </AppText>

                        <AppText style={styles.walletTxBank} numberOfLines={1}>
                          {tx.counterpartyBank || tx.transactionType}
                        </AppText>

                        <View style={styles.walletTxMetaRow}>
                          <AppText style={styles.walletTxTime}>
                            {new Date(tx.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </AppText>
                          <AppText style={[styles.walletTxStatus, statusStyle]}>• {statusLabel(tx.status)}</AppText>
                        </View>
                      </View>

                      <View style={styles.walletTxRight}>
                        <AppText style={[styles.walletTxAmt, txIsCredit ? styles.walletTxAmtPos : styles.walletTxAmtNeg]}>
                          {txIsCredit ? "+" : "-"}
                          {tx.currency}{" "}
                          {safeNumber(tx.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </AppText>
                      </View>
                    </Pressable>

                    {idx !== items.length - 1 && <View style={styles.walletTxDivider} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <View style={{ height: 18 }} />
      </ScrollView>
    );
  };

  return (
    <ScreenShell scrollable={false} padded={false}>
      {/* ── Plain header ── */}
      <View style={ws.plainHeaderRow}>
        <BackButton onPress={() => router.back()} />
        <AppText style={ws.plainHeaderTitle}>{account.currencyCode} Wallet</AppText>
        <Pressable onPress={onPressRefresh} style={ws.plainRefreshBtn}>
          <Ionicons name="refresh-outline" size={16} color={colors.text} />
        </Pressable>
      </View>

      {!!offlineMsg && (
        <View style={[ws.offlineBanner, { marginHorizontal: 16, marginTop: 0 }]}>
          <Ionicons name="wifi-outline" size={13} color={colors.accentDark} />
          <AppText style={ws.offlineText}> {offlineMsg}</AppText>
        </View>
      )}

      {/* ── Balance card ── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ws.balanceCard}
      >
        <View style={ws.heroCenter}>
          <CountryFlag currencyCode={account.currencyCode} fallbackEmoji={account.flag} size="lg" />
          <AppText style={ws.balCardLabel}>{account.currencyCode} Balance</AppText>
          {balanceInitialLoading && account.balance === null ? (
            <View style={[ws.balSkel, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
          ) : (
            <>
              <AppText style={ws.balCardAmount}>{formatBalance(displayBalance, account.currencyCode)}</AppText>
              {balanceRefreshing && <View style={[ws.balSkel, { width: 100, marginTop: 6, backgroundColor: "rgba(255,255,255,0.2)" }]} />}
            </>
          )}
        </View>

        {/* ── Action buttons ── */}
        <View style={ws.actionRow}>
          {(() => {
            const ccy = (account.currencyCode || "").toUpperCase();
            const isCAD = ccy === "CAD";
            // CAD uses the existing CAD-only methods (Interac / EFT / Card)
            // All other currencies use the local deposit screen
            const addRoute = isCAD
              ? `/addmoneymethods?currencyCode=${ccy}`
              : `/add-money/local?currency=${ccy}`;
            return [
              { icon: "arrow-up-outline", label: "Send", route: `/sendmoney?from=${ccy}` },
              { icon: "add", label: "Add", route: addRoute },
              { icon: "repeat-outline", label: "Convert", route: `/convert?from=${ccy}` },
              { icon: "arrow-down-outline", label: "Withdraw", route: `/withdraw?currency=${ccy}` },
            ].map(a => (
              <Pressable key={a.label} onPress={() => router.push(a.route as any)} style={{ alignItems: "center", gap: SPACE.sm }}>
                <View style={ws.balCardActionIcon}>
                  <Ionicons name={a.icon as any} size={20} color="#FFFFFF" />
                </View>
                <AppText style={ws.actionLabel}>{a.label}</AppText>
              </Pressable>
            ));
          })()}
        </View>
      </LinearGradient>

      {/* ── Tabs ── */}
      <View style={ws.tabs}>
        {(showAccountTab ? ["Transactions", "Account"] : ["Transactions"]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[ws.tab, tab === t && ws.tabActive]}>
            <AppText style={[ws.tabText, tab === t && ws.tabTextActive]}>{t === "Account" ? "Account Details" : t}</AppText>
          </Pressable>
        ))}
      </View>

      {/* ── Limits pill ── */}
      {!isNGN && (
        <Pressable
          style={ws.limitsPill}
          onPress={() => router.push({ pathname: "/accountlimit", params: { currency: account.currencyCode } } as any)}
        >
          <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
          <AppText style={ws.limitsPillText}>View account limits</AppText>
        </Pressable>
      )}

      {/* ── Content ── */}
      {tab === "Transactions" ? (
        <View style={{ flex: 1 }}>{renderTransactionsList()}</View>
      ) : isNGN ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          <View style={ws.detailCard}>
            <View style={ws.detailHeader}>
              <AppText style={ws.detailHeaderTitle}>NGN Virtual Account</AppText>
              <Pressable
                onPress={() => fetchVirtualAccount(true)}
                style={ws.copyAllBtn}
                disabled={vaLoading}
              >
                <Ionicons name="refresh-outline" size={13} color={colors.primary} />
                <AppText style={ws.copyAllText}>{vaLoading ? "Refreshing…" : "Refresh"}</AppText>
              </Pressable>
            </View>

            {vaLoading && !virtualAccount ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <AppText style={{ color: colors.muted, fontSize: 13 }}>Loading account details…</AppText>
              </View>
            ) : virtualAccount ? (
              <>
                <DetailRow k="Bank name" v={virtualAccount.bankName} />
                <DetailRow k="Account number" v={virtualAccount.accountNumber} />
                <DetailRow k="Account name" v={virtualAccount.accountName} />
                {!!virtualAccount.expiresAt && (
                  <DetailRow
                    k="Valid until"
                    v={new Date(virtualAccount.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    copyable={false}
                  />
                )}
                <DetailRow k="Status" v="Active" copyable={false} />
              </>
            ) : (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Ionicons name="card-outline" size={32} color={colors.muted} style={{ marginBottom: 10 }} />
                <AppText style={{ color: colors.text, fontWeight: "600", fontSize: 14, marginBottom: 4 }}>
                  No virtual account yet
                </AppText>
                <AppText style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginBottom: 16 }}>
                  {vaError || "Set one up from Add Money to start receiving NGN deposits."}
                </AppText>
                <Pressable
                  onPress={() => router.push(`/add-money/local?currency=NGN` as any)}
                  style={{ backgroundColor: colors.actionBg, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 }}
                >
                  <AppText style={{ color: colors.actionText, fontWeight: "600", fontSize: 13 }}>Set up now</AppText>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={ws.detailCard}>
            <View style={ws.detailHeader}>
              <AppText style={ws.detailHeaderTitle}>Account Details</AppText>
              <Pressable
                onPress={async () => {
                  const lines = [
                    `Account Name: ${account.accountName || "—"}`,
                    `Currency: ${account.currencyName} (${account.currencyCode})`,
                    account.iban ? `IBAN: ${account.iban}` : "",
                    account.bicSwift ? `BIC/SWIFT: ${account.bicSwift}` : "",
                    account.accountNumber ? `Account Number: ${account.accountNumber}` : "",
                    account.routingNumber ? `Routing Number: ${account.routingNumber}` : "",
                    account.sortCode ? `Sort Code: ${account.sortCode}` : "",
                    account.bankName ? `Bank Name: ${account.bankName}` : "",
                    account.bankAddress ? `Bank Address: ${account.bankAddress}` : "",
                  ].filter(Boolean).join("\n");
                  await (await import("expo-clipboard")).setStringAsync(lines);
                  Alert.alert("Copied!", "Account details copied to clipboard.");
                }}
                style={ws.copyAllBtn}
              >
                <Ionicons name="copy-outline" size={13} color={colors.primary} />
                <AppText style={ws.copyAllText}>Copy all</AppText>
              </Pressable>
            </View>
            <DetailRow k="Account name" v={account.accountName || "—"} />
            <DetailRow k="Currency" v={`${account.currencyName || account.currencyCode} (${account.currencyCode})`} />
            {!!account.iban && <DetailRow k="IBAN" v={account.iban} />}
            {!!account.bicSwift && <DetailRow k="BIC/SWIFT" v={account.bicSwift} />}
            {!!account.accountNumber && <DetailRow k="Account Number" v={account.accountNumber} />}
            {!!account.routingNumber && <DetailRow k="Routing Number" v={account.routingNumber} />}
            {!!account.sortCode && <DetailRow k="Sort Code" v={account.sortCode} />}
            {!!account.bankName && <DetailRow k="Bank Name" v={account.bankName} />}
            {!!account.bankAddress && <DetailRow k="Bank Address" v={account.bankAddress} />}
            <DetailRow k="Status" v={account.status || "Active"} copyable={false} />
          </View>
        </ScrollView>
      )}
    </ScreenShell>
  );
}

