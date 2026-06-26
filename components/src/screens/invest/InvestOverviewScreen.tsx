import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, RefreshControl, Alert, Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppText from "@/components/AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { getCurrencySymbol } from "@/api/flutterwave";
import {
  getMySubscription,
  getSnapTradeAccounts,
  getSnapTradeHoldings,
  getSnapTradePortalUrl,
  getTradePortalUrl,
  syncSnapTrade,
  getPerformance,
  getBenchmark,
  getDividends,
  BrokerageAccount,
  PerformanceRange,
  PerformancePoint,
} from "@/api/investments";
import InvestPaywallScreen from "./InvestPaywallScreen";
import InvestInfoScreen, { hasAcknowledgedStockInfo } from "./InvestInfoScreen";
import BrokerLogo from "@/components/BrokerLogo";
import PerformanceChart from "@/components/PerformanceChart";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export default function InvestOverviewScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [totalValueInBase, setTotalValueInBase] = useState(0);
  const [totalValueInUsd, setTotalValueInUsd] = useState(0);
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);

  const [perfRange, setPerfRange] = useState<PerformanceRange>("1M");
  const [perfSeries, setPerfSeries] = useState<PerformancePoint[]>([]);
  const [perfChangeInBase, setPerfChangeInBase] = useState(0);
  const [perfChangePct, setPerfChangePct] = useState(0);
  const [perfLoading, setPerfLoading] = useState(false);
  // "You vs S&P 500" — a simple side-by-side comparison rather than
  // overlaying a second series on the existing chart, which would need a
  // larger rework of PerformanceChart itself to support two series safely.
  const [benchmarkChangePct, setBenchmarkChangePct] = useState<number | null>(null);

  const [dividendsTotal, setDividendsTotal] = useState(0);
  const [dividendsThisYear, setDividendsThisYear] = useState(0);
  // null = not yet checked. Gates whether the "how it works" info screen
  // shows before the paywall — only relevant pre-subscription, and only
  // needs to be shown once per user.
  const [infoAcknowledged, setInfoAcknowledged] = useState<boolean | null>(null);
  const [tradeTypeSheetOpen, setTradeTypeSheetOpen] = useState(false);

  const loadPerformance = useCallback(async (savedPhone: string, range: PerformanceRange) => {
    setPerfLoading(true);
    try {
      const res = await getPerformance(savedPhone, range);
      if (res.subscriptionRequired) {
        setIsSubscribed(false);
        setInfoAcknowledged(await hasAcknowledgedStockInfo(savedPhone));
        setPerfLoading(false);
        return;
      }
      setPerfSeries(res.series);
      setPerfChangeInBase(res.changeInBase);
      setPerfChangePct(res.changePct);
    } catch {}

    // Best-effort, separate from the main performance fetch above — a
    // benchmark hiccup shouldn't block the user's own performance chart
    // from showing.
    try {
      const benchRes = await getBenchmark("SPY", range);
      setBenchmarkChangePct(benchRes.success ? (benchRes.changePct ?? null) : null);
    } catch {
      setBenchmarkChangePct(null);
    }

    setPerfLoading(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const savedPhone = (await AsyncStorage.getItem("user_phone")) || "";
      setPhone(savedPhone);
      if (!savedPhone) { setLoading(false); return; }

      const sub = await getMySubscription(savedPhone);
      if (!sub.isActive) {
        setIsSubscribed(false);
        setInfoAcknowledged(await hasAcknowledgedStockInfo(savedPhone));
        setLoading(false);
        return;
      }
      setIsSubscribed(true);

      const [accountsRes, holdingsRes] = await Promise.all([
        getSnapTradeAccounts(savedPhone),
        getSnapTradeHoldings(savedPhone),
      ]);

      if (accountsRes.subscriptionRequired || holdingsRes.subscriptionRequired) {
        setIsSubscribed(false);
        setInfoAcknowledged(await hasAcknowledgedStockInfo(savedPhone));
        setLoading(false);
        return;
      }

      let finalAccounts = Array.isArray(accountsRes.accounts) ? accountsRes.accounts : [];
      // One-time backfill: accounts connected before the backend started
      // returning broker_logo_url will have logoUrl missing even though
      // BrokerLogo already knows how to render it — re-syncing repopulates
      // it server-side. Only fires when actually needed, not on every load.
      if (finalAccounts.length > 0 && finalAccounts.some((a) => !a.logoUrl)) {
        try {
          const syncRes = await syncSnapTrade(savedPhone);
          if (syncRes.success && Array.isArray(syncRes.accounts)) finalAccounts = syncRes.accounts;
        } catch {}
      }

      setAccounts(finalAccounts);
      setBaseCurrency(accountsRes.baseCurrency || holdingsRes.baseCurrency || "USD");
      setTotalValueInBase(holdingsRes.totalValueInBase || 0);
      setTotalValueInUsd(holdingsRes.totalValueInUsd || 0);

      const currentYear = new Date().getFullYear();
      const divRes = await getDividends(savedPhone);
      if (divRes.subscriptionRequired) {
        setIsSubscribed(false);
        setInfoAcknowledged(await hasAcknowledgedStockInfo(savedPhone));
        setLoading(false);
        return;
      }
      setDividendsTotal(divRes.totalInBase || 0);
      setDividendsThisYear(divRes.byYear?.[String(currentYear)] || 0);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  // Performance is fetched separately from load() so switching the chart's
  // range pill (1W/1M/3M/...) only re-fetches the chart — not accounts,
  // holdings, and dividends all over again.
  useEffect(() => {
    if (!phone) return;
    loadPerformance(phone, perfRange);
  }, [phone, perfRange, loadPerformance]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleConnectAnother = async () => {
    if (!phone) return;
    setConnecting(true);
    try {
      // Passing our own redirectUrl means SnapTrade's "Done" button has a
      // predictable, app-controlled URL to land on when the user finishes
      // connecting — without one, "Done" relies on whatever default
      // completion page SnapTrade falls back to, which this app has no
      // reliable way to recognize (only the portal's own internal
      // cancel/close action happened to match the existing checks, which
      // is why only that path appeared to "work").
      const res = await getSnapTradePortalUrl(phone, "https://exxsend.com/snaptrade/connected");
      setConnecting(false);
      if (res.success && res.redirectUri) {
        router.push({
          pathname: "/investconnectbroker" as any,
          params: { webViewUrl: res.redirectUri },
        } as any);
      } else if (res.subscriptionRequired) {
        router.replace("/investpaywall" as any);
      }
    } catch {
      setConnecting(false);
    }
  };

  // Same flow as above, but hits trade-portal-url instead of portal-url —
  // either connects a new brokerage with trading permissions directly, or
  // upgrades an existing read-only connection to trade-capable if the user
  // picks the same brokerage again in the portal.
  const handleConnectForTrading = async () => {
    if (!phone) return;
    setConnecting(true);
    try {
      const res = await getTradePortalUrl(phone, "https://exxsend.com/snaptrade/connected");
      setConnecting(false);
      if (res.success && res.redirectUri) {
        router.push({
          pathname: "/investconnectbroker" as any,
          params: { webViewUrl: res.redirectUri },
        } as any);
      } else if (res.subscriptionRequired) {
        router.replace("/investpaywall" as any);
      } else if (res.message) {
        Alert.alert("Couldn't connect for trading", res.message);
      }
    } catch {
      setConnecting(false);
    }
  };

  const sym = getCurrencySymbol(baseCurrency);

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isSubscribed === false) {
    if (infoAcknowledged === false) {
      return <InvestInfoScreen phone={phone} onAcknowledge={() => setInfoAcknowledged(true)} />;
    }
    if (infoAcknowledged === null) {
      return (
        <SafeAreaView style={s.root}>
          <View style={s.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </SafeAreaView>
      );
    }
    return <InvestPaywallScreen embedded onSubscribed={() => load()} />;
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={s.header}>
          <AppText style={s.headerTitle}>Stock</AppText>
          <Pressable onPress={() => router.push("/investsettings" as any)} style={s.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color={COLORS.text} />
          </Pressable>
        </View>

        <View style={s.totalLabelRow}>
          <AppText style={s.totalLabel}>Total Portfolio Value</AppText>
          <Pressable onPress={handleConnectAnother} disabled={connecting} style={s.connectBtnCompact}>
            {connecting ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={14} color={COLORS.primary} />
                <AppText style={s.connectBtnCompactText}>Connect broker</AppText>
              </>
            )}
          </Pressable>
        </View>
        <AppText style={s.totalAmount}>{sym}{totalValueInBase.toFixed(2)}</AppText>
        {baseCurrency !== "USD" && (
          <AppText style={s.totalUsd}>${totalValueInUsd.toFixed(2)} USD</AppText>
        )}

        <View style={s.quickActionsRow}>
          <Pressable onPress={() => setTradeTypeSheetOpen(true)} style={s.quickAction}>
            <View style={[s.quickActionIcon, { backgroundColor: COLORS.primary }]}>
              <Ionicons name="swap-vertical" size={18} color="#FFFFFF" />
            </View>
            <AppText style={s.quickActionLabel}>Trade</AppText>
          </Pressable>
          <Pressable onPress={() => router.push("/investholdings" as any)} style={s.quickAction}>
            <View style={s.quickActionIcon}>
              <Ionicons name="pie-chart-outline" size={18} color={COLORS.primary} />
            </View>
            <AppText style={s.quickActionLabel}>Holdings</AppText>
          </Pressable>
          <Pressable onPress={() => router.push("/pendingorders" as any)} style={s.quickAction}>
            <View style={s.quickActionIcon}>
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            </View>
            <AppText style={s.quickActionLabel}>Orders</AppText>
          </Pressable>
          <Pressable onPress={() => router.push("/investtransactions" as any)} style={s.quickAction}>
            <View style={s.quickActionIcon}>
              <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
            </View>
            <AppText style={s.quickActionLabel}>History</AppText>
          </Pressable>
        </View>

        {/* Performance chart */}
        <View style={s.chartCard}>
          <View style={s.chartHeaderRow}>
            <View>
              <AppText style={s.chartLabel}>Performance</AppText>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <Ionicons
                  name={perfChangeInBase >= 0 ? "caret-up" : "caret-down"}
                  size={13}
                  color={perfChangeInBase >= 0 ? COLORS.green : COLORS.red}
                />
                <AppText style={[s.chartChange, { color: perfChangeInBase >= 0 ? COLORS.green : COLORS.red }]}>
                  {sym}{Math.abs(perfChangeInBase).toFixed(2)} ({Math.abs(perfChangePct).toFixed(2)}%)
                </AppText>
              </View>
            </View>
            {perfLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>

          <View style={{ marginTop: SPACE.lg }}>
            <PerformanceChart series={perfSeries} height={120} />
          </View>

          {benchmarkChangePct != null && (
            <View style={s.benchmarkRow}>
              <AppText style={s.benchmarkText}>
                S&amp;P 500 over this period: <AppText style={{ fontWeight: "700", color: benchmarkChangePct >= 0 ? COLORS.green : COLORS.red }}>
                  {benchmarkChangePct >= 0 ? "+" : ""}{benchmarkChangePct.toFixed(2)}%
                </AppText>
              </AppText>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACE.lg }}>
            <View style={{ flexDirection: "row", gap: SPACE.xs }}>
              {(["1W", "1M", "3M", "6M", "1Y", "2Y", "5Y", "ALL"] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setPerfRange(r)}
                  style={[s.rangePill, perfRange === r && s.rangePillActive]}
                >
                  <AppText style={[s.rangePillText, perfRange === r && s.rangePillTextActive]}>{r}</AppText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Dividends */}
        <Pressable onPress={() => router.push("/investtaxreport" as any)} style={s.dividendCard}>
          <View style={s.dividendIconWrap}>
            <Ionicons name="cash-outline" size={20} color={COLORS.green} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={s.dividendLabel}>Dividends earned</AppText>
            <AppText style={s.dividendAmount}>{sym}{dividendsTotal.toFixed(2)} total</AppText>
            <AppText style={s.dividendSub}>{sym}{dividendsThisYear.toFixed(2)} this year</AppText>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <AppText style={s.taxLink}>Tax Report</AppText>
            <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
          </View>
        </Pressable>

        <View style={s.sectionRow}>
          <AppText style={s.sectionTitle}>Connected Brokers</AppText>
        </View>

        {!Array.isArray(accounts) || accounts.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="business-outline" size={28} color={COLORS.muted} />
            <AppText style={s.emptyText}>No brokerage accounts connected yet.</AppText>
          </View>
        ) : (
          accounts.map((acc, i) => (
            <View key={i} style={s.accountCard}>
              <View style={s.accountTop}>
                <BrokerLogo logoUrl={acc.logoUrl} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText style={s.brokerName}>{acc.brokerageName}</AppText>
                  <AppText style={s.accountNumber}>{acc.accountNumberMasked}</AppText>
                </View>
              </View>
              <View style={s.accountBalanceRow}>
                <View>
                  <AppText style={s.balanceBig}>{sym}{(acc.balanceInBase ?? 0).toFixed(2)}</AppText>
                  {acc.currency !== baseCurrency && (
                    <AppText style={s.balanceNative}>
                      {getCurrencySymbol(acc.currency)}{acc.balance.toFixed(2)} {acc.currency}
                    </AppText>
                  )}
                </View>
                <AppText style={s.lastSync}>Synced {timeAgo(acc.lastSyncedAt)}</AppText>
              </View>
            </View>
          ))
        )}

        <Pressable onPress={handleConnectForTrading} disabled={connecting} style={s.tradeConnectBtn}>
          <Ionicons name="swap-vertical" size={16} color={COLORS.muted} />
          <AppText style={s.tradeConnectBtnText}>Enable trading on a connected account</AppText>
        </Pressable>
      </ScrollView>

      <Modal visible={tradeTypeSheetOpen} transparent animationType="fade" onRequestClose={() => setTradeTypeSheetOpen(false)}>
        <Pressable style={s.tradeSheetOverlay} onPress={() => setTradeTypeSheetOpen(false)}>
          <View style={s.tradeSheet}>
            <AppText style={s.tradeSheetTitle}>What do you want to trade?</AppText>
            <Pressable
              onPress={() => { setTradeTypeSheetOpen(false); router.push("/tradeticket" as any); }}
              style={s.tradeSheetRow}
            >
              <View style={[s.tradeSheetIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name="trending-up-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.tradeSheetRowTitle}>Stocks</AppText>
                <AppText style={s.tradeSheetRowSub}>Buy or sell shares</AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </Pressable>
            <Pressable
              onPress={() => { setTradeTypeSheetOpen(false); router.push("/cryptotrade" as any); }}
              style={s.tradeSheetRow}
            >
              <View style={[s.tradeSheetIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="logo-bitcoin" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.tradeSheetRowTitle}>Crypto</AppText>
                <AppText style={s.tradeSheetRowSub}>Buy or sell cryptocurrency pairs</AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </Pressable>
            <Pressable
              onPress={() => { setTradeTypeSheetOpen(false); router.push("/optionstrade" as any); }}
              style={s.tradeSheetRow}
            >
              <View style={[s.tradeSheetIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="layers-outline" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.tradeSheetRowTitle}>Options</AppText>
                <AppText style={s.tradeSheetRowSub}>Multi-leg options orders</AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.md, paddingBottom: SPACE.huge },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg },
  headerTitle: { fontSize: 22, fontWeight: "700", color: COLORS.text },
  settingsBtn: { width: 38, height: 38, borderRadius: RADIUS.full, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...GLASS_BORDER, ...CARD_SHADOW },
  totalLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: SPACE.xs },
  totalLabel: { fontSize: 13, fontWeight: "600", color: COLORS.muted },
  connectBtnCompact: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: SPACE.sm + 2, paddingVertical: 5 },
  connectBtnCompactText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  totalAmount: { fontSize: 38, fontWeight: "700", color: COLORS.text, marginTop: 4, letterSpacing: -1 },
  totalUsd: { fontSize: 13, fontWeight: "600", color: COLORS.muted, marginTop: 2 },
  quickActionsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.xxl },
  quickAction: { alignItems: "center", gap: SPACE.sm, width: 70 },
  quickActionIcon: { width: 46, height: 46, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  quickActionLabel: { fontSize: 11, fontWeight: "700", color: COLORS.text },

  chartCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.lg, marginTop: SPACE.lg, ...GLASS_BORDER, ...CARD_SHADOW },
  chartHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  chartLabel: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  chartChange: { fontSize: 14, fontWeight: "700" },
  rangePill: { paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.bg },
  rangePillActive: { backgroundColor: COLORS.primary },
  rangePillText: { fontSize: 12, fontWeight: "700", color: COLORS.muted },
  rangePillTextActive: { color: COLORS.white },
  benchmarkRow: { marginTop: SPACE.md },
  benchmarkText: { fontSize: 12, color: COLORS.muted, fontWeight: "500" },

  dividendCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.lg, marginTop: SPACE.lg, ...GLASS_BORDER, ...CARD_SHADOW },
  dividendIconWrap: { width: 42, height: 42, borderRadius: RADIUS.full, backgroundColor: COLORS.greenSoft, alignItems: "center", justifyContent: "center", marginRight: SPACE.md },
  dividendLabel: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  dividendAmount: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 2 },
  dividendSub: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 1 },
  taxLink: { fontSize: 12, fontWeight: "700", color: COLORS.primary, marginBottom: 2 },

  sectionRow: { marginTop: SPACE.xxl, marginBottom: SPACE.md },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xxxl, alignItems: "center", gap: SPACE.md, ...GLASS_BORDER, ...CARD_SHADOW },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },
  accountCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.md, ...GLASS_BORDER, ...CARD_SHADOW },
  accountTop: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.md },
  brokerName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  accountNumber: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  accountBalanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  balanceBig: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  balanceNative: { fontSize: 11, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  lastSync: { fontSize: 11, color: COLORS.muted, fontWeight: "500" },
  tradeConnectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs, paddingVertical: SPACE.lg },
  tradeConnectBtnText: { fontSize: 12, fontWeight: "600", color: COLORS.muted },
  tradeSheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  tradeSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACE.xl, paddingBottom: SPACE.huge },
  tradeSheetTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: SPACE.lg },
  tradeSheetRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md },
  tradeSheetIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  tradeSheetRowTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  tradeSheetRowSub: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
});
