import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StatusBar, View, StyleSheet, Dimensions } from "react-native";
import AppText from "../../AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import NetInfo from "@react-native-community/netinfo";

import {
  checkEmailVerified, getExchangeRates,
  getTotalBalance, getUserAccounts, getUserProfile, sendEmailOtp,
  getReferralConfig, getActivePromotionalBanners, PromotionalBanner,
} from "@/api/config";
import { getUserTransactions, WalletTransaction } from "@/api/transactions";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";
import { getRecentRecipientsFromDB, getLocalRecentRecipients, RecentRecipientFromDB } from "@/api/sync";
import { fetchMyFeeWaivers, FeeWaiversResponse } from "@/api/feeWaivers";
import FeeWaiverBanner from "@/components/FeeWaiverBanner";
import RecipientAvatar from "@/components/RecipientAvatar";
import BiometricPromptBanner from "@/components/BiometricPromptBanner";
import { getIncomingMoneyRequests } from "@/api/moneyRequests";
import { getLocalBalance } from "../../../api/flutterwave";
import { usePendingSettlements, clearPendingForCurrency } from "../../../hooks/usePendingSettlements";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { LinearGradient } from "expo-linear-gradient";
import { useStyles } from "../../../theme/styles";
import { SPACE, RADIUS, TYPE, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "../../../theme/designSystem";
import { userScopedKey } from "../../../utils/cacheKeys";
import CountryFlag from "../../../components/CountryFlag";
import { PendingBadge } from "../../../components/PendingBadge";
import VerifyEmailCard from "../../../components/src/screens/VerifyEmailCardScreen";
import VerifyIdentityCardScreen from "./VerifyIdentityCardScreen";
import BottomSheet from "../../BottomSheet";
import HomeQuickActionsCarousel from "../../HomeQuickActionsCarousel";
import { useNotificationContext } from "../../../context/NotificationContext";
import { COLORS } from "@/theme/colors";

// ─── Types ───────────────────────────────────────────────────
type UserAccount = {
  id: string; currencyCode: string; accountName: string;
  balance?: number | null; iban?: string; bicSwift?: string;
  accountNumber: string; routingNumber: string; sortCode: string;
  bankName: string; bankAddress: string; status?: string;
  isExotic?: boolean; is_exotic?: boolean;
  currency?: { code: string; name: string; isExotic?: boolean } | null;
};
type Rate = { from: string; to: string; rate: string; change: string; isPos: boolean };
type RecentRecipient = RecentRecipientFromDB;

// Wallet cards: wide enough to almost reach the screen edge, but narrow
// enough that the next card still peeks in to signal there's more to
// scroll. 20px matches the existing horizontal scroll padding on each side.
const SCREEN_WIDTH = Dimensions.get("window").width;
const WALLET_CARD_WIDTH = SCREEN_WIDTH - 20 - 56;

// ─── Constants ───────────────────────────────────────────────
const HIDE_KEY = "hide_balance_preference";
const ACC_KEY  = "cached_accounts_v1";
const TOT_KEY  = "cached_total_balance_v1";
const EXOTIC   = ["NGN","GHS","RWF","UGX","TZS","ZMW","XOF","XAF"];
const DEBOUNCE = 3000;

const normCcy = (c: any) => String(c || "").toUpperCase().trim();
const toNum   = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v === "string") { const n = parseFloat(v.replace(/,/g, "")); return isFinite(n) ? n : null; }
  return null;
};
const norm     = (list: any[]): UserAccount[] =>
  Array.isArray(list) ? list.map(a => ({ ...a, currencyCode: normCcy(a?.currencyCode), balance: toNum(a?.balance) })) : [];
const fmt      = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const getInit  = (n: string) =>
  (n || "U").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");

// Mirrors TransactionsScreen.tsx's icon/title/amount logic so the Home
// screen's 5-item preview reads identically to the full list it links to.
function getTxIcon(tx: WalletTransaction): keyof typeof Ionicons.glyphMap {
  switch (tx.transactionType) {
    case "conversion": return "swap-horizontal";
    case "payout":
    case "transfer_out": return "arrow-up";
    case "deposit":
    case "transfer_in": return "arrow-down";
    case "fee": return "wallet";
    // Anything else (e.g. an Exxsend member-to-member transfer, whose
    // transactionType doesn't match any case above) still has a sign on
    // its amount — using that gives a meaningful arrow instead of a blank
    // dot that conveys nothing to the user.
    default: return tx.amount < 0 ? "arrow-up" : "arrow-down";
  }
}
function getTxTitle(tx: WalletTransaction): string {
  if (tx.counterpartyName) {
    return (tx.transactionType === "payout" || tx.transactionType === "transfer_out")
      ? `To ${tx.counterpartyName}` : `From ${tx.counterpartyName}`;
  }
  switch (tx.transactionType) {
    case "conversion": return `Convert ${tx.fromCurrency || tx.currency} → ${tx.toCurrency || ""}`;
    case "payout": return `Sent ${tx.currency}`;
    case "deposit": return `Received ${tx.currency}`;
    case "fee": return "Fee";
    default: return tx.description || tx.transactionType || "Transaction";
  }
}
function formatTxAmount(tx: WalletTransaction): string {
  const isOutgoing = tx.transactionType === "payout" || tx.transactionType === "transfer_out" || tx.amount < 0;
  const absAmount = Math.abs(tx.amount);
  const formatted = absAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${isOutgoing ? "-" : "+"}${formatted} ${tx.currency}`;
}
function formatTxDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function loadAccts(phone: string): Promise<UserAccount[]> {
  try { const r = await AsyncStorage.getItem(userScopedKey(ACC_KEY, phone)); if (r) { const p = JSON.parse(r); if (Array.isArray(p)) return norm(p); } } catch {} return [];
}
async function saveAccts(list: UserAccount[], phone: string) {
  try { await AsyncStorage.setItem(userScopedKey(ACC_KEY, phone), JSON.stringify(norm(list))); } catch {}
}
async function loadTotal(phone: string) {
  try { const r = await AsyncStorage.getItem(userScopedKey(TOT_KEY, phone)); if (r) { const p = JSON.parse(r); const t = toNum(p?.total); if (typeof t === "number") return { total: t, currency: String(p?.currency || ""), symbol: String(p?.symbol || "") }; } } catch {} return null;
}
async function saveTotal(total: number, currency: string, symbol: string, phone: string) {
  try { await AsyncStorage.setItem(userScopedKey(TOT_KEY, phone), JSON.stringify({ total, currency, symbol })); } catch {}
}

// ─── Small sub-components ────────────────────────────────────
function InitialsAvatar({ name, size = 38, photoUrl }: { name: string; size?: number; photoUrl?: string | null }) {
  const { colors } = useAppTheme();
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" }}>
      <AppText style={{ color: "#FFFFFF", fontWeight: "700", fontSize: size * 0.36 }}>{getInit(name)}</AppText>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", gap: SPACE.sm }}>
      <View style={{ width: 52, height: 52, borderRadius: RADIUS.full, backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center",  }}>
        <Ionicons name={icon as any} size={28} color={colors.gray} />
      </View>
      <AppText style={{ ...TYPE.micro, letterSpacing: 0, color: colors.text, textAlign: "center" }}>{label}</AppText>
    </Pressable>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = useStyles();
  const { unreadCount } = useNotificationContext();

  const [accounts,      setAccounts]      = useState<UserAccount[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [userName,      setUserName]      = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [email,         setEmail]         = useState("");
  const [totalBalance,  setTotalBalance]  = useState<number | null>(null);
  const [homeCcy,       setHomeCcy]       = useState("CAD");
  const [homeSym,       setHomeSym]       = useState("$");
  const [hideBalance,   setHideBalance]   = useState(false);
  const [rates,         setRates]         = useState<Rate[]>([]);
  const [ratesLoading,  setRatesLoading]  = useState(false);
  const [networkOk,     setNetworkOk]     = useState(true);
  const [userPhone,     setUserPhone]     = useState("");
  const [emailVerified, setEmailVerified] = useState(true);
  const [kycStatus,     setKycStatus]     = useState("");
  // Small "turn on biometric login" banner, shown above the balance hero
  // card once identity verification is approved — only relevant once the
  // device actually has biometric hardware enrolled, isn't already
  // enabled, and hasn't been dismissed before.
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [bioType, setBioType] = useState("Biometric");
  const [saving,        setSaving]        = useState(false);
  const [recipients,    setRecipients]    = useState<RecentRecipient[]>([]);
  const [sheetOpen,     setSheetOpen]     = useState(false);
  const [sheetLoading,  setSheetLoading]  = useState(false);
  const [walletsReady,  setWalletsReady]  = useState(false);
  // Admin-configured referral reward percentage, fetched live so the
  // dashboard banner can't drift out of sync with whatever ReferralScreen
  // shows (previously this banner had a hardcoded dollar figure that had
  // no relationship to the actual, configurable reward at all).
  const [referralPct,   setReferralPct]   = useState<number | null>(null);

  // Recent activity preview (5 most recent) shown under the wallet cards,
  // with a "View all" link to the full Transactions tab.
  const [recentTx,        setRecentTx]        = useState<WalletTransaction[]>([]);
  const [recentTxLoading, setRecentTxLoading] = useState(true);

  // Promotional banners carousel — fetched once we know the user's country
  // and verification status, since both are used to target which banners
  // they're eligible to see.
  const [promoBanners, setPromoBanners] = useState<PromotionalBanner[]>([]);

  // Fee-waiver program — free-transaction credits and progress toward
  // earning more. Read-only banner; the actual waiver application happens
  // server-side on send/transfer/conversion.
  const [feeWaivers, setFeeWaivers] = useState<FeeWaiversResponse | null>(null);

  const isFetching = useRef(false);
  const lastFetch  = useRef(0);
  const mounted    = useRef(true);
  const focusCount = useRef(0);
  const accsRef    = useRef<UserAccount[]>([]);
  const settledRef = useRef<(() => void) | null>(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { accsRef.current = accounts; }, [accounts]);

  const { hasPendingForCurrency, getOptimisticBalance, refresh: refreshSettlements } =
    usePendingSettlements(() => settledRef.current?.());

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => { if (mounted.current) setNetworkOk(!!s.isConnected); });
    return () => unsub();
  }, []);

  // Referral reward percentage for the banner below — fetched once, not
  // tied to pull-to-refresh, since an admin changing this is rare enough
  // not to need re-checking on every refresh.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        if (!token) return;
        const res = await getReferralConfig(token);
        if (mounted.current && res.success && res.percentage !== undefined) {
          setReferralPct(res.percentage);
        }
      } catch {}
    })();
  }, []);

  // Load cache once on mount
  useEffect(() => {
    (async () => {
      try {
        const [pref, phone] = await Promise.all([AsyncStorage.getItem(HIDE_KEY), AsyncStorage.getItem("user_phone")]);
        if (pref === "true" && mounted.current) setHideBalance(true);
        if (!phone) { if (mounted.current) setLoading(false); return; }
        if (mounted.current) setUserPhone(phone);
        const [ca, ct, su, sk, photo] = await Promise.all([loadAccts(phone), loadTotal(phone), AsyncStorage.getItem("user_info"), AsyncStorage.getItem("user_kyc_status"), AsyncStorage.getItem("user_profile_photo_url")]);
        if (!mounted.current) return;
        if (ca.length > 0) { setAccounts(ca); accsRef.current = ca; }
        if (ct) { setTotalBalance(ct.total); setHomeCcy(ct.currency || "CAD"); setHomeSym(ct.symbol || "$"); }
        if (su) { try { const u = JSON.parse(su); setUserName(String(u.firstName || u.first_name || "").trim()); setEmail(u.email || ""); } catch {} }
        if (sk) setKycStatus(sk);
        if (photo) setProfilePhotoUrl(photo);
      } catch {}
    })();
  }, []); // eslint-disable-line

  // Core fetch — stable, no state in deps
  const fetchData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetch.current < DEBOUNCE) return;
    if (isFetching.current) return;
    isFetching.current = true; lastFetch.current = now;
    try {
      const phone = (await AsyncStorage.getItem("user_phone")) || "";
      if (!phone || !mounted.current) { setLoading(false); setRefreshing(false); return; }

      getUserProfile(phone).then(res => {
        if (!mounted.current || !res?.success || !res.user) return;
        const { kycStatus: ks, firstName, first_name, email: em, homeCurrency: hc, homeCurrencySymbol: hs, countryCode: cc, profilePhotoUrl: photo } = res.user;
        if (ks) { setKycStatus(ks); AsyncStorage.setItem("user_kyc_status", ks); }
        const nm = String(firstName || first_name || "").trim(); if (nm) setUserName(nm);
        if (em) setEmail(em);
        if (hc) setHomeCcy(hc); if (hs || hc) setHomeSym(hs || hc || "$");
        if (photo) { setProfilePhotoUrl(photo); AsyncStorage.setItem("user_profile_photo_url", photo); }
        else { setProfilePhotoUrl(null); AsyncStorage.removeItem("user_profile_photo_url"); }
        // Country + verification status are both used to target which
        // promotional banners this user is eligible to see — fetched here
        // since this is the first point either becomes known this session.
        getActivePromotionalBanners({ country: cc || undefined, verified: ks === "verified" })
          .then(bannerRes => { if (mounted.current && bannerRes.success) setPromoBanners(bannerRes.banners); })
          .catch(() => {});
      }).catch(() => {});

      try {
        const res = await getUserAccounts(phone, true);
        if (!mounted.current) return;
        if (res?.success && Array.isArray(res.accounts) && res.accounts.length > 0) {
          let accts = norm(res.accounts);
          const exotics = accts.filter(a => EXOTIC.includes(normCcy(a.currencyCode)) || a.isExotic || a.is_exotic || a.currency?.isExotic);
          if (exotics.length > 0) {
            const results = await Promise.allSettled(exotics.map(a => getLocalBalance(phone, normCcy(a.currencyCode))));
            results.forEach((r, i) => { if (r.status === "fulfilled" && r.value?.success) { const b = toNum(r.value.balance); if (typeof b === "number") accts = accts.map(a => normCcy(a.currencyCode) === normCcy(exotics[i].currencyCode) ? { ...a, balance: b } : a); } });
          }
          if (mounted.current) { setAccounts(accts); accsRef.current = accts; setWalletsReady(true); accts.forEach(a => clearPendingForCurrency(a.currencyCode)); saveAccts(accts, phone); }
        }
      } catch {}

      try {
        const res = await getTotalBalance(phone);
        if (mounted.current && res?.success) { const t = toNum(res.totalBalance); if (typeof t === "number") { setTotalBalance(t); const c = res.homeCurrency || homeCcy, sx = res.homeCurrencySymbol || c || "$"; setHomeCcy(c); setHomeSym(sx); saveTotal(t, c, sx, phone); } }
      } catch {}

      try {
        const txRes = await getUserTransactions(phone, 1, 5);
        if (mounted.current && txRes.success) setRecentTx(txRes.transactions);
      } catch {} finally { if (mounted.current) setRecentTxLoading(false); }

      try {
        const waiverRes = await fetchMyFeeWaivers(phone);
        if (mounted.current) setFeeWaivers(waiverRes);
      } catch {}

      setRatesLoading(true);
      try {
        const ccys = [...new Set(accsRef.current.map(a => normCcy(a.currencyCode)).filter(Boolean))];
        const pairs: string[] = [];
        for (const f of ccys) for (const t of ccys) if (f !== t) pairs.push(`${f}_${t}`);
        if (pairs.length > 0) {
          const res = await getExchangeRates(pairs.join(","));
          if (mounted.current && res?.success && Array.isArray(res.rates)) {
            setRates(res.rates.map((r: any) => {
              const from = normCcy(r.fromCurrency || r.buy_currency), to = normCcy(r.toCurrency || r.sell_currency);
              const n = parseFloat(r.rate || r.core_rate || 0);
              if (!from || !to || !isFinite(n)) return null;
              const change = r.change || "+0.0%";
              return { from, to, rate: n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }), change, isPos: !String(change).startsWith("-") } as Rate;
            }).filter(Boolean) as Rate[]);
          }
        }
      } catch {} finally { if (mounted.current) setRatesLoading(false); }
    } catch {} finally { isFetching.current = false; if (mounted.current) { setLoading(false); setRefreshing(false); } }
  }, []); // eslint-disable-line

  useEffect(() => { settledRef.current = () => fetchData(true); }, [fetchData]);

  const loadRecipients = useCallback(async () => {
    const phone = userPhone || (await AsyncStorage.getItem("user_phone")) || "";
    if (!phone) { console.log("[HomeScreen] loadRecipients: no phone, skipping"); return; }
    try {
      const [backendRes, localList] = await Promise.all([
        getRecentRecipientsFromDB(phone, 6),
        getLocalRecentRecipients(phone),
      ]);
      if (!mounted.current) { console.log("[HomeScreen] loadRecipients: unmounted before resolving, dropping result"); return; }
      const backendList = backendRes.success ? backendRes.recipients : [];
      console.log(
        `[HomeScreen] loadRecipients: backend success=${backendRes.success} count=${backendList.length}` +
        `, local count=${localList.length}`
      );
      // Local entries take priority for the same recipient (matched by
      // account identity) since they're recorded the instant a transfer
      // actually succeeds — the freshest possible signal — rather than
      // waiting on whatever the backend's own computation/timing is.
      const merged = [...localList];
      for (const r of backendList) {
        const isDup = merged.some(
          (m) => m.accountNumber === r.accountNumber && m.bankCode === r.bankCode && m.destCurrency === r.destCurrency
        );
        if (!isDup) merged.push(r);
      }
      const sorted = merged.sort((a, b) => (b.lastSentAt || 0) - (a.lastSentAt || 0)).slice(0, 6);
      console.log(`[HomeScreen] loadRecipients: final merged count=${sorted.length}`, JSON.stringify(sorted.map(r => r.accountName)));
      setRecipients(sorted);
    } catch (e: any) {
      console.log("[HomeScreen] loadRecipients: threw, recipients NOT updated:", e?.message);
    }
  }, [userPhone]);

  // Lightweight — just enough to decide whether to show a "you have a
  // pending request" banner; the full list/actions live in
  // MoneyRequestsScreen.tsx.
  const loadPendingRequests = useCallback(async () => {
    const phone = userPhone || (await AsyncStorage.getItem("user_phone")) || "";
    if (!phone) return;
    try {
      const res = await getIncomingMoneyRequests(phone);
      if (!mounted.current) return;
      if (res.success) {
        setPendingRequestCount(res.requests.filter((r) => r.status === "pending").length);
      }
    } catch {}
  }, [userPhone]);

  // Re-checks whenever kycStatus changes (e.g. the moment verification
  // gets approved) — gated on "verified" specifically, hardware actually
  // being enrolled, not already enabled, and not previously dismissed.
  const checkBiometricPrompt = useCallback(async (status: string) => {
    if (status !== "verified") { setShowBiometricPrompt(false); return; }
    try {
      const [enabled, dismissed] = await Promise.all([
        AsyncStorage.getItem("biometric_enabled"),
        AsyncStorage.getItem("biometric_prompt_dismissed"),
      ]);
      if (enabled === "true" || dismissed === "true") { setShowBiometricPrompt(false); return; }

      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) { setShowBiometricPrompt(false); return; }

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBioType("Face ID");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBioType("Touch ID");
      } else {
        setBioType("Biometric");
      }
      setShowBiometricPrompt(true);
    } catch {
      setShowBiometricPrompt(false);
    }
  }, []);

  useEffect(() => { checkBiometricPrompt(kycStatus); }, [kycStatus, checkBiometricPrompt]);

  const handleBiometricPromptPress = useCallback(() => {
    router.push("/securityprivacy" as any);
  }, [router]);

  const handleBiometricPromptDismiss = useCallback(async () => {
    setShowBiometricPrompt(false);
    try { await AsyncStorage.setItem("biometric_prompt_dismissed", "true"); } catch {}
  }, []);

  useEffect(() => {
    fetchData(false); loadRecipients(); refreshSettlements(); loadPendingRequests();
    AsyncStorage.getItem("user_phone").then(p => { if (p) checkEmailVerified(p).then(r => { if (mounted.current) setEmailVerified(!!r?.emailVerified); }); });
  }, [fetchData, loadRecipients, refreshSettlements, loadPendingRequests]);

  useFocusEffect(useCallback(() => {
    focusCount.current += 1; if (focusCount.current <= 1) return;
    fetchData(true); loadRecipients(); refreshSettlements(); loadPendingRequests();
    // Re-check rather than relying solely on kycStatus changing — covers
    // returning from Settings right after toggling biometric on/off,
    // where kycStatus itself never changes but the prompt should
    // disappear immediately.
    checkBiometricPrompt(kycStatus);
  }, [fetchData, loadRecipients, refreshSettlements, checkBiometricPrompt, kycStatus, loadPendingRequests]));

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(true); loadRecipients(); refreshSettlements(); loadPendingRequests(); }, [fetchData, loadRecipients, refreshSettlements, loadPendingRequests]);
  const toggleHide = useCallback(() => { setHideBalance(p => { const n = !p; AsyncStorage.setItem(HIDE_KEY, String(n)).catch(() => {}); return n; }); }, []);

  useEffect(() => {
    if (!sheetOpen || !userPhone) return;
    setSheetLoading(true);
    getUserAccounts(userPhone, true).then(res => { if (res?.success && res.accounts && mounted.current) setAccounts(norm(res.accounts)); }).catch(() => {}).finally(() => { if (mounted.current) setSheetLoading(false); });
  }, [sheetOpen, userPhone]);

  const visibleRates = useMemo(() => {
    const ccys = new Set(accounts.map(a => normCcy(a.currencyCode)));
    return rates.filter(r => ccys.has(r.from) && ccys.has(r.to)).slice(0, 5);
  }, [rates, accounts]);

  const isKyc    = kycStatus === "verified";
  const showSkel = loading && accounts.length === 0;
  const blocked  = useCallback(() => Alert.alert("Verification Required", "Please complete identity verification to use this feature."), []);

  const handleVerifyEmail = useCallback(async () => {
    try { await sendEmailOtp(email); router.push(`/checkemail?email=${encodeURIComponent(email)}`); }
    catch { Alert.alert("Error", "Could not send verification email"); }
  }, [email, router]);

  const handleVerifyIdentity = useCallback(() => {
    router.push("/sumsub-verification" as any);
  }, [router]);

  const s = useMemo(() => StyleSheet.create({

  root: { flex: 1, backgroundColor: colors.bg },

  // Header — plain, generous, confident name treatment
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.lg, paddingBottom: SPACE.sm,
  },
  greetName: { ...TYPE.subtitle, color: colors.text },
  greetSub: { ...TYPE.caption, color: colors.muted, marginTop: 1 },
  bellBtn: {
    width: 42, height: 42, borderRadius: RADIUS.sm,
    backgroundColor: colors.card, justifyContent: "center", alignItems: "center",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  bellBadge: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: colors.red, borderRadius: 8, minWidth: 16, height: 16,
    paddingHorizontal: 3, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "#FFFFFF",
  },
  bellBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" as const },

  // Balance hero — gradient blue card, the one place this saturated a
  // background gets used. Every text/icon inside switches to white-family
  // since the gradient runs genuinely dark at the primaryDark end.
  balanceCard: {
    marginHorizontal: SCREEN_PADDING, marginTop: SPACE.lg,
    borderRadius: RADIUS.xl, padding: SPACE.xxl,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  balanceLabel: { ...TYPE.eyebrow, color: "#FFFFFF", opacity: 0.8 },
  balanceAmount: { ...TYPE.heroNumber, color: "#FFFFFF", marginTop: SPACE.sm },
  balanceActionsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.xxl },
  balanceActionIcon: {
    width: 50, height: 50, borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center",
  },
  balanceActionLabel: { ...TYPE.caption, color: "#FFFFFF", marginTop: SPACE.xs },
  requestBanner: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingVertical: SPACE.sm + 2, paddingHorizontal: SPACE.md, marginHorizontal: SCREEN_PADDING, marginTop: SPACE.md, gap: SPACE.sm },
  requestBannerIcon: { width: 28, height: 28, borderRadius: RADIUS.full, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  requestBannerText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: COLORS.primary },

  // Quick actions — a clean white card, blue icon tiles (navigation, not money)
  qaCard: {
    flexDirection: "row", justifyContent: "space-around",
    marginHorizontal: SCREEN_PADDING, marginTop: SPACE.lg,
    paddingVertical: SPACE.xl, paddingHorizontal: SPACE.sm,
    backgroundColor: "transparent", borderRadius: RADIUS.lg,
   
  },
  qaIcon: {
    width: 52, height: 52, borderRadius: RADIUS.full,
    backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center", borderColor: colors.primaryMid, borderWidth: 1,
  },
  qaLabel: { ...TYPE.micro, letterSpacing: 0, color: colors.text, marginTop: SPACE.xs, textAlign: "center" },

  // Network banner
  netBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACE.sm,
    marginHorizontal: SCREEN_PADDING, marginTop: SPACE.lg, padding: SPACE.md,
    backgroundColor: colors.accentLight, borderRadius: RADIUS.sm,
  },
  netText: { flex: 1, ...TYPE.caption, color: colors.accentDark },
  netRetry: { ...TYPE.caption, fontWeight: "700" as const, color: colors.primary },

  // Section headers
  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SCREEN_PADDING, marginTop: SPACE.xxxl, marginBottom: SPACE.md,
  },
  sectionTitle: { ...TYPE.title, fontSize: 18, color: colors.text },
  sectionLink: { ...TYPE.caption, fontWeight: "700" as const, color: colors.primary, fontSize: 16 },
  addPill: {
    flexDirection: "row", alignItems: "center", gap: SPACE.xs,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.full, backgroundColor: colors.primaryLight,
  },
  addPillText: { ...TYPE.caption, fontWeight: "700" as const, color: colors.primary },

  // Wallet cards — white, soft-shadowed, blue used only for the small decorative ring
  walletScroll: { paddingHorizontal: SCREEN_PADDING, gap: SPACE.md, paddingBottom: SPACE.xs },
  walletCard: {
    width: WALLET_CARD_WIDTH, borderRadius: RADIUS.lg, padding: SPACE.xl,
    backgroundColor: "transparent", overflow: "hidden",
    // Not the shared GLASS_BORDER here on purpose — that border color
    // (#EEF3FA) is actually lighter than the page background (#f9f9f9) and
    // only reads as a visible edge when there's a card fill behind it to
    // anchor it. With the fill gone, it needs a tone that's genuinely
    // darker than the page itself to stay visible as a line.
    borderWidth: 1,
    borderColor: "#e2e4e5ff",
  },
  walletCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.xl },
  walletFlagRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  walletIconBadge: { width: 35, height: 35, borderRadius: RADIUS.full, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  walletCcy: { ...TYPE.subtitle, color: colors.text },
  walletBalLabel: { ...TYPE.caption, color: colors.muted, marginBottom: SPACE.xs },
  walletBal: { fontSize: 28, fontWeight: "700" as const, color: colors.text, letterSpacing: -0.3 },
  walletSkelLine: { width: 110, height: 24, borderRadius: RADIUS.xs, backgroundColor: colors.borderLight },
  walletSkel: { width: WALLET_CARD_WIDTH, height: 138, borderRadius: RADIUS.lg, backgroundColor: colors.borderLight },
  walletAddCard: {
    width: WALLET_CARD_WIDTH, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
    justifyContent: "center", alignItems: "center", gap: SPACE.sm, minHeight: 138,
  },
  walletAddIcon: { width: 42, height: 42, borderRadius: RADIUS.sm, backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center" },
  walletAddText: { ...TYPE.caption, fontWeight: "700" as const, color: colors.primary },
  disabledBadge: { backgroundColor: colors.errorLight, borderRadius: RADIUS.xs - 2, paddingHorizontal: SPACE.sm - 1, paddingVertical: 2 },
  disabledBadgeText: { fontSize: 10, fontWeight: "700" as const, color: colors.red },

  // Quick send — circular blue avatars (identity, not money)
  recipientScroll: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.xs, gap: SPACE.lg },
  recipientItem: { alignItems: "center", gap: SPACE.xs, width: 60 },
  recipientAvatar: { width: 50, height: 50, borderRadius: RADIUS.full, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  recipientInitials: { fontSize: 16, fontWeight: "700" as const, color: "#FFFFFF" },
  recipientName: { ...TYPE.micro, letterSpacing: 0, color: colors.text, textAlign: "center" },
  recipientCcy: { fontSize: 10, color: colors.muted, fontWeight: "500" as const },

  // Live rates — white card, green/red only on the change tag
  ratesCard: { marginHorizontal: SCREEN_PADDING, backgroundColor: colors.card, borderRadius: RADIUS.md, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
  rateRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md + 1, gap: SPACE.md },
  rateFlagWrap: { flexDirection: "row", alignItems: "center", width: 42 },
  rateFlagOver: { marginLeft: -7, borderWidth: 1.5, borderColor: "#FFFFFF", borderRadius: RADIUS.full },
  ratePair: { ...TYPE.subtitle, fontSize: 14, color: colors.text },
  rateSubtext: { fontSize: 11, color: colors.muted, fontWeight: "500" as const, marginTop: 2 },
  rateTag: { paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, borderRadius: RADIUS.xs - 2 },
  rateTagText: { fontSize: 11, fontWeight: "700" as const },
  rateDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginLeft: SPACE.lg },

  txRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md + 1, gap: SPACE.md },
  txIconWrap: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  txTitle: { ...TYPE.subtitle, fontSize: 14, color: colors.text },
  txDate: { fontSize: 11, color: colors.muted, fontWeight: "500" as const, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "700" as const },

  // Recommendations — accent (orange) reserved for this one promotional context
  refBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: SCREEN_PADDING, marginTop: SPACE.xl,
    backgroundColor: colors.card, borderRadius: RADIUS.md, padding: SPACE.lg,
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  refBannerLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.md, flex: 1, marginRight: SPACE.sm },
  refBannerIcon: { width: 40, height: 40, borderRadius: RADIUS.sm, backgroundColor: colors.accentLight, justifyContent: "center", alignItems: "center" },
  refBannerTitle: { ...TYPE.subtitle, fontSize: 14, color: colors.text },
  refBannerSub: { ...TYPE.caption, color: colors.muted, marginTop: 2 },
  }), [colors]);

  // ─── RENDER ──────────────────────────────────────────────────

  // First-load bridge: shown only while there's truly nothing yet to
  // render (no accounts fetched, loading still in flight) — bridges the
  // gap between the tab bar mounting and Home's first real data arriving,
  // instead of a blank/mostly-empty screen. Uses the exact same condition
  // already driving the inline skeletons (showSkel), so this never
  // reappears on a normal refresh or subsequent app open with cached data.
  if (loading && accounts.length === 0) {
    return (
      <SafeAreaView style={[s.root, { alignItems: "center", justifyContent: "center" }]} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <AppText style={{ fontSize: 20, fontWeight: "700", color: colors.primary, marginBottom: 20 }}>ExxSend</AppText>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 12, backgroundColor: colors.bg }}
        style={{ backgroundColor: colors.bg }}
      >
        {/* ── Plain header: avatar, greeting, bell ── */}
        <View style={s.header}>
          <Pressable onPress={() => router.push("/profile")} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <InitialsAvatar name={userName} size={42} photoUrl={profilePhotoUrl} />
            <View>
              <AppText style={s.greetName}>Hi, {userName || "there"}</AppText>
              <AppText style={s.greetSub}>{homeCcy} Wallet</AppText>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push("/notification")} style={s.bellBtn}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {unreadCount > 0 && (
              <View style={s.bellBadge}>
                <AppText style={s.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</AppText>
              </View>
            )}
          </Pressable>
        </View>

        {showBiometricPrompt && (
          <BiometricPromptBanner
            bioType={bioType}
            onPress={handleBiometricPromptPress}
            onDismiss={handleBiometricPromptDismiss}
          />
        )}

        {/* ── Balance card ── */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.balanceCard}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={s.balanceLabel}>Total Balance</AppText>
            <Pressable onPress={toggleHide} hitSlop={8}>
              <Ionicons name={hideBalance ? "eye-off-outline" : "eye-outline"} size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          {showSkel ? (
            <View style={{ width: 160, height: 36, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 8 }} />
          ) : (
            <AppText style={s.balanceAmount}>
              {hideBalance ? "••••••" : `${homeSym}${fmt(totalBalance)}`}
            </AppText>
          )}

          <View style={s.balanceActionsRow}>
            <Pressable onPress={() => isKyc ? setSheetOpen(true) : blocked()} style={{ alignItems: "center", gap: 6 }}>
              <View style={s.balanceActionIcon}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </View>
              <AppText style={s.balanceActionLabel}>Add</AppText>
            </Pressable>
            <Pressable onPress={() => isKyc ? router.push("/sendmoney") : blocked()} style={{ alignItems: "center", gap: 6 }}>
              <View style={s.balanceActionIcon}>
                <Ionicons name="arrow-up-outline" size={20} color="#FFFFFF" />
              </View>
              <AppText style={s.balanceActionLabel}>Send</AppText>
            </Pressable>
            <Pressable onPress={() => isKyc ? router.push("/requestmoney" as any) : blocked()} style={{ alignItems: "center", gap: 6 }}>
              <View style={s.balanceActionIcon}>
                <Ionicons name="arrow-down-outline" size={20} color="#FFFFFF" />
              </View>
              <AppText style={s.balanceActionLabel}>Request</AppText>
            </Pressable>
            <Pressable onPress={() => router.push("/exchangerates")} style={{ alignItems: "center", gap: 6 }}>
              <View style={s.balanceActionIcon}>
                <Ionicons name="repeat-outline" size={20} color="#FFFFFF" />
              </View>
              <AppText style={s.balanceActionLabel}>Convert</AppText>
            </Pressable>
            <Pressable onPress={() => isKyc ? router.push("/recipients") : blocked()} style={{ alignItems: "center", gap: 6 }}>
              <View style={s.balanceActionIcon}>
                <Ionicons name="grid-outline" size={20} color="#FFFFFF" />
              </View>
              <AppText style={s.balanceActionLabel}>More</AppText>
            </Pressable>
          </View>
        </LinearGradient>

        {!!feeWaivers && (
          <View style={{ marginHorizontal: SCREEN_PADDING, marginTop: SPACE.md }}>
            <FeeWaiverBanner waivers={feeWaivers} />
          </View>
        )}

        {pendingRequestCount > 0 && (
          <Pressable onPress={() => router.push("/moneyrequests" as any)} style={s.requestBanner}>
            <View style={s.requestBannerIcon}>
              <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
            </View>
            <AppText style={s.requestBannerText}>
              You have {pendingRequestCount} pending money request{pendingRequestCount > 1 ? "s" : ""}
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </Pressable>
        )}

        {/* ── Recent recipients — now placed right after the balance hero
            card. Tapping one opens their activity/detail screen (with a
            "Send to this recipient" button there) rather than jumping
            straight into the send flow. ── */}
        {recipients.length > 0 && (
          <>
            <View style={[s.sectionRow, { marginTop: SPACE.lg }]}>
              <AppText style={s.sectionTitle}>Recent recipients</AppText>
              <Pressable onPress={() => router.push("/recipients")}>
                <AppText style={s.sectionLink}>See all</AppText>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recipientScroll}>
              {recipients.map((r, i) => (
                <Pressable
                  key={i}
                  onPress={() => { if (!isKyc) return blocked(); router.push({ pathname: "/recipientactivity" as any, params: { recipient: JSON.stringify(r) } } as any); }}
                  style={s.recipientItem}
                >
                  <RecipientAvatar
                    name={r.accountName}
                    currencyCode={r.destCurrency}
                    countryCode={(r as any).countryCode}
                    isExxsend={(r as any).payoutType === "exxsend" || r.bankCode === "EXXSEND"}
                    photoUrl={(r as any).avatarUrl}
                    size={50}
                  />
                  <AppText style={s.recipientName} numberOfLines={1}>{r.accountName.split(" ")[0]}</AppText>
                  <AppText style={s.recipientCcy}>{r.destCurrency}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

{/* ── My Wallets ── */}
        <View style={[s.sectionRow, {marginTop: 6}]}>
          <AppText style={[s.sectionTitle, {marginTop: -8}]}>My Wallets</AppText>
          <Pressable onPress={() => isKyc ? router.push("/addaccount") : blocked()} style={s.addPill}>
            <Ionicons name="add" size={30} color={colors.primary} />
            <AppText style={s.addPillText}>Add</AppText>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.walletScroll}>
          {showSkel ? (
            <>
              <View style={s.walletSkel} />
              <View style={s.walletSkel} />
            </>
          ) : (
            <>
              {accounts.map(a => {
                const disabled = String(a.status || "").toLowerCase() === "disabled";
                const hasPend  = hasPendingForCurrency(a.currencyCode) && !walletsReady;
                const dispBal  = hasPend ? (typeof a.balance === "number" ? getOptimisticBalance(a.balance, a.currencyCode) : null) : a.balance;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      if (disabled) { Alert.alert("Disabled", "This wallet is disabled."); return; }
                      if (!isKyc) { blocked(); return; }
                      router.push(`/wallet?accountData=${encodeURIComponent(JSON.stringify({ id: a.id, currencyCode: a.currencyCode, accountName: a.accountName, iban: a.iban, bicSwift: a.bicSwift, accountNumber: a.accountNumber, routingNumber: a.routingNumber, sortCode: a.sortCode, bankName: a.bankName, bankAddress: a.bankAddress, status: a.status, balance: a.balance, currencyName: a.currency?.name || a.currencyCode }))}`);
                    }}
                    style={[s.walletCard, disabled && { opacity: 0.55 }]}
                  >
                    {/* Subtle circle decoration */}
                    {/* <View style={s.walletCardDeco} /> */}

                    <View style={s.walletCardTop}>
                      <View style={s.walletFlagRow}>
                        <CountryFlag currencyCode={a.currencyCode} size="md" />
                        <AppText style={s.walletCcy}>{a.currencyCode}</AppText>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {disabled
                          ? <View style={s.disabledBadge}><AppText style={s.disabledBadgeText}>Disabled</AppText></View>
                          : hasPend && !walletsReady
                            ? <PendingBadge visible label="Settling" size="small" />
                            : null
                        }
                        <View style={s.walletIconBadge}>
                          <Ionicons name="wallet-outline" size={25} color={colors.primary} />
                        </View>
                      </View>
                    </View>

                    <AppText style={s.walletBalLabel}>Available</AppText>
                    {loading && !walletsReady
                      ? <View style={s.walletSkelLine} />
                      : <AppText style={s.walletBal} numberOfLines={1}>{hideBalance ? "•••••" : fmt(dispBal)}</AppText>
                    }
                  </Pressable>
                );
              })}

              {/* Add wallet tile */}
              <Pressable onPress={() => router.push("/addaccount")} style={s.walletAddCard}>
                <View style={s.walletAddIcon}>
                  <Ionicons name="add" size={22} color={colors.primary} />
                </View>
                <AppText style={s.walletAddText}>Add wallet</AppText>
              </Pressable>
            </>
          )}
        </ScrollView>

        {/* ── Promotional banners ── */}
        {promoBanners.length > 0 && (
          <View style={{ marginTop: SPACE.lg }}>
            <PromoBannerCarousel banners={promoBanners} />
          </View>
        )}

        {/* ── Recent activity ── */}
        <View style={s.sectionRow}>
          <AppText style={s.sectionTitle}>Recent activity</AppText>
          <Pressable onPress={() => router.push("/(tabs)/transactions" as any)}>
            <AppText style={s.sectionLink}>View all</AppText>
          </Pressable>
        </View>
        {recentTxLoading ? (
          <View style={s.ratesCard}>
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </View>
        ) : recentTx.length === 0 ? (
          <View style={s.ratesCard}>
            <View style={{ padding: 24, alignItems: "center" }}>
              <Ionicons name="receipt-outline" size={26} color={colors.muted} style={{ marginBottom: 8 }} />
              <AppText style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>No transactions yet</AppText>
            </View>
          </View>
        ) : (
          <View style={s.ratesCard}>
            {recentTx.map((tx, i) => (
              <View key={`${tx.reference}_${i}`}>
                <Pressable
                  style={s.txRow}
                  onPress={() => router.push({ pathname: "/transactiondetail/[reference]", params: { reference: encodeURIComponent(String(tx.reference)) } } as any)}
                >
                  <View style={s.txIconWrap}>
                    <Ionicons name={getTxIcon(tx)} size={16} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={s.txTitle} numberOfLines={1}>{getTxTitle(tx)}</AppText>
                    <AppText style={s.txDate}>{formatTxDate(tx.createdAt)}</AppText>
                  </View>
                  <AppText style={[s.txAmount, { color: (tx.transactionType === "payout" || tx.amount < 0) ? colors.red : colors.green }]}>
                    {formatTxAmount(tx)}
                  </AppText>
                </Pressable>
                {i < recentTx.length - 1 && <View style={s.rateDivider} />}
              </View>
            ))}
          </View>
        )}
        {/* ── Quick actions ── */}
        {/* <View style={s.qaCard}>
          <QuickAction icon="trending-up-outline"     label="Rates"     onPress={() => isKyc ? router.push("/exchangerates") : blocked()} />
          <QuickAction icon="bar-chart-outline"       label="Stock"     onPress={() => isKyc ? router.push("/investoverview" as any) : blocked()} />
          <QuickAction icon="arrow-down-outline"      label="Withdraw"  onPress={() => isKyc ? router.push("/withdraw")       : blocked()} />
          <QuickAction icon="people-outline"          label="Recipients"onPress={() => isKyc ? router.push("/recipients")     : blocked()} />
          <QuickAction icon="gift-outline"            label="Refer"     onPress={() => router.push("/referral")} />
        </View>
        <HomeQuickActionsCarousel /> */}


        {/* ── Network banner ── */}
        {!networkOk && (
          <View style={s.netBanner}>
            <Ionicons name="wifi-outline" size={14} color={colors.accentDark} />
            <AppText style={s.netText}>No internet — showing cached data</AppText>
            <Pressable onPress={() => fetchData(true)}>
              <AppText style={s.netRetry}>Retry</AppText>
            </Pressable>
          </View>
        )}

        {/* ── Verify banners ── */}
        {!emailVerified && <VerifyEmailCard email={email} onPress={handleVerifyEmail} />}
        {emailVerified && (kycStatus === "pending" || kycStatus === "retry" || kycStatus === "unverified") && <VerifyIdentityCardScreen userPhone={userPhone} onPress={handleVerifyIdentity} />}

        

        {/* ── Recommendations ── */}
        <View style={[s.sectionRow, {marginTop: 15}]}>
          <AppText style={s.sectionTitle}>Recommendations</AppText>
        </View>
        <Pressable onPress={() => router.push("/referral")} style={s.refBanner}>
          <View style={s.refBannerLeft}>
            <View style={s.refBannerIcon}>
              <Ionicons name="gift-outline" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.refBannerTitle} numberOfLines={1}>Earn Rewards by Referring Friends!</AppText>
              <AppText style={s.refBannerSub} numberOfLines={2}>
                {referralPct !== null
                  ? `Invite your friends and earn ${referralPct}% on their first transfer`
                  : "Invite your friends and earn a cash bonus when they sign up"}
              </AppText>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>

        {/* ── Live Rates ── */}
        {(visibleRates.length > 0 || ratesLoading) && (
          <>
            <View style={s.sectionRow}>
              <AppText style={s.sectionTitle}>Live Rates</AppText>
              <Pressable onPress={() => router.push("/exchangerates")}>
                <AppText style={s.sectionLink}>See all</AppText>
              </Pressable>
            </View>
            <View style={s.ratesCard}>
              {ratesLoading && visibleRates.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                visibleRates.map((r, i) => (
                  <View key={`${r.from}_${r.to}`}>
                    <Pressable onPress={() => router.push("/exchangerates")} style={s.rateRow}>
                      <View style={s.rateFlagWrap}>
                        <CountryFlag currencyCode={r.from} size="md" />
                        <View style={s.rateFlagOver}>
                          <CountryFlag currencyCode={r.to} size="md" />
                        </View>
                      </View>
                      <View style={{ flex: 1, marginLeft: 40 }}>
                        <AppText style={s.ratePair}>{r.from} / {r.to}</AppText>
                        <AppText style={s.rateSubtext}>1 {r.from} = {r.rate} {r.to}</AppText>
                      </View>
                      <View style={[s.rateTag, { backgroundColor: r.isPos ? colors.greenSoft : colors.errorLight }]}>
                        <AppText style={[s.rateTagText, { color: r.isPos ? colors.green : colors.red }]}>{r.change}</AppText>
                      </View>
                    </Pressable>
                    {i < visibleRates.length - 1 && <View style={s.rateDivider} />}
                  </View>
                ))
              )}
            </View>
          </>
        )}

      </ScrollView>

      {/* ── Add Money Sheet ── */}
      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Add money to wallet">
        {sheetLoading ? (
          <View style={{ padding: 30, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          accounts.map(a => (
            <Pressable key={a.id} style={styles.sheetRow}
              onPress={() => {
                setSheetOpen(false);
                const ccy = (a.currencyCode || "").toUpperCase();
                const isCAD = ccy === "CAD";
                const dest = isCAD
                  ? `/addmoneymethods?currencyCode=${ccy}&accountId=${a.id}`
                  : `/add-money/local?currency=${ccy}`;
                router.push(dest as any);
              }}>
              <View style={styles.sheetRowLeft}>
                <CountryFlag currencyCode={a.currencyCode} size="md" />
                <View style={{ marginLeft: 12 }}>
                  <AppText style={styles.sheetRowTitle}>{a.currencyCode} Wallet</AppText>
                  <AppText style={styles.sheetRowSub}>{a.accountName}</AppText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
