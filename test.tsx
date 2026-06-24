/**
 * HomeScreen.tsx
 * - Refreshes like “reloaded” whenever user comes back (back button) using useFocusEffect
 * - Uses USER-SCOPED cache to prevent flicker-to-zero
 * - If balances cannot be fetched due to slow/no network (and no usable cache), redirects to /networkerrorstate
 * - NO LinearGradient (plain fintech cards)
 */

import {
  checkEmailVerified,
  createPlaidIdvSession,
  getExchangeRates,
  getHistoricalRates,
  getPublicCurrencies,
  getTotalBalance,
  getUserAccounts,
  getUserProfile,
  sendEmailOtp,
} from "@/api/config";
import { getRecentRecipientsFromDB, RecentRecipientFromDB } from "@/api/sync";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, Stop, LinearGradient as SvgGradient } from "react-native-svg";
import { getLocalBalance } from "../../../api/flutterwave";
import CountryFlag from "../../../components/CountryFlag";
import { PendingBadge } from "../../../components/PendingBadge";
import VerifyEmailCard from "../../../components/src/screens/VerifyEmailCardScreen";
import { usePendingSettlements } from "../../../hooks/usePendingSettlements";
import { COLORS } from "../../../theme/colors";
import { styles } from "../../../theme/styles";
import { userScopedKey } from "../../../utils/cacheKeys";
import BottomSheet from "./../../BottomSheet";
import OutlineButton from "./../../OutlineButton";
import PrimaryButton from "./../../PrimaryButton";
import ScreenShell from "./../../ScreenShell";
import VerifyIdentityCardScreen from "./VerifyIdentityCardScreen";

/** ---------------- Types ---------------- **/
type Country = {
  code: string;
  name: string;
  flag?: string;
  dialCode?: string;
  symbol?: string;
  currencyCode?: string;
  currencyEnabled?: boolean;
};

type UserAccount = {
  id: string;
  currencyCode: string;
  accountName: string;
  balance?: number | null;
  iban?: string;
  bicSwift?: string;
  status?: string;
  isExotic?: boolean;
  is_exotic?: boolean;
  currency?: {
    code: string;
    name: string;
    countryName?: string;
    flag?: string;
    symbol?: string;
    isExotic?: boolean;
    is_exotic?: boolean;
  } | null;
};

type DisplayRate = {
  from: string;
  to: string;
  fromFlag: string;
  toFlag: string;
  rate: string;
  change: string;
  numericRate: number;
};

type HistoricalPoint = { date: string; timestamp: number; rate: number };
type RangeKey = "1D" | "5D" | "1M" | "1Y" | "5Y" | "MAX";

// RecentRecipient type now comes from API
type RecentRecipient = RecentRecipientFromDB;

/** ---------------- Constants ---------------- **/
const HIDE_BALANCE_KEY = "hide_balance_preference";
const CACHED_ACCOUNTS_KEY_BASE = "cached_accounts_v1";
const CACHED_TOTAL_BALANCE_KEY_BASE = "cached_total_balance_v1";
const KNOWN_EXOTIC_CURRENCIES = ["NGN", "GHS", "RWF", "UGX", "TZS", "ZMW", "XOF", "XAF"];

/** ---------------- Helpers ---------------- **/
function normalizeCurrency(code: any) {
  return String(code || "").toUpperCase().trim();
}
function isValidNumber(n: any) {
  return typeof n === "number" && Number.isFinite(n);
}
function getInitials(name: string) {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** ---------- Cache helpers (USER-SCOPED) ---------- **/
async function loadCachedAccounts(phone: string): Promise<UserAccount[]> {
  try {
    if (!phone) return [];
    const raw = await AsyncStorage.getItem(userScopedKey(CACHED_ACCOUNTS_KEY_BASE, phone));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}
async function saveCachedAccounts(accounts: UserAccount[], phone: string): Promise<void> {
  try {
    if (!phone) return;
    await AsyncStorage.setItem(userScopedKey(CACHED_ACCOUNTS_KEY_BASE, phone), JSON.stringify(accounts || []));
  } catch {}
}
async function loadCachedTotalBalance(
  phone: string
): Promise<{ total: number; currency: string; symbol: string } | null> {
  try {
    if (!phone) return null;
    const raw = await AsyncStorage.getItem(userScopedKey(CACHED_TOTAL_BALANCE_KEY_BASE, phone));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.total === "number") return parsed;
    }
  } catch {}
  return null;
}
async function saveCachedTotalBalance(total: number, currency: string, symbol: string, phone: string): Promise<void> {
  try {
    if (!phone) return;
    await AsyncStorage.setItem(
      userScopedKey(CACHED_TOTAL_BALANCE_KEY_BASE, phone),
      JSON.stringify({ total, currency, symbol })
    );
  } catch {}
}

/** ---------- Skeleton Components ---------- */
function SkeletonPulse({ style }: { style?: any }) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return <Animated.View style={[{ backgroundColor: "#E5E7EB", borderRadius: 8 }, style, { opacity }]} />;
}

function TotalBalanceSkeleton() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <SkeletonPulse style={{ width: 140, height: 20 }} />
    </View>
  );
}

function AccountCardSkeleton() {
  return (
    <View
      style={{
        width: 210,
        height: 140,
        borderRadius: 16,
        backgroundColor: "#E5E7EB",
        marginRight: 12,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <SkeletonPulse style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#D1D5DB" }} />
        <SkeletonPulse style={{ width: 44, height: 14, marginLeft: 8, backgroundColor: "#D1D5DB" }} />
      </View>
      <SkeletonPulse style={{ width: 120, height: 26, backgroundColor: "#D1D5DB" }} />
      <SkeletonPulse style={{ width: 90, height: 12, backgroundColor: "#D1D5DB", marginTop: 10 }} />
    </View>
  );
}

function AccountsListSkeleton() {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8 }}>
      <AccountCardSkeleton />
      <AccountCardSkeleton />
      <AccountCardSkeleton />
    </View>
  );
}

function ExchangeRateRowSkeleton() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", marginRight: 12 }}>
        <SkeletonPulse style={{ width: 28, height: 28, borderRadius: 14 }} />
        <SkeletonPulse style={{ width: 28, height: 28, borderRadius: 14, marginLeft: -8 }} />
      </View>
      <View style={{ flex: 1 }}>
        <SkeletonPulse style={{ width: 110, height: 16, marginBottom: 6 }} />
        <SkeletonPulse style={{ width: 160, height: 12 }} />
      </View>
      <SkeletonPulse style={{ width: 62, height: 24, borderRadius: 12 }} />
    </View>
  );
}

function ExchangeRatesSkeleton() {
  return (
    <View>
      <ExchangeRateRowSkeleton />
      <View style={{ height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 16 }} />
      <ExchangeRateRowSkeleton />
      <View style={{ height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 16 }} />
      <ExchangeRateRowSkeleton />
      <View style={{ height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 16 }} />
      <ExchangeRateRowSkeleton />
    </View>
  );
}

/** --- Fintech network banner --- **/
function NetworkBanner({
  visible,
  onRetry,
  text,
}: {
  visible: boolean;
  onRetry: () => void;
  text: string;
}) {
  if (!visible) return null;
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 10,
        padding: 12,
        borderRadius: 14,
        backgroundColor: "#FFF7ED",
        borderWidth: 1,
        borderColor: "#FED7AA",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: "rgba(234,88,12,0.12)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        <Ionicons name="wifi-outline" size={18} color="#EA580C" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", color: "#9A3412", fontSize: 13 }}>Connection issue</Text>
        <Text style={{ color: "#9A3412", fontSize: 12, marginTop: 2 }}>{text}</Text>
      </View>

      <Pressable
        onPress={onRetry}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: "rgba(234,88,12,0.12)",
          borderWidth: 1,
          borderColor: "rgba(234,88,12,0.25)",
        }}
      >
        <Text style={{ fontWeight: "700", color: "#EA580C", fontSize: 12 }}>Retry</Text>
      </Pressable>
    </View>
  );
}

/** --- Chart helpers --- **/
function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const mid = (a: number, b: number) => (a + b) / 2;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const mx = mid(p0.x, p1.x);
    const my = mid(p0.y, p1.y);
    d += ` Q ${p0.x} ${p0.y} ${mx} ${my}`;
    if (i === points.length - 1) d += ` T ${p1.x} ${p1.y}`;
  }
  return d;
}

function generateMockHistory(baseRate: number, range: RangeKey): HistoricalPoint[] {
  const now = Date.now();
  const cfg: Record<RangeKey, { points: number; stepMs: number; volatility: number }> = {
    "1D": { points: 24, stepMs: 60 * 60 * 1000, volatility: 0.0025 },
    "5D": { points: 30, stepMs: 4 * 60 * 60 * 1000, volatility: 0.003 },
    "1M": { points: 35, stepMs: 24 * 60 * 60 * 1000, volatility: 0.004 },
    "1Y": { points: 40, stepMs: 9 * 24 * 60 * 60 * 1000, volatility: 0.006 },
    "5Y": { points: 45, stepMs: 45 * 24 * 60 * 60 * 1000, volatility: 0.008 },
    MAX: { points: 50, stepMs: 75 * 24 * 60 * 60 * 1000, volatility: 0.01 },
  };

  const { points, stepMs, volatility } = cfg[range];
  let value = Math.max(0.000001, baseRate);
  const out: HistoricalPoint[] = [];

  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * stepMs;
    const wave = Math.sin((points - i) / 6) * volatility * value;
    const noise = (Math.random() - 0.5) * 2 * volatility * value;
    value = Math.max(0.000001, value + wave + noise);
    out.push({ date: new Date(t).toISOString(), timestamp: t, rate: value });
  }
  return out;
}

function LiveRateMiniChart({
  pairLabel,
  baseRate,
  changePercent,
  range,
  onRangeChange,
  containerWidth,
  historicalPoints,
  isLoading,
}: {
  pairLabel: string;
  baseRate: number;
  changePercent: number;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  containerWidth: number;
  historicalPoints: HistoricalPoint[];
  isLoading: boolean;
}) {
  const chartH = 170;
  const chartW = Math.max(0, Math.floor(containerWidth || 0));
  const ranges: RangeKey[] = ["1D", "5D", "1M", "1Y", "5Y", "MAX"];
  const isPositive = changePercent >= 0;

  const { linePath, fillPath, lastPoint } = useMemo(() => {
    if (chartW <= 0 || historicalPoints.length < 2) return { linePath: "", fillPath: "", lastPoint: { x: 0, y: 0 } };

    const padX = 14;
    const padTop = 14;
    const padBottom = 26;

    const rates = historicalPoints.map((p) => p.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const span = Math.max(1e-9, max - min);

    const usableW = Math.max(1, chartW - padX * 2);
    const usableH = Math.max(1, chartH - padTop - padBottom);

    const pts = historicalPoints.map((p, i) => ({
      x: padX + (i / (historicalPoints.length - 1)) * usableW,
      y: padTop + (1 - (p.rate - min) / span) * usableH,
    }));

    const dLine = buildSmoothPath(pts);
    const last = pts[pts.length - 1];
    const first = pts[0];
    const baselineY = padTop + usableH;
    const dFill = `${dLine} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
    return { linePath: dLine, fillPath: dFill, lastPoint: last };
  }, [chartW, historicalPoints]);

  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 }}>
        {ranges.map((r) => (
          <Pressable
            key={r}
            onPress={() => onRangeChange(r)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: r === range ? "rgba(25,149,95,0.10)" : "transparent",
            }}
          >
            <Text style={{ fontWeight: "700", color: r === range ? "#19955f" : "#6b7280", fontSize: 12 }}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <View>
          <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "700" }}>{pairLabel}</Text>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "700", marginTop: 2 }}>
            {Number(baseRate || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: isPositive ? "rgba(25,149,95,0.12)" : "rgba(239,68,68,0.12)",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: isPositive ? "#19955f" : "#ef4444" }}>
            {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", width: "100%", backgroundColor: "#F9FAFB" }}>
        {isLoading ? (
          <View style={{ height: chartH, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : chartW <= 0 || historicalPoints.length < 2 || !linePath ? (
          <View style={{ height: chartH, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }}>
            <Text style={{ color: "#9ca3af", fontSize: 12, textAlign: "center" }}>Not enough data to plot chart</Text>
          </View>
        ) : (
          <Svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%" }}>
            <Defs>
              <SvgGradient id="fxFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#19955f" stopOpacity="0.24" />
                <Stop offset="100%" stopColor="#19955f" stopOpacity="0" />
              </SvgGradient>
            </Defs>
            <Path d={fillPath} fill="url(#fxFill)" />
            <Path d={linePath} stroke="#111827" strokeWidth={3} fill="none" />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill="#111827" />
          </Svg>
        )}
      </View>
    </View>
  );
}

/** ---------------- HomeScreen ---------------- **/
export default function HomeScreen() {
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetRefreshing, setSheetRefreshing] = useState(false);

  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);
  const hasCacheLoadedRef = useRef(false);
  const lastFetchAtRef = useRef<number>(0);

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const accountsRef = useRef<UserAccount[]>([]);
  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  const [flagsByCurrency, setFlagsByCurrency] = useState<Record<string, string>>({});
  const [disabledCurrencies, setDisabledCurrencies] = useState<Record<string, true>>({});
  const [displayRates, setDisplayRates] = useState<DisplayRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);

  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [homeCurrency, setHomeCurrency] = useState<string>("");
  const [homeCurrencySymbol, setHomeCurrencySymbol] = useState<string>("");

  const [hideBalance, setHideBalance] = useState(false);
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [selectedRange, setSelectedRange] = useState<RangeKey>("1M");
  const [fxChartWidth, setFxChartWidth] = useState(0);
  const [historicalPoints, setHistoricalPoints] = useState<HistoricalPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartChangePercent, setChartChangePercent] = useState(0);

  const [emailVerified, setEmailVerified] = useState(false);
  const [userPhone, setUserPhone] = useState("");

  // network + wallet confirmation
  const [networkOk, setNetworkOk] = useState<boolean>(true);
  const [walletsConfirmed, setWalletsConfirmed] = useState<boolean>(false);

  // Keep amount skeleton visible until we confirm a fresh API balance.
  const [balanceLoadingByCurrency, setBalanceLoadingByCurrency] = useState<Record<string, boolean>>({});

  const onSettlementConfirmedRef = useRef<() => void>(() => {});
  const { refresh: refreshPendingSettlements, getOptimisticBalance, hasPendingForCurrency } = usePendingSettlements(
    useCallback(() => {
      onSettlementConfirmedRef.current();
    }, []),
    true
  );

  /** Watch network continuously */
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const ok = Boolean(state.isConnected && state.isInternetReachable !== false);
      setNetworkOk(ok);
      if (!ok) setWalletsConfirmed(false);
    });
    return () => unsub();
  }, []);

  /** Redirect to network error screen when network is bad (avoid doing this inside render/memo) */
  useEffect(() => {
    if (!networkOk) {
      router.replace("/networkerrorstate");
    }
  }, [networkOk, router]);

  /** Load phone + email verified once */
  useEffect(() => {
    (async () => {
      try {
        const phone = (await AsyncStorage.getItem("user_phone")) || "";
        if (phone) {
          setUserPhone(phone);
          const emailCheck = await checkEmailVerified(phone);
          setEmailVerified(!!emailCheck?.emailVerified);
        }
      } catch {}
    })();
  }, []);

  /** Load cached wallets ONLY after phone is known */
  useEffect(() => {
    if (!userPhone) return;

    const loadCachedData = async () => {
      if (hasCacheLoadedRef.current) return;
      hasCacheLoadedRef.current = true;

      const cachedAccounts = await loadCachedAccounts(userPhone);
      if (cachedAccounts.length > 0) {
        setAccounts(cachedAccounts);

        // keep skeleton until API confirms
        setWalletsConfirmed(false);

        setBalanceLoadingByCurrency(() => {
          const next: Record<string, boolean> = {};
          for (const a of cachedAccounts) {
            const ccy = normalizeCurrency(a.currencyCode);
            if (ccy) next[ccy] = true;
          }
          return next;
        });
      }

      const cachedTotal = await loadCachedTotalBalance(userPhone);
      if (cachedTotal) {
        setTotalBalance(cachedTotal.total);
        setHomeCurrency(cachedTotal.currency);
        setHomeCurrencySymbol(cachedTotal.symbol);
      }
    };

    loadCachedData();
  }, [userPhone]);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(HIDE_BALANCE_KEY);
      if (stored !== null) setHideBalance(stored === "true");
    })();
  }, []);

  const toggleHideBalance = useCallback(async () => {
    const newValue = !hideBalance;
    setHideBalance(newValue);
    try {
      await AsyncStorage.setItem(HIDE_BALANCE_KEY, String(newValue));
    } catch {}
  }, [hideBalance]);

  const formatBalance = useCallback(
    (balance?: number | null) => {
      if (hideBalance) return "••••••";
      if (!isValidNumber(balance)) return "—";
      const val = balance as number;
      return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    [hideBalance]
  );

  /** Mark list wallets loading (use ref so navigation won’t pass empty list) */
  const markAllWalletsLoading = useCallback((list: UserAccount[]) => {
    const base = Array.isArray(list) && list.length > 0 ? list : accountsRef.current;
    setBalanceLoadingByCurrency((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const a of base) {
        const ccy = normalizeCurrency(a?.currencyCode);
        if (ccy) next[ccy] = true;
      }
      return next;
    });
  }, []);

  /** After API confirmed, stop skeleton only for currencies with valid balances */
  const confirmWalletsFromApi = useCallback((list: UserAccount[]) => {
    setBalanceLoadingByCurrency((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const a of list) {
        const ccy = normalizeCurrency(a?.currencyCode);
        if (!ccy) continue;
        next[ccy] = !isValidNumber((a as any).balance);
      }
      return next;
    });
    setWalletsConfirmed(true);
  }, []);

  const isWalletDisabled = (a?: Pick<UserAccount, "status" | "currencyCode"> | null) => {
    const status = String(a?.status || "").toLowerCase();
    if (status === "disabled" || status === "inactive" || status === "in-active") return true;
    const code = normalizeCurrency(a?.currencyCode);
    return !!(code && disabledCurrencies[code]);
  };

  const getFlagForCurrency = (currencyCode?: string) => {
    const key = normalizeCurrency(currencyCode);
    const fallbackEmoji: Record<string, string> = {
      USD: "🇺🇸",
      CAD: "🇨🇦",
      GBP: "🇬🇧",
      EUR: "🇪🇺",
      NGN: "🇳🇬",
      GHS: "🇬🇭",
      KES: "🇰🇪",
      RWF: "🇷🇼",
      UGX: "🇺🇬",
      TZS: "🇹🇿",
      ZMW: "🇿🇲",
      XOF: "🇸🇳",
      XAF: "🇨🇲",
    };
    return flagsByCurrency[key] || fallbackEmoji[key] || "";
  };

  /** -------- Main fetch ---------- */
  const fetchUserData = useCallback(
    async (force: boolean = false) => {
      const now = Date.now();

      if (!force && lastFetchAtRef.current && now - lastFetchAtRef.current < 6000) return;
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;
      lastFetchAtRef.current = now;

      try {
        const phone = (await AsyncStorage.getItem("user_phone")) || "";
        if (!phone) {
          setLoading(false);
          setRefreshing(false);
          return;
        }
        setUserPhone(phone);

        // If network is not OK -> go to error screen
        if (!networkOk) {
          setLoading(false);
          setRefreshing(false);
          setRatesLoading(false);
          setWalletsConfirmed(false);
          router.replace("/networkerrorstate");
          return;
        }

        // keep wallet amount skeleton while refreshing
        markAllWalletsLoading(accountsRef.current);

        // user info from local storage
        const storedUser = await AsyncStorage.getItem("user_info");
        if (storedUser) {
          try {
            const userInfo = JSON.parse(storedUser);
            setEmail(userInfo.email || "");
            setUserName(String(userInfo.firstName || userInfo.first_name || "").trim());
          } catch {}
        }

        // flags + disabled currencies
        let flagsMap: Record<string, string> = {};
        let disabledMap: Record<string, true> = {};
        try {
          const countriesData: Country[] = await getPublicCurrencies();
          for (const c of countriesData || []) {
            const flag = (c.flag || "").trim();
            const currencyKey = normalizeCurrency(c.currencyCode);
            if (currencyKey && flag && !flagsMap[currencyKey]) flagsMap[currencyKey] = flag;
            if (currencyKey && c.currencyEnabled === false) disabledMap[currencyKey] = true;

            const codeKey = normalizeCurrency(c.code);
            if (codeKey && flag && !flagsMap[codeKey]) flagsMap[codeKey] = flag;
            if (codeKey && c.currencyEnabled === false) disabledMap[codeKey] = true;
          }
          setFlagsByCurrency(flagsMap);
          setDisabledCurrencies(disabledMap);
        } catch {}

        // profile
        let userHomeCurrency = "";
        try {
          const res = await getUserProfile(phone);
          if (res?.success && res.user) {
            setKycStatus(res.user.kycStatus);
            const firstName = res.user.firstName || res.user.first_name || "";
            if (firstName) setUserName(String(firstName).trim());

            if (res.user.homeCurrency) {
              userHomeCurrency = res.user.homeCurrency;
              setHomeCurrency(res.user.homeCurrency);
              setHomeCurrencySymbol(res.user.homeCurrencySymbol || res.user.homeCurrency);
            }
          }
        } catch {}

        // accounts (wallets) — if we can't fetch balances and no cache, redirect
        let userAccounts: UserAccount[] = [];
        let accountsRes: any = null;

        try {
          accountsRes = await getUserAccounts(phone, true);
        } catch {
          accountsRes = null;
        }

        if (!accountsRes?.success) {
          const cached = await loadCachedAccounts(phone);
          if (!cached || cached.length === 0) {
            setWalletsConfirmed(false);
            router.replace("/networkerrorstate");
            return;
          }
          // fall back to cache
          userAccounts = cached;
          setAccounts(cached);
          setWalletsConfirmed(false);
          markAllWalletsLoading(cached);
        } else if (Array.isArray(accountsRes.accounts) && accountsRes.accounts.length > 0) {
          userAccounts = accountsRes.accounts;

          // local ledger for exotic balances
          const localLedgerAccounts = userAccounts.filter((a: any) => {
            const code = normalizeCurrency(a.currencyCode);
            return (
              Boolean(a.isExotic || a.is_exotic || a.currency?.isExotic || a.currency?.is_exotic) ||
              KNOWN_EXOTIC_CURRENCIES.includes(code)
            );
          });

          if (localLedgerAccounts.length > 0) {
            try {
              const results = await Promise.all(
                localLedgerAccounts.map(async (a) => {
                  const ccy = normalizeCurrency(a.currencyCode);
                  const res = await getLocalBalance(phone, ccy);
                  return { ccy, res };
                })
              );
              const balanceByCurrency = new Map<string, number>();
              for (const { ccy, res } of results) {
                if (res?.success) balanceByCurrency.set(ccy, Number(res.balance || 0));
              }
              userAccounts = userAccounts.map((a) => {
                const ccy = normalizeCurrency(a.currencyCode);
                if (balanceByCurrency.has(ccy)) return { ...a, balance: balanceByCurrency.get(ccy)!, isExotic: true };
                return a;
              });
            } catch {}
          }

          setAccounts(userAccounts);
          await saveCachedAccounts(userAccounts, phone);

          // confirm only if API snapshot
          if (accountsRes.source === "api") {
            confirmWalletsFromApi(userAccounts);
          } else {
            setWalletsConfirmed(false);
            markAllWalletsLoading(userAccounts);
          }
        } else {
          // no wallets returned -> keep whatever cache we have, but don’t mark confirmed
          setWalletsConfirmed(false);
        }

        // total balance — if cannot fetch AND no cached total, redirect
        try {
          const totalRes = await getTotalBalance(phone);
          if (totalRes?.success) {
            const newTotal = isValidNumber(totalRes.totalBalance) ? Number(totalRes.totalBalance) : null;

            const newCurrency = totalRes.homeCurrency || homeCurrency || userHomeCurrency;
            const newSymbol = totalRes.homeCurrencySymbol || totalRes.homeCurrency || homeCurrencySymbol;

            if (newTotal !== null) {
              setTotalBalance(newTotal);
              await saveCachedTotalBalance(newTotal, newCurrency || "", newSymbol || "", phone);
            }

            if (newCurrency) setHomeCurrency(newCurrency);
            if (newSymbol) setHomeCurrencySymbol(newSymbol);
          } else {
            const cachedTotal = await loadCachedTotalBalance(phone);
            if (!cachedTotal) {
              router.replace("/networkerrorstate");
              return;
            }
          }
        } catch {
          const cachedTotal = await loadCachedTotalBalance(phone);
          if (!cachedTotal) {
            router.replace("/networkerrorstate");
            return;
          }
        }

        // exchange rates
        setRatesLoading(true);
        try {
          const currencyCodes = userAccounts.map((a) => normalizeCurrency(a.currencyCode)).filter(Boolean);
          if (userHomeCurrency && !currencyCodes.includes(userHomeCurrency)) currencyCodes.push(userHomeCurrency);

          const pairs: string[] = [];
          for (const from of currencyCodes) for (const to of currencyCodes) if (from !== to) pairs.push(`${from}_${to}`);

          if (pairs.length > 0) {
            const ratesRes = await getExchangeRates(pairs.join(","));
            if (ratesRes?.success && Array.isArray(ratesRes.rates)) {
              const ratesList: DisplayRate[] = ratesRes.rates
                .map((r: any) => {
                  const from = normalizeCurrency(r.fromCurrency || r.buy_currency);
                  const to = normalizeCurrency(r.toCurrency || r.sell_currency);
                  const numericRate = parseFloat(r.rate || r.core_rate || 0);
                  if (!from || !to || !Number.isFinite(numericRate)) return null;

                  return {
                    from,
                    to,
                    fromFlag: flagsMap[from] || "",
                    toFlag: flagsMap[to] || "",
                    rate: numericRate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
                    change: r.change || "+0.0%",
                    numericRate,
                  } as DisplayRate;
                })
                .filter(Boolean) as DisplayRate[];
              setDisplayRates(ratesList);
            } else {
              setDisplayRates([]);
            }
          } else {
            setDisplayRates([]);
          }
        } finally {
          setRatesLoading(false);
        }
      } catch {
        setWalletsConfirmed(false);
      } finally {
        isFetchingRef.current = false;
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      networkOk,
      homeCurrency,
      homeCurrencySymbol,
      markAllWalletsLoading,
      confirmWalletsFromApi,
      router,
    ]
  );

  useEffect(() => {
    onSettlementConfirmedRef.current = () => {
      fetchUserData(true);
    };
  }, [fetchUserData]);

  /** ✅ Refresh like “reloaded” whenever user returns/back to Home */
  const didFocusOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // initial focus is handled by normal load; after that, force refresh
      if (!didFocusOnceRef.current) {
        didFocusOnceRef.current = true;
        return;
      }

      setRefreshing(true);
      fetchUserData(true);

      (async () => {
        const phone = userPhone || (await AsyncStorage.getItem("user_phone")) || "";
        if (phone) {
          const res = await getRecentRecipientsFromDB(phone, 10);
          if (res.success) setRecentRecipients(res.recipients);
        }
      })();

      refreshPendingSettlements();

      const t = setTimeout(() => setRefreshing(false), 800);
      return () => clearTimeout(t);
    }, [fetchUserData, refreshPendingSettlements, userPhone])
  );

  /** Initial load + refresh on first mount */
  useEffect(() => {
    if (!hasLoadedOnceRef.current && accountsRef.current.length === 0) setLoading(true);
    fetchUserData(false);

    (async () => {
      const phone = userPhone || (await AsyncStorage.getItem("user_phone")) || "";
      if (phone) {
        const res = await getRecentRecipientsFromDB(phone, 10);
        if (res.success) setRecentRecipients(res.recipients);
      }
    })();

    refreshPendingSettlements();
  }, [fetchUserData, refreshPendingSettlements, userPhone]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserData(true);

    (async () => {
      const phone = userPhone || (await AsyncStorage.getItem("user_phone")) || "";
      if (phone) {
        const res = await getRecentRecipientsFromDB(phone, 10);
        if (res.success) setRecentRecipients(res.recipients);
      }
    })();

    refreshPendingSettlements();
  }, [fetchUserData, refreshPendingSettlements, userPhone]);

  /** email verified check */
  useEffect(() => {
    (async () => {
      const phone = await AsyncStorage.getItem("user_phone");
      if (phone) {
        const emailCheck = await checkEmailVerified(phone as string);
        setEmailVerified(!!emailCheck?.emailVerified);
      }
    })();
  }, []);

  // Refresh accounts when the "Add money to" sheet opens to ensure fresh data
  useEffect(() => {
    if (sheetOpen && userPhone) {
      setSheetRefreshing(true);
      (async () => {
        try {
          const res = await getUserAccounts(userPhone, true);
          if (res.success && res.accounts) setAccounts(res.accounts);
        } catch {}
        setSheetRefreshing(false);
      })();
    }
  }, [sheetOpen, userPhone]);

  const visibleRates = useMemo(() => {
    const walletCurrencies = accounts.map((a) => normalizeCurrency(a.currencyCode));
    return displayRates.filter((r) => walletCurrencies.includes(r.from) && walletCurrencies.includes(r.to)).slice(0, 4);
  }, [displayRates, accounts]);

  const selectedRateObj = useMemo(() => (visibleRates.length > 0 ? visibleRates[0] : null), [visibleRates]);

  useEffect(() => {
    if (!selectedRateObj?.numericRate) {
      setHistoricalPoints([]);
      setChartChangePercent(0);
      return;
    }

    const fetchHistoricalData = async () => {
      setChartLoading(true);
      try {
        const response = await getHistoricalRates(selectedRateObj.from, selectedRateObj.to, selectedRange);
        if (response.success && response.points && response.points.length > 0) {
          setHistoricalPoints(response.points);

          if (selectedRange === "1D" && selectedRateObj.change) {
            const parsedChange = parseFloat(String(selectedRateObj.change).replace(/[+%]/g, ""));
            setChartChangePercent(isNaN(parsedChange) ? 0 : parsedChange);
          } else {
            const first = response.points[0]?.rate || selectedRateObj.numericRate;
            const last = response.points[response.points.length - 1]?.rate || selectedRateObj.numericRate;
            const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
            setChartChangePercent(changePct);
          }
        } else {
          const pts = generateMockHistory(selectedRateObj.numericRate, selectedRange);
          setHistoricalPoints(pts);
          const first = pts[0]?.rate || selectedRateObj.numericRate;
          const last = pts[pts.length - 1]?.rate || selectedRateObj.numericRate;
          const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
          setChartChangePercent(changePct);
        }
      } catch {
        const pts = generateMockHistory(selectedRateObj.numericRate, selectedRange);
        setHistoricalPoints(pts);
        const first = pts[0]?.rate || selectedRateObj.numericRate;
        const last = pts[pts.length - 1]?.rate || selectedRateObj.numericRate;
        const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
        setChartChangePercent(changePct);
      } finally {
        setChartLoading(false);
      }
    };

    fetchHistoricalData();
  }, [selectedRateObj?.numericRate, selectedRateObj?.from, selectedRateObj?.to, selectedRange]);

  const onFxChartLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== fxChartWidth) setFxChartWidth(w);
  };

  const shouldShowWalletSkeleton = useMemo(() => {
    if (loading && accounts.length === 0) return true;
    // if balances not confirmed, keep skeleton on wallet amounts (not the whole screen)
    return false;
  }, [loading, accounts.length]);

  const handleVerifyEmail = async () => {
    try {
      await sendEmailOtp(email);
      router.push(`/checkemail?email=${encodeURIComponent(email)}`);
    } catch {
      Alert.alert("Error", "Could not send verification email");
    }
  };

  const handleVerifyIdentity = async () => {
    setSaving(true);
    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) {
        Alert.alert("Error", "Phone number not found.");
        return;
      }
      const result = await createPlaidIdvSession({ phone });
      if (!result?.success || !result?.shareable_url) {
        Alert.alert("Error", result?.message || "Could not start verification");
        return;
      }
      router.push({
        pathname: "/personaverification",
        params: { url: result.shareable_url, inquiryId: result.idv_session_id || "" },
      });
    } catch {
      Alert.alert("Error", "Could not start identity verification");
    } finally {
      setSaving(false);
    }
  };

  const isKycApproved = kycStatus === "verified";
  const handleBlockedAction = () => {
    Alert.alert("Verify Your Email and Identity", "Your account verification is pending.");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenShell padded={false}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <NetworkBanner
            visible={!networkOk}
            text="We can’t load your wallets right now. Check your internet and tap Retry."
            onRetry={() => fetchUserData(true)}
          />

          {!isKycApproved || !emailVerified ? (
            <View
              style={{
                backgroundColor: "#FFF3CD",
                padding: 12,
                marginHorizontal: 16,
                marginTop: 8,
                borderRadius: 8,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(245,158,11,0.16)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                <Ionicons name="warning-outline" size={18} color="#856404" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: "#856404" }}>Verification Required</Text>
                <Text style={{ color: "#856404", fontSize: 12, marginTop: 2 }}>
                  To continue using your account, please verify your email and identity.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable style={styles.avatarCircle} onPress={() => router.push("/profile")}>
              <Ionicons name="person-outline" size={18} color="#111827" />
            </Pressable>

            <View style={{ marginLeft: 12 }}>
              {userName ? (
                <Text style={{ fontWeight: "600", fontSize: 14, color: "#222", marginBottom: 2 }}>{userName}</Text>
              ) : null}

              {loading && accounts.length === 0 ? (
                <TotalBalanceSkeleton />
              ) : (
                <Pressable onPress={toggleHideBalance} style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontWeight: "700", fontSize: 16, color: "#222" }}>
                    {hideBalance
                      ? "••••••"
                      : totalBalance === null
                      ? "—"
                      : `${homeCurrencySymbol}${formatBalance(totalBalance)}`}
                  </Text>
                  <Ionicons
                    name={hideBalance ? "eye-off-outline" : "eye-outline"}
                    size={16}
                    color="#6B7280"
                    style={{ marginLeft: 6 }}
                  />
                </Pressable>
              )}
            </View>

            <View style={{ flex: 1 }} />

            <Pressable
              style={styles.addAccountPill}
              onPress={() => (isKycApproved ? router.push("/addaccount") : handleBlockedAction())}
            >
              <Text style={styles.addAccountIcon}>＋</Text>
              <Text style={styles.addAccountText}>Add Wallet</Text>
            </Pressable>
          </View>

          {/* Accounts header */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My accounts</Text>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.hideBalanceRow} onPress={toggleHideBalance}>
              <Text style={styles.hideBalanceText}>{hideBalance ? "Show balance" : "Hide balance"}</Text>
              <Ionicons
                name={hideBalance ? "eye-off-outline" : "eye-outline"}
                size={14}
                color="#6B7280"
                style={{ marginLeft: 6 }}
              />
            </Pressable>
          </View>

          {/* Accounts row */}
          {shouldShowWalletSkeleton ? (
            <>
              <AccountsListSkeleton />
            </>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsRow}>
              {accounts.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center", width: "100%" }}>
                  <Pressable
                    style={[{ marginRight: 8 }, styles.addAccountSingle]}
                    onPress={() => router.push(`/addaccount`)}
                  >
                    <Ionicons name="add" size={24} color={COLORS.green} />
                  </Pressable>
                </View>
              ) : (
                accounts.map((a) => {
                  const walletDisabled = isWalletDisabled(a);
                  const ccyKey = normalizeCurrency(a.currencyCode);
                  const walletAmountStillLoading = !hideBalance && balanceLoadingByCurrency[ccyKey] === true && !walletsConfirmed;

                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => {
                        if (walletDisabled) {
                          Alert.alert("Wallet Disabled", "This wallet has been disabled.");
                          return;
                        }
                        if (!isKycApproved) {
                          handleBlockedAction();
                          return;
                        }
                        router.push(
                          `/wallet?accountData=${encodeURIComponent(
                            JSON.stringify({
                              id: a.id,
                              currencyCode: a.currencyCode,
                              accountName: a.accountName,
                              iban: a.iban,
                              bicSwift: a.bicSwift,
                              status: a.status,
                              balance: a.balance,
                              flag: getFlagForCurrency(a.currencyCode),
                              currencyName: a.currency?.name || a.currencyCode,
                            })
                          )}`
                        );
                      }}
                      style={{ marginRight: 12, opacity: walletDisabled ? 0.6 : 1 }}
                    >
                      {/* ✅ Plain fintech card (no LinearGradient) */}
                      <View
                        style={[
                          styles.accountCardGradient,
                          {
                            backgroundColor: "#28b085ff",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.18)",
                          },
                        ]}
                      >
                        {walletDisabled ? (
                          <View
                            style={{
                              position: "absolute",
                              top: 10,
                              right: 10,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 10,
                              backgroundColor: "rgba(0,0,0,0.35)",
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>DISABLED</Text>
                          </View>
                        ) : hasPendingForCurrency(a.currencyCode) ? (
                          <View style={{ position: "absolute", top: 10, right: 10 }}>
                            <PendingBadge visible={true} label="Settling" size="small" />
                          </View>
                        ) : null}

                        <View style={styles.accountHeader}>
                          <CountryFlag currencyCode={a.currencyCode} size="md" />
                          <Text style={styles.accountLabelWhite}>{a.currencyCode}</Text>
                        </View>

                        {walletAmountStillLoading ? (
                          <SkeletonPulse
                            style={{
                              width: 120,
                              height: 24,
                              backgroundColor: "rgba(255,255,255,0.35)",
                              borderRadius: 10,
                              marginTop: 6,
                            }}
                          />
                        ) : (
                          <Text style={styles.accountAmountWhite}>
                            {formatBalance(
                              hasPendingForCurrency(a.currencyCode)
                                ? isValidNumber(a.balance)
                                  ? getOptimisticBalance(a.balance as number, a.currencyCode)
                                  : null
                                : a.balance
                            )}
                          </Text>
                        )}

                        <Image
                          source={require("../../../assets/images/icons/coins.png")}
                          style={styles.cardCornerImage}
                          resizeMode="contain"
                        />
                      </View>
                    </Pressable>
                  );
                })
              )}

              {/* Add wallet card */}
              <Pressable onPress={() => router.push("/addaccount")} style={{ marginRight: 12 }}>
                <View
                  style={{
                    width: 210,
                    height: 140,
                    borderRadius: 16,
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: COLORS.green,
                    justifyContent: "center",
                    alignItems: "center",
                    shadowColor: "#000",
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: "rgba(22,163,74,0.12)",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons name="add" size={32} color={COLORS.primary} />
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.primary }}>Add wallet</Text>
                </View>
              </Pressable>
            </ScrollView>
          )}

          {/* Actions (with icons) */}
          <View style={styles.actionsRow}>
            <PrimaryButton
              title={
                <Text style={{ fontWeight: "600" }}>
                  <Ionicons name="arrow-forward" size={16} color="#fff" /> Transfer Now
                </Text> as any
              }
              onPress={() => (isKycApproved ? router.push("/sendmoney") : handleBlockedAction())}
              style={{ flex: 1 }}
            />
            <OutlineButton
              title={
                <Text style={{ fontWeight: "600", color: COLORS.primary }}>
                  <Ionicons name="add" size={16} color={COLORS.primary} /> Add Money
                </Text> as any
              }
              onPress={() => (isKycApproved ? setSheetOpen(true) : handleBlockedAction())}
              style={{ flex: 1, marginLeft: 12 }}
            />
          </View>

          {/* Verify Cards */}
          {!emailVerified && <VerifyEmailCard email={email} onPress={handleVerifyEmail} />}
          {emailVerified && kycStatus === "pending" && (
            <VerifyIdentityCardScreen userPhone={userPhone} onPress={handleVerifyIdentity} />
          )}

          {/* Recent */}
          <Text style={[styles.sectionTitle, { marginTop: 18, paddingHorizontal: 16 }]}>Recent Recipients</Text>
          <View style={styles.recentRow}>
            {recentRecipients.map((r, idx) => (
              <Pressable
                key={`${r.destCurrency}-${r.bankCode}-${r.accountNumber}-${idx}`}
                style={styles.recentCard}
                onPress={() => {
                  if (!isKycApproved) return handleBlockedAction();
                  router.push({
                    pathname: "/sendmoney" as any,
                    params: { recipient: JSON.stringify(r), mode: "recent" },
                  } as any);
                }}
              >
                <View style={styles.recentAvatarWrap}>
                  <View style={styles.recentAvatar}>
                    <Text style={{ fontWeight: "700", color: "#323232ff" }}>{getInitials(r.accountName)}</Text>
                  </View>
                  <View style={styles.smallFlag}>
                    <CountryFlag currencyCode={r.destCurrency} size="sm" />
                  </View>
                </View>
                <Text style={styles.recentName} numberOfLines={1}>
                  {r.accountName}
                </Text>
                {!!r.bankName && (
                  <Text style={styles.recentBank} numberOfLines={2}>
                    {r.bankName}
                  </Text>
                )}
              </Pressable>
            ))}

            {recentRecipients.length === 0 && (
              <Pressable
                style={styles.recentEmptyCard}
                onPress={() => {
                  if (!isKycApproved) return handleBlockedAction();
                  router.push("/sendmoney");
                }}
              >
                <View style={{ alignItems: "center" }}>
                  <View style={styles.recentEmptyIconCircle}>
                    {/* ✅ icon (no emoji) */}
                    <Ionicons name="people-outline" size={24} color={COLORS.primary} />
                  </View>

                  <View style={{ marginTop: 12, alignItems: "center" }}>
                    <Text style={styles.recentEmptyTitle}>No recent recipients yet</Text>
                    <Text style={{ marginTop: 6, color: "#9CA3AF", fontWeight: "700", fontSize: 12 }}>
                      Start a transfer to see them here
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          </View>

          {/* Referral */}
          <Text style={[styles.sectionTitle, { marginTop: 18, paddingHorizontal: 16 }]}>Referral</Text>
          <Pressable style={styles.referralBanner} onPress={() => router.push("/referral")}>
            <View style={styles.referralLeft}>
              <View style={styles.referralIconWrap}>
                <Ionicons name="gift-outline" size={22} color={COLORS.primary} />
              </View>

              <View>
                <Text style={styles.referralTitle}>Refer a friend</Text>
                <Text style={styles.referralSubtitle}>Get 3% bonus on their first transfer</Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          {/* Exchange Rates */}
          <Text style={[styles.sectionTitle, { marginTop: 18, paddingHorizontal: 16 }]}>Exchange Rates</Text>

          <View style={styles.fxCard}>
            <View style={styles.fxHeader}>
              <View>
                <Text style={styles.fxTitle}>Live exchange rates</Text>
                <Text style={styles.fxSubtitle}>Mid-market • updates frequently</Text>
              </View>
              <Pressable onPress={() => router.push("/exchangerates")}>
                <Text style={styles.fxSeeAll}>See all</Text>
              </Pressable>
            </View>

            <View style={styles.fxDivider} />

            {ratesLoading ? (
              <ExchangeRatesSkeleton />
            ) : visibleRates.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Ionicons name="trending-up-outline" size={40} color={COLORS.primary} />
                <Text style={{ color: "#888", fontSize: 14, textAlign: "center", marginTop: 8 }}>
                  Add at least two currency accounts to see rates.
                </Text>
              </View>
            ) : (
              visibleRates.map((x, idx) => {
                const isPositive = String(x.change).trim().startsWith("+");
                return (
                  <Pressable
                    key={`${x.from}-${x.to}-${idx}`}
                    style={[styles.fxRow, idx === visibleRates.length - 1 ? { paddingBottom: 14 } : null]}
                    onPress={() => router.push(`/convert?from=${x.from}&to=${x.to}`)}
                  >
                    <View style={styles.fxLeft}>
                      <View style={styles.fxFlags}>
                        <CountryFlag currencyCode={x.from} size="md" />
                        <CountryFlag currencyCode={x.to} size="md" style={{ marginLeft: -8 }} />
                      </View>

                      <View>
                        <Text style={styles.fxPair}>
                          {x.from} → {x.to}
                        </Text>
                        <Text style={styles.fxPairSub}>
                          1 {x.from} = {x.rate} {x.to}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fxRight}>
                      <View style={[styles.fxChangePill, isPositive ? styles.fxUp : styles.fxDown]}>
                        <Text style={[styles.fxChangeText, isPositive ? styles.fxUpText : styles.fxDownText]}>
                          {x.change}
                        </Text>
                      </View>
                      <Text style={styles.fxChevron}>›</Text>
                    </View>
                  </Pressable>
                );
              })
            )}

            {selectedRateObj && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 14 }} onLayout={onFxChartLayout}>
                {fxChartWidth > 0 && (
                  <>
                    <LiveRateMiniChart
                      pairLabel={`${selectedRateObj.from} → ${selectedRateObj.to}`}
                      baseRate={selectedRateObj.numericRate}
                      changePercent={chartChangePercent}
                      range={selectedRange}
                      onRangeChange={setSelectedRange}
                      containerWidth={fxChartWidth}
                      historicalPoints={historicalPoints}
                      isLoading={chartLoading}
                    />

                    <View style={styles.midMarketBox}>
                      <View style={styles.midMarketRow}>
                        <View style={styles.midMarketIconWrap}>
                          <Ionicons name="globe-outline" size={16} style={styles.midMarketIcon} />
                        </View>
                        <View style={styles.midMarketTextWrap}>
                          <Text style={styles.midMarketTitle}>Mid-Market Rates</Text>
                          <Text style={styles.midMarketDescription}>
                            All rates shown are <Text style={styles.midMarketStrong}>mid-market rates</Text>. These
                            represent the midpoint between buy and sell prices.
                          </Text>
                        </View>
                      </View>
                    </View>
                  </>
                )}

                <View style={{ marginTop: 10 }}>
                  <Text style={styles.fxFooterText}>Last updated: just now</Text>
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </ScreenShell>

      {/* Add money bottom sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text style={styles.sheetTitle}>Add money to</Text>

        {sheetRefreshing ? (
          <View style={{ padding: 30, alignItems: "center" }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={{ color: "#888", marginTop: 8 }}>Loading accounts...</Text>
          </View>
        ) : accounts.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#888", padding: 20 }}>No wallets available.</Text>
        ) : (
          accounts.map((a) => {
            const walletDisabled = isWalletDisabled(a);
            return (
              <Pressable
                key={a.id}
                style={[styles.sheetRow, { opacity: walletDisabled ? 0.6 : 1 }]}
                onPress={() => {
                  if (walletDisabled) {
                    Alert.alert("Wallet Disabled", "This wallet has been disabled.");
                    return;
                  }
                  setSheetOpen(false);
                  router.push("/addmoneymethods");
                }}
              >
                <View style={styles.sheetRowLeft}>
                  <CountryFlag currencyCode={a.currencyCode} size="lg" />
                  <View>
                    <Text style={styles.sheetRowTitle}>{a.currencyCode}</Text>
                    <Text style={styles.sheetRowSub}>{a.currencyCode}</Text>
                  </View>
                </View>
                <Text style={styles.sheetRowAmt}>{formatBalance(a.balance)}</Text>
              </Pressable>
            );
          })
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
