import {
  createPlaidIdvSession,
  // getCountries, // ❌ not used for live rate flags anymore
  getExchangeRates,
  getPublicCountries,
  getTotalBalance,
  getUserAccounts,
  getUserProfile,
  sendEmailOtp
} from "@/api/config";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import VerifyEmailCard from "../../../components/src/screens/VerifyEmailCardScreen";
import { usePendingSettlements } from "../../../hooks/usePendingSettlements";
import { COLORS } from "../../../theme/colors";
import { styles } from "../../../theme/styles";
import { useAutoPolling } from "../../hooks/useAutoPolling";
import BottomSheet from "./../../BottomSheet";
import OutlineButton from "./../../OutlineButton";
import PrimaryButton from "./../../PrimaryButton";
import ScreenShell from "./../../ScreenShell";

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

type HistoricalPoint = {
  date: string;
  timestamp: number;
  rate: number;
};

type RangeKey = "1D" | "5D" | "1M" | "1Y" | "5Y" | "MAX";

/** --- Recipient types (for Recents) --- **/
type SavedRecipient = {
  id: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  createdAt: number;
};

type RecentRecipient = SavedRecipient & {
  destCurrency: "NGN" | "CAD";
  lastSentAt: number;
};

const HIDE_BALANCE_KEY = "hide_balance_preference";
const RECENT_RECIPIENTS_KEY = "recent_recipients_v1";
const CACHED_ACCOUNTS_KEY = "cached_accounts_v1";
const CACHED_TOTAL_BALANCE_KEY = "cached_total_balance_v1";
const CACHED_FLAGS_KEY = "cached_flags_v1";

// Known exotic currencies - fallback if backend doesn't return isExotic flag
const KNOWN_EXOTIC_CURRENCIES = ["NGN", "GHS", "RWF", "UGX", "TZS", "ZMW", "XOF", "XAF"];

/** Fallback flags for common currencies when not found in API */
const FALLBACK_FLAGS: Record<string, string> = {
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
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  CHF: "🇨🇭",
  JPY: "🇯🇵",
  CNY: "🇨🇳",
  INR: "🇮🇳",
  ZAR: "🇿🇦",
  AED: "🇦🇪",
  SGD: "🇸🇬",
  HKD: "🇭🇰",
  MXN: "🇲🇽",
  BRL: "🇧🇷",
  SEK: "🇸🇪",
  NOK: "🇳🇴",
  DKK: "🇩🇰",
  PLN: "🇵🇱",
  CZK: "🇨🇿",
  HUF: "🇭🇺",
  THB: "🇹🇭",
  MYR: "🇲🇾",
  IDR: "🇮🇩",
  PHP: "🇵🇭",
  VND: "🇻🇳",
  EGP: "🇪🇬",
  PKR: "🇵🇰",
  BDT: "🇧🇩",
  COP: "🇨🇴",
  CLP: "🇨🇱",
  PEN: "🇵🇪",
  ARS: "🇦🇷",
};

/** ---------- Mini chart helpers ---------- **/
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
    if (chartW <= 0 || historicalPoints.length < 2) {
      return { linePath: "", fillPath: "", lastPoint: { x: 0, y: 0 } };
    }

    const padX = 14;
    const padTop = 14;
    const padBottom = 26;

    const rates = historicalPoints.map((p) => p.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const span = Math.max(1e-9, max - min);

    const usableW = Math.max(1, chartW - padX * 2);
    const usableH = Math.max(1, chartH - padTop - padBottom);

    const pts = historicalPoints.map((p, i) => {
      const x = padX + (i / (historicalPoints.length - 1)) * usableW;
      const y = padTop + (1 - (p.rate - min) / span) * usableH;
      return { x, y };
    });

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
        {ranges.map((r) => {
          const active = r === range;
          return (
            <Pressable
              key={r}
              onPress={() => onRangeChange(r)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? "rgba(25,149,95,0.10)" : "transparent",
              }}
            >
              <Text style={{ fontWeight: "600", color: active ? "#19955f" : "#6b7280", fontSize: 12 }}>{r}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <View>
          <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600" }}>{pairLabel}</Text>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "600", marginTop: 2 }}>
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
          <Text style={{ fontSize: 12, fontWeight: "600", color: isPositive ? "#19955f" : "#ef4444" }}>
            {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", width: "100%" }}>
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

/** ---------- Local mock historical generator (no new API needed) ---------- **/
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

    out.push({
      date: new Date(t).toISOString(),
      timestamp: t,
      rate: value,
    });
  }
  return out;
}

/** ---------- Recent recipients helpers ---------- **/
async function getRecentRecipients(): Promise<RecentRecipient[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_RECIPIENTS_KEY);
    const list = raw ? (JSON.parse(raw) as RecentRecipient[]) : [];
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => (b.lastSentAt || 0) - (a.lastSentAt || 0));
  } catch {
    return [];
  }
}

function getInitials(name: string) {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function HomeScreen() {
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [flagsByCurrency, setFlagsByCurrency] = useState<Record<string, string>>({});
  const [disabledCurrencies, setDisabledCurrencies] = useState<Record<string, true>>({});
  const [displayRates, setDisplayRates] = useState<DisplayRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);

  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [homeCurrency, setHomeCurrency] = useState<string>("");
  const [homeCurrencySymbol, setHomeCurrencySymbol] = useState<string>("");

  const fetchVersionRef = useRef(0);
  const isFetchingRef = useRef(false);
  const [totalBalanceLoading, setTotalBalanceLoading] = useState(true);

  const [hideBalance, setHideBalance] = useState(false);

  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);

  const [selectedRange, setSelectedRange] = useState<RangeKey>("1M");
  const [fxChartWidth, setFxChartWidth] = useState(0);
  const [historicalPoints, setHistoricalPoints] = useState<HistoricalPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartChangePercent, setChartChangePercent] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);

  const {
    settlements: pendingSettlements,
    hasPendingForCurrency,
    getOptimisticBalance,
    refresh: refreshPendingSettlements,
    checkAndClearIfSettled,
    removeSettlement,
  } = usePendingSettlements();

  const clearSettledConversions = useCallback(
    async (freshAccounts: UserAccount[]) => {
      if (pendingSettlements.length === 0) return;

      for (const settlement of pendingSettlements) {
        const sellCcy = (settlement.sellCurrency || "").toUpperCase().trim();
        const buyCcy = (settlement.buyCurrency || "").toUpperCase().trim();

        const sellAccount = freshAccounts.find((a) => (a.currencyCode || "").toUpperCase().trim() === sellCcy);
        const buyAccount = freshAccounts.find((a) => (a.currencyCode || "").toUpperCase().trim() === buyCcy);

        const sellNeedsConfirm = Number(settlement.sellAmount || 0) !== 0;
        const buyNeedsConfirm = Number(settlement.buyAmount || 0) !== 0;

        const sellBaselineOk = typeof settlement.sellBalanceBefore === "number";
        const buyBaselineOk = typeof settlement.buyBalanceBefore === "number";

        const sellSettled = !sellNeedsConfirm
          ? true
          : sellAccount && sellBaselineOk
            ? await checkAndClearIfSettled(
              sellCcy,
              Number(sellAccount.balance || 0),
              Number(settlement.sellBalanceBefore) - Number(settlement.sellAmount || 0),
              0.01
            )
            : false;

        const buySettled = !buyNeedsConfirm
          ? true
          : buyAccount && buyBaselineOk
            ? await checkAndClearIfSettled(
              buyCcy,
              Number(buyAccount.balance || 0),
              Number(settlement.buyBalanceBefore) + Number(settlement.buyAmount || 0),
              0.01
            )
            : false;

        if (sellSettled && buySettled) {
          await removeSettlement(settlement.id, true);
        }
      }
    },
    [pendingSettlements, checkAndClearIfSettled, removeSettlement]
  );

  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const [fetchedEmailVerified, hideBalanceStored, cachedAccounts, cachedTotalBalance, cachedFlags] =
          await Promise.all([
            AsyncStorage.getItem("email_verified"),
            AsyncStorage.getItem(HIDE_BALANCE_KEY),
            AsyncStorage.getItem(CACHED_ACCOUNTS_KEY),
            AsyncStorage.getItem(CACHED_TOTAL_BALANCE_KEY),
            AsyncStorage.getItem(CACHED_FLAGS_KEY),
          ]);

        setEmailVerified(fetchedEmailVerified?.toString() === "true");
        if (hideBalanceStored !== null) setHideBalance(hideBalanceStored === "true");

        if (cachedAccounts) {
          try {
            const parsed = JSON.parse(cachedAccounts);
            if (Array.isArray(parsed) && parsed.length > 0) setAccounts(parsed);
          } catch { }
        }

        if (cachedTotalBalance) {
          try {
            const parsed = JSON.parse(cachedTotalBalance);
            if (parsed && typeof parsed.balance === "number") {
              setTotalBalance(parsed.balance);
              if (parsed.currency) setHomeCurrency(parsed.currency);
              if (parsed.symbol) setHomeCurrencySymbol(parsed.symbol);
              setTotalBalanceLoading(false);
            }
          } catch { }
        }

        if (cachedFlags) {
          try {
            const parsed = JSON.parse(cachedFlags);
            if (parsed && typeof parsed === "object") setFlagsByCurrency(parsed);
          } catch { }
        }
      } catch { }
    };
    loadCachedData();
  }, []);

  const toggleHideBalance = useCallback(async () => {
    const newValue = !hideBalance;
    setHideBalance(newValue);
    try {
      await AsyncStorage.setItem(HIDE_BALANCE_KEY, String(newValue));
    } catch { }
  }, [hideBalance]);

  const formatBalance = useCallback(
    (balance?: number | null) => {
      if (hideBalance) return "••••••";
      if (balance === null || balance === undefined) return "—";
      return balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    [hideBalance]
  );

  const fetchUserData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const currentVersion = ++fetchVersionRef.current;

    try {
      await refreshPendingSettlements();
      if (currentVersion !== fetchVersionRef.current) return;

      const [phone, storedUser] = await Promise.all([
        AsyncStorage.getItem("user_phone"),
        AsyncStorage.getItem("user_info"),
      ]);

      if (storedUser) {
        const userInfo = JSON.parse(storedUser);
        setEmail(userInfo.email);
        const firstName = userInfo.firstName || userInfo.first_name || "";
        setUserName(String(firstName).trim());
      }

      if (!phone) {
        if (currentVersion === fetchVersionRef.current) {
          setLoading(false);
          setRefreshing(false);
          setTotalBalanceLoading(false);
          setRatesLoading(false);
        }
        return;
      }

      // ✅ FIX: Use getPublicCountries for flags (currencyCode -> flag)
      const [publicCountriesResult, profileResult, accountsResult, totalResult] = await Promise.allSettled([
        getPublicCountries(),
        getUserProfile(phone),
        getUserAccounts(phone, true),
        getTotalBalance(phone),
      ]);

      if (currentVersion !== fetchVersionRef.current) return;

      /** ---------------- ✅ Corrected flags mapping ---------------- **/
      const normalize = (v: any) => String(v || "").toUpperCase().trim();

      let flagsMap: Record<string, string> = {};
      let disabledMap: Record<string, true> = {};

      if (publicCountriesResult.status === "fulfilled") {
        const publicCountries = publicCountriesResult.value as Country[];

        for (const c of publicCountries || []) {
          const flag = String(c.flag || "").trim();
          const ccy = normalize(c.currencyCode);
          const countryCode = normalize(c.code);

          // ✅ This is what live-rates need (USD/CAD/etc)
          if (ccy && flag) flagsMap[ccy] = flag;

          // Optional: keep country codes too
          if (countryCode && flag && !flagsMap[countryCode]) flagsMap[countryCode] = flag;

          if (ccy && c.currencyEnabled === false) disabledMap[ccy] = true;
        }
      }

      if (Object.keys(flagsMap).length > 0) {
        setFlagsByCurrency(flagsMap);
        setDisabledCurrencies(disabledMap);
        AsyncStorage.setItem(CACHED_FLAGS_KEY, JSON.stringify(flagsMap)).catch(() => { });
      } else {
        // keep existing state (cached) if API fails
        flagsMap = flagsByCurrency || {};
      }
      /** ---------------- ✅ End corrected flags mapping ---------------- **/

      // profile
      let userHomeCurrency = "";
      if (profileResult.status === "fulfilled") {
        const res: any = profileResult.value;
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
      }

      // total
      if (totalResult.status === "fulfilled") {
        const totalRes: any = totalResult.value;
        if (totalRes?.success) {
          const nextTotal = Number(totalRes.totalBalance);
          if (Number.isFinite(nextTotal)) {
            setTotalBalance(nextTotal);
            AsyncStorage.setItem(
              CACHED_TOTAL_BALANCE_KEY,
              JSON.stringify({
                balance: nextTotal,
                currency: totalRes.homeCurrency || homeCurrency,
                symbol: totalRes.homeCurrencySymbol || homeCurrencySymbol,
                cachedAt: Date.now(),
              })
            ).catch(() => { });
          }
          if (totalRes.homeCurrency) {
            setHomeCurrency(totalRes.homeCurrency);
            setHomeCurrencySymbol(totalRes.homeCurrencySymbol || totalRes.homeCurrency);
          }
        }
        setTotalBalanceLoading(false);
      } else {
        setTotalBalanceLoading(false);
      }

      // accounts
      let userAccounts: UserAccount[] = [];
      if (accountsResult.status === "fulfilled") {
        const accountsRes: any = accountsResult.value;
        if (accountsRes?.success && Array.isArray(accountsRes.accounts)) {
          userAccounts = accountsRes.accounts;

          const localLedgerAccounts = userAccounts.filter((a: any) => {
            const code = normalize(a.currencyCode);
            const backendExotic = Boolean(a.isExotic || a.is_exotic || a.currency?.isExotic || a.currency?.is_exotic);
            const knownExotic = KNOWN_EXOTIC_CURRENCIES.includes(code);
            return backendExotic || knownExotic;
          });

          if (localLedgerAccounts.length > 0) {
            try {
              const results = await Promise.all(
                localLedgerAccounts.map(async (a) => {
                  const ccy = normalize(a.currencyCode);
                  const res = await getLocalBalance(phone, ccy);
                  return { ccy, res };
                })
              );

              if (currentVersion !== fetchVersionRef.current) return;

              const balanceByCurrency = new Map<string, number>();
              for (const { ccy, res } of results) {
                if (res?.success) balanceByCurrency.set(ccy, Number(res.balance || 0));
              }

              userAccounts = userAccounts.map((a) => {
                const ccy = normalize(a.currencyCode);
                if (balanceByCurrency.has(ccy)) return { ...a, balance: balanceByCurrency.get(ccy)!, isExotic: true };
                return a;
              });
            } catch { }
          }

          if (currentVersion === fetchVersionRef.current) {
            setAccounts(userAccounts);
            AsyncStorage.setItem(CACHED_ACCOUNTS_KEY, JSON.stringify(userAccounts)).catch(() => { });
          }

          await clearSettledConversions(userAccounts);
        }
      }

      // ===== exchange rates =====
      if (currentVersion !== fetchVersionRef.current) return;

      setRatesLoading(true);
      try {
        const currencyCodes = userAccounts.map((a) => normalize(a.currencyCode)).filter(Boolean);
        if (userHomeCurrency && !currencyCodes.includes(userHomeCurrency)) currencyCodes.push(userHomeCurrency);

        const pairs: string[] = [];
        for (const from of currencyCodes) for (const to of currencyCodes) if (from !== to) pairs.push(`${from}_${to}`);

        if (pairs.length > 0) {
          const ratesRes: any = await getExchangeRates(pairs.join(","));
          if (currentVersion !== fetchVersionRef.current) return;

          if (ratesRes?.success && Array.isArray(ratesRes.rates)) {
            const formatted: DisplayRate[] = ratesRes.rates.map((r: any) => {
              const from = normalize(r.fromCurrency || r.buy_currency);
              const to = normalize(r.toCurrency || r.sell_currency);
              const numericRate = parseFloat(r.rate || r.core_rate || 0);

              const changeStr = r.change || "+0.0%";

              return {
                from,
                to,
                // ✅ FIX: use flags from getPublicCountries mapping
                fromFlag: flagsMap[from] || FALLBACK_FLAGS[from] || "",
                toFlag: flagsMap[to] || FALLBACK_FLAGS[to] || "",
                rate: numericRate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
                change: changeStr,
                numericRate,
              };
            });

            setDisplayRates(formatted);
          } else {
            setDisplayRates([]);
          }
        } else {
          setDisplayRates([]);
        }
      } catch {
        if (currentVersion === fetchVersionRef.current) setDisplayRates([]);
      } finally {
        if (currentVersion === fetchVersionRef.current) setRatesLoading(false);
      }
    } catch (e) {
      console.log("Error fetching user data:", e);
    } finally {
      isFetchingRef.current = false;
      if (currentVersion === fetchVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
        setTotalBalanceLoading(false);
      }
    }
  }, [
    clearSettledConversions,
    refreshPendingSettlements,
    flagsByCurrency,
    homeCurrency,
    homeCurrencySymbol,
  ]);

  useAutoPolling(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData]),
    { intervalMs: 10000, enabled: true, fetchOnMount: true }
  );

  useEffect(() => {
    (async () => {
      const list = await getRecentRecipients();
      setRecentRecipients(list);
    })();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserData();
    (async () => setRecentRecipients(await getRecentRecipients()))();
  }, [fetchUserData]);

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

      const result: any = await createPlaidIdvSession({ phone });
      if (!result?.success || !result?.shareable_url) {
        Alert.alert("Error", result?.message || "Could not start verification");
        return;
      }

      router.push({
        pathname: "/persona-verification",
        params: { url: result.shareable_url, inquiryId: result.idv_session_id || "" },
      } as any);
    } catch {
      Alert.alert("Error", "Could not start identity verification");
    } finally {
      setSaving(false);
    }
  };

  const isKycApproved = kycStatus === "verified";

  const handleBlockedAction = () => {
    Alert.alert("KYC Pending", "Your account verification is pending approval. Please wait for admin approval.");
  };

  const getFlagForCurrency = (currencyCode?: string) => {
    const key = String(currencyCode || "").toUpperCase().trim();
    return flagsByCurrency[key] || FALLBACK_FLAGS[key] || "";
  };

  const isWalletDisabled = (a?: Pick<UserAccount, "status" | "currencyCode"> | null) => {
    const status = String(a?.status || "").toLowerCase().trim();
    if (status === "disabled" || status === "inactive" || status === "in-active") return true;

    const code = String(a?.currencyCode || "").toUpperCase().trim();
    return !!(code && disabledCurrencies[code]);
  };

  const visibleRates = useMemo(() => {
    const walletCurrencies = accounts.map((a) => String(a.currencyCode || "").toUpperCase().trim());
    const filtered = displayRates.filter((r) => walletCurrencies.includes(r.from) && walletCurrencies.includes(r.to));

    const sorted = filtered.sort((a, b) => {
      const aFromIndex = walletCurrencies.indexOf(a.from);
      const aToIndex = walletCurrencies.indexOf(a.to);
      const bFromIndex = walletCurrencies.indexOf(b.from);
      const bToIndex = walletCurrencies.indexOf(b.to);
      if (aFromIndex !== bFromIndex) return aFromIndex - bFromIndex;
      return aToIndex - bToIndex;
    });

    return sorted.slice(0, 4);
  }, [displayRates, accounts]);

  const selectedRateObj = useMemo(() => (visibleRates.length > 0 ? visibleRates[0] : null), [visibleRates]);

  useEffect(() => {
    if (!selectedRateObj?.numericRate) {
      setHistoricalPoints([]);
      setChartChangePercent(0);
      return;
    }
    setChartLoading(true);
    const pts = generateMockHistory(selectedRateObj.numericRate, selectedRange);
    setHistoricalPoints(pts);
    const first = pts[0]?.rate || selectedRateObj.numericRate;
    const last = pts[pts.length - 1]?.rate || selectedRateObj.numericRate;
    setChartChangePercent(first > 0 ? ((last - first) / first) * 100 : 0);
    const t = setTimeout(() => setChartLoading(false), 250);
    return () => clearTimeout(t);
  }, [selectedRateObj?.numericRate, selectedRange]);

  const onFxChartLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== fxChartWidth) setFxChartWidth(w);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScreenShell padded={false}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {!loading && !isKycApproved && (
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
              <Text style={{ fontSize: 16, marginRight: 8 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", color: "#856404" }}>KYC Verification Pending</Text>
                <Text style={{ color: "#856404", fontSize: 12, marginTop: 2 }}>
                  Your account is awaiting admin approval. Some features are restricted.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.topBar}>
            <Pressable style={styles.avatarCircle} onPress={() => router.push("/profile")}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </Pressable>

            <View style={{ marginLeft: 12 }}>
              {userName ? (
                <Text style={{ fontWeight: "600", fontSize: 14, color: "#222", marginBottom: 2 }}>{userName}</Text>
              ) : null}

              {totalBalanceLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Pressable onPress={toggleHideBalance} style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontWeight: "600", fontSize: 16, color: "#222" }}>
                    {hideBalance ? "••••••" : `${homeCurrencySymbol}${formatBalance(totalBalance)}`}
                  </Text>
                  <Text style={{ marginLeft: 6, fontSize: 14 }}>{hideBalance ? "🙈" : "👁️"}</Text>
                </Pressable>
              )}
            </View>

            <View style={{ flex: 1 }} />

            <Pressable
              style={styles.addAccountPill}
              onPress={() => (isKycApproved ? router.push("/addaccount") : handleBlockedAction())}
            >
              <Text style={styles.addAccountIcon}>＋</Text>
              <Text style={styles.addAccountText}>Add account</Text>
            </Pressable>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My accounts</Text>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.hideBalanceRow} onPress={toggleHideBalance}>
              <Text style={styles.hideBalanceText}>{hideBalance ? "Show balance" : "Hide balance"}</Text>
              <Text style={{ marginLeft: 6 }}>{hideBalance ? "🙈" : "👁️"}</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsRow}>
            {accounts.length === 0 && !loading ? (
              <View style={{ padding: 20, alignItems: "center", width: "100%" }}>
                <Text style={{ color: "#888", fontSize: 14 }}>No accounts yet. Tap "Add account" to create one.</Text>
              </View>
            ) : (
              accounts.map((a) => {
                const walletDisabled = isWalletDisabled(a);
                const currencyCode = String(a.currencyCode || "").toUpperCase().trim();
                const baseBalance = typeof a.balance === "number" ? a.balance : null;
                const displayBalance = baseBalance !== null ? getOptimisticBalance(baseBalance, currencyCode) : null;

                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      if (walletDisabled) {
                        Alert.alert("Wallet Disabled", "This wallet has been disabled by an administrator.");
                        return;
                      }
                      if (!isKycApproved) {
                        handleBlockedAction();
                        return;
                      }

                      const accountData = JSON.stringify({
                        id: a.id,
                        currencyCode: a.currencyCode,
                        accountName: a.accountName,
                        iban: a.iban,
                        bicSwift: a.bicSwift,
                        status: a.status,
                        balance: typeof a.balance === "number" ? a.balance : null,
                        flag: getFlagForCurrency(a.currencyCode),
                        currencyName: a.currency?.name || a.currencyCode,
                      });

                      router.push(`/wallet?accountData=${encodeURIComponent(accountData)}`);
                    }}
                    style={{ marginRight: 12, opacity: walletDisabled ? 0.6 : 1 }}
                  >
                    <LinearGradient
                      colors={a.currencyCode === "CAD" ? ["#3c3b3bff", "#3c3b3b"] : ["#19955f", "#19955f"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.accountCardGradient}
                    >
                      <View style={styles.accountHeader}>
                        <Text style={[styles.flag, { color: "#fff" }]}>{getFlagForCurrency(a.currencyCode)}</Text>
                        <Text style={styles.accountLabelWhite}>{a.currencyCode}</Text>
                      </View>

                      <Text style={styles.accountAmountWhite}>{formatBalance(displayBalance)}</Text>

                      <Image
                        source={require("../../../assets/images/icons/icons-icon.png")}
                        style={styles.cardCornerImage}
                        resizeMode="contain"
                      />
                    </LinearGradient>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.actionsRow}>
            <PrimaryButton
              title="Transfer Now"
              onPress={() => (isKycApproved ? router.push("/sendmoney") : handleBlockedAction())}
              style={{ flex: 1 }}
            />
            <OutlineButton
              title={`+ Add Money`}
              onPress={() => (isKycApproved ? setSheetOpen(true) : handleBlockedAction())}
              style={{ flex: 1, marginLeft: 12 }}
            />
          </View>

          {kycStatus === "pending" && <VerifyEmailCard email={email} onPress={handleVerifyEmail} />}

          <Text style={[styles.sectionTitle, { marginTop: 18, paddingHorizontal: 16 }]}>Recent Recipients</Text>
          <View style={styles.recentRow}>
            {recentRecipients.map((r, idx) => {
              const initials = getInitials(r.accountName);
              const flag = r.destCurrency === "NGN" ? "🇳🇬" : "🇨🇦";
              return (
                <Pressable
                  key={`${r.destCurrency}-${r.bankCode}-${r.accountNumber}-${idx}`}
                  style={styles.recentCard}
                  onPress={() => {
                    if (!isKycApproved) return handleBlockedAction();
                    router.push({ pathname: "/sendmoney" as any, params: { recipient: JSON.stringify(r), mode: "recent" } } as any);
                  }}
                >
                  <View style={styles.recentAvatarWrap}>
                    <View style={styles.recentAvatar}>
                      <Text style={{ fontWeight: "600", color: "#323232ff" }}>{initials}</Text>
                    </View>
                    <View style={styles.smallFlag}>
                      <Text>{flag}</Text>
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
              );
            })}
            {recentRecipients.length === 0 && (
              <Text style={{ color: "#9CA3AF", paddingHorizontal: 16, marginTop: 8 }}>No recent recipients yet</Text>
            )}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 18, paddingHorizontal: 16, marginBottom: 8 }]}>Exchange Rates</Text>

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
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : visibleRates.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={{ color: "#888", fontSize: 14, textAlign: "center" }}>
                  Add at least two currency accounts to see exchange rates between them.
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
                        <Text style={styles.fxFlag}>{x.fromFlag}</Text>
                        <Text style={styles.fxFlag}>{x.toFlag}</Text>
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
                            All rates shown are <Text style={styles.midMarketStrong}>mid-market rates</Text>.
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
        </ScrollView>
      </ScreenShell>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text style={styles.sheetTitle}>Add money to</Text>

        {accounts.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#888", padding: 20 }}>
            No accounts available. Create an account first.
          </Text>
        ) : (
          accounts.map((a) => {
            const walletDisabled = isWalletDisabled(a);

            return (
              <Pressable
                key={a.id}
                style={[styles.sheetRow, { opacity: walletDisabled ? 0.6 : 1 }]}
                onPress={() => {
                  if (walletDisabled) {
                    Alert.alert("Wallet Disabled", "This wallet has been disabled by an administrator.");
                    return;
                  }
                  setSheetOpen(false);
                  router.push("/addmoneymethods");
                }}
              >
                <View style={styles.sheetRowLeft}>
                  <Text style={styles.flag}>{getFlagForCurrency(a.currencyCode)}</Text>
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
