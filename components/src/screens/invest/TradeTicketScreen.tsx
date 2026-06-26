import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppText from "@/components/AppText";
import AppTextInput from "@/components/AppTextInput";
import BackButton from "@/components/BackButton";
import BrokerLogo from "@/components/BrokerLogo";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import {
  getSnapTradeAccounts, BrokerageAccount,
  searchSymbols, TradeSymbol,
  getQuotes, Quote,
  previewTrade, placeTrade, TradeAction, OrderType, TimeInForce,
  syncSnapTrade,
} from "@/api/investments";

type Step = "search" | "ticket";

// COLORS.green in this app's theme is actually the brand blue (#315CFD) —
// a deliberate branding choice elsewhere, but Buy/Sell needs to be
// genuinely color-coded here, not just on-brand. Using the real green
// (visible as a commented-out original value in theme/colors.tsx).
const REAL_GREEN = "#10B981";

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "market", label: "Market" },
  { value: "limit", label: "Limit" },
  { value: "stop", label: "Stop" },
  { value: "stop_limit", label: "Stop Limit" },
];

const TIME_IN_FORCE: { value: TimeInForce; label: string }[] = [
  { value: "Day", label: "Day" },
  { value: "GTC", label: "Until Cancelled" },
  { value: "FOK", label: "Fill or Kill" },
  { value: "IOC", label: "Immediate or Cancel" },
];

export default function TradeTicketScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BrokerageAccount | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TradeSymbol[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<TradeSymbol | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [action, setAction] = useState<TradeAction>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [timeInForce, setTimeInForce] = useState<TimeInForce>("Day");
  const [units, setUnits] = useState("");
  const [limitPrice, setLimitPrice] = useState("");

  const [previewing, setPreviewing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [impact, setImpact] = useState<any>(null);

  const searchTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const p = (await AsyncStorage.getItem("user_phone")) || "";
      setPhone(p);
      if (p) {
        try {
          const res = await getSnapTradeAccounts(p);
          const list = Array.isArray(res.accounts) ? res.accounts : [];
          setAccounts(list);
          if (list.length >= 1) setSelectedAccount(list[0]);
        } catch {}
      }
      setLoadingAccounts(false);
    })();
  }, []);

  const runSearch = useCallback((q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim() || !selectedAccount?.id || !phone) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchSymbols(phone, selectedAccount.id!, q.trim());
        setResults(res.success ? res.symbols : []);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 350);
  }, [phone, selectedAccount]);

  const handleSelectSymbol = useCallback(async (sym: TradeSymbol) => {
    setSelectedSymbol(sym);
    setStep("ticket");
    setUnits("");
    setLimitPrice("");
    setQuoteLoading(true);
    try {
      const res = await getQuotes(phone, selectedAccount!.id!, [sym.id]);
      setQuote(res.success && res.quotes[0] ? res.quotes[0] : null);
    } catch {
      setQuote(null);
    }
    setQuoteLoading(false);
  }, [phone, selectedAccount]);

  const needsLimitPrice = orderType === "limit" || orderType === "stop_limit";

  const handlePreview = useCallback(async () => {
    if (!selectedAccount?.id || !selectedSymbol) return;
    const unitsNum = parseFloat(units);
    if (!unitsNum || unitsNum <= 0) {
      Alert.alert("Enter quantity", "Please enter how many shares to trade.");
      return;
    }
    if (needsLimitPrice && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      Alert.alert("Enter a price", `Please enter a ${orderType === "stop_limit" ? "limit" : "stop"} price.`);
      return;
    }
    setPreviewing(true);
    try {
      const res = await previewTrade({
        phone,
        accountId: selectedAccount.id,
        action,
        orderType,
        timeInForce,
        universalSymbolId: selectedSymbol.id,
        units: unitsNum,
        price: needsLimitPrice ? parseFloat(limitPrice) : undefined,
      });
      if (res.success) {
        setTradeId(res.tradeId || null);
        setImpact(res.impact || null);
        setPreviewOpen(true);
      } else {
        Alert.alert("Couldn't preview this order", res.error?.message || "Please try again.");
      }
    } finally {
      setPreviewing(false);
    }
  }, [phone, selectedAccount, selectedSymbol, action, orderType, timeInForce, units, limitPrice, needsLimitPrice]);

  const handleConfirm = useCallback(async () => {
    if (!tradeId) return;
    setPlacing(true);
    try {
      const res = await placeTrade({ phone, tradeId });
      if (res.success) {
        syncSnapTrade(phone).catch(() => {});
        setPreviewOpen(false);
        router.replace({
          pathname: "/result" as any,
          params: {
            type: "success",
            title: "Order placed",
            message: `Your ${action === "BUY" ? "buy" : "sell"} order for ${units} share${parseFloat(units) === 1 ? "" : "s"} of ${selectedSymbol?.symbol} has been submitted.`,
            primaryText: "Done",
            primaryRoute: "/(tabs)/invest",
            secondaryText: "View pending orders",
            secondaryRoute: "/pendingorders",
          } as any,
        });
      } else {
        setPlacing(false);
        Alert.alert("Order failed", res.error?.message || "Please try again.");
      }
    } catch (e: any) {
      setPlacing(false);
      Alert.alert("Order failed", e?.message || "Please try again.");
    }
  }, [tradeId, phone, action, units, selectedSymbol, router]);

  const goBack = () => {
    if (step === "ticket") {
      setStep("search");
      setSelectedSymbol(null);
      setQuote(null);
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const sym = selectedSymbol;
  const lastPrice = quote?.last_trade_price ?? quote?.ask_price ?? quote?.bid_price;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={goBack} showLabel={false} />
        <AppText style={s.headerTitle}>{step === "search" ? "Trade" : sym?.symbol || "Trade"}</AppText>
        <View style={{ width: 34 }} />
      </View>

      {/* Account selector */}
      {!loadingAccounts && accounts.length > 0 && (
        <Pressable
          onPress={() => accounts.length > 1 && setAccountPickerOpen(true)}
          style={s.accountPill}
        >
          <BrokerLogo logoUrl={selectedAccount?.logoUrl} size={20} />
          <AppText style={s.accountPillText} numberOfLines={1}>
            {selectedAccount?.brokerageName} {selectedAccount?.accountNumberMasked}
          </AppText>
          {accounts.length > 1 && <Ionicons name="chevron-down" size={14} color={COLORS.muted} />}
        </Pressable>
      )}

      {loadingAccounts ? (
        <View style={s.centered}><ActivityIndicator size="small" color={COLORS.primary} /></View>
      ) : accounts.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="business-outline" size={28} color={COLORS.muted} style={{ marginBottom: 10 }} />
          <AppText style={s.emptyText}>Connect a brokerage account first to start trading.</AppText>
        </View>
      ) : step === "search" ? (
        <View style={s.body}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color={COLORS.muted} />
            <AppTextInput
              value={query}
              onChangeText={runSearch}
              placeholder="Search by symbol or company name"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={s.searchInput}
            />
            {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {results.length === 0 && !!query.trim() && !searching && (
              <AppText style={s.noResults}>No matching symbols found.</AppText>
            )}
            {results.map((r) => (
              <Pressable key={r.id} onPress={() => handleSelectSymbol(r)} style={s.resultRow}>
                <View style={s.resultSymbolBadge}>
                  <AppText style={s.resultSymbolText}>{r.symbol.slice(0, 4)}</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={s.resultSymbol}>{r.symbol}</AppText>
                  <AppText style={s.resultDescription} numberOfLines={1}>{r.description}</AppText>
                </View>
                <AppText style={s.resultExchange}>{r.exchange}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.quoteCard}>
              <View>
                <AppText style={s.quoteSymbol}>{sym?.symbol}</AppText>
                <AppText style={s.quoteDescription} numberOfLines={1}>{sym?.description}</AppText>
              </View>
              {quoteLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : lastPrice != null ? (
                <AppText style={s.quotePrice}>${Number(lastPrice).toFixed(2)}</AppText>
              ) : null}
            </View>

            <View style={s.actionToggle}>
              <Pressable
                onPress={() => setAction("BUY")}
                style={[s.actionToggleBtn, action === "BUY" && s.actionToggleBtnActiveBuy]}
              >
                <AppText style={[s.actionToggleText, action === "BUY" && s.actionToggleTextActive]}>Buy</AppText>
              </Pressable>
              <Pressable
                onPress={() => setAction("SELL")}
                style={[s.actionToggleBtn, action === "SELL" && s.actionToggleBtnActiveSell]}
              >
                <AppText style={[s.actionToggleText, action === "SELL" && s.actionToggleTextActive]}>Sell</AppText>
              </Pressable>
            </View>

            <AppText style={s.fieldLabel}>Order type</AppText>
            <View style={s.chipsRow}>
              {ORDER_TYPES.map((t) => (
                <Pressable key={t.value} onPress={() => setOrderType(t.value)} style={[s.chip, orderType === t.value && s.chipActive]}>
                  <AppText style={[s.chipText, orderType === t.value && s.chipTextActive]}>{t.label}</AppText>
                </Pressable>
              ))}
            </View>

            <AppText style={s.fieldLabel}>Time in force</AppText>
            <View style={s.chipsRow}>
              {TIME_IN_FORCE.map((t) => (
                <Pressable key={t.value} onPress={() => setTimeInForce(t.value)} style={[s.chip, timeInForce === t.value && s.chipActive]}>
                  <AppText style={[s.chipText, timeInForce === t.value && s.chipTextActive]}>{t.label}</AppText>
                </Pressable>
              ))}
            </View>

            <AppText style={s.fieldLabel}>Shares</AppText>
            <AppTextInput
              value={units}
              onChangeText={setUnits}
              placeholder="0"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              style={s.amountInput}
            />

            {needsLimitPrice && (
              <>
                <AppText style={s.fieldLabel}>{orderType === "stop_limit" ? "Limit price" : "Stop price"}</AppText>
                <AppTextInput
                  value={limitPrice}
                  onChangeText={setLimitPrice}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="decimal-pad"
                  style={s.amountInput}
                />
              </>
            )}

            <Pressable
              onPress={handlePreview}
              disabled={previewing}
              style={[s.previewBtn, action === "SELL" && s.previewBtnSell, previewing && { opacity: 0.6 }]}
            >
              {previewing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <AppText style={s.previewBtnText}>Review {action === "BUY" ? "Buy" : "Sell"} Order</AppText>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Account picker */}
      <Modal visible={accountPickerOpen} transparent animationType="fade" onRequestClose={() => setAccountPickerOpen(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setAccountPickerOpen(false)}>
          <View style={s.modalSheet}>
            <AppText style={s.modalTitle}>Trade from</AppText>
            {accounts.map((acc, i) => (
              <Pressable
                key={i}
                onPress={() => { setSelectedAccount(acc); setAccountPickerOpen(false); }}
                style={s.modalRow}
              >
                <BrokerLogo logoUrl={acc.logoUrl} size={32} />
                <View style={{ flex: 1 }}>
                  <AppText style={s.modalRowTitle}>{acc.brokerageName}</AppText>
                  <AppText style={s.modalRowSub}>{acc.accountNumberMasked}</AppText>
                </View>
                {selectedAccount?.id === acc.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Order preview / confirm */}
      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <AppText style={s.modalTitle}>Confirm order</AppText>

            <View style={s.previewSummary}>
              <AppText style={s.previewAction}>{action === "BUY" ? "Buy" : "Sell"} {units} {sym?.symbol}</AppText>
              <AppText style={s.previewSub}>
                {ORDER_TYPES.find((t) => t.value === orderType)?.label} · {TIME_IN_FORCE.find((t) => t.value === timeInForce)?.label}
              </AppText>
            </View>

            {!!impact?.estimated_commission && (
              <View style={s.previewRow}>
                <AppText style={s.previewRowLabel}>Estimated commission</AppText>
                <AppText style={s.previewRowValue}>${Number(impact.estimated_commission).toFixed(2)}</AppText>
              </View>
            )}
            {impact?.buying_power != null && (
              <View style={s.previewRow}>
                <AppText style={s.previewRowLabel}>Buying power after</AppText>
                <AppText style={s.previewRowValue}>${Number(impact.buying_power).toFixed(2)}</AppText>
              </View>
            )}

            <Pressable onPress={handleConfirm} disabled={placing} style={[s.confirmBtn, placing && { opacity: 0.6 }]}>
              {placing ? <ActivityIndicator color="#FFFFFF" /> : <AppText style={s.confirmBtnText}>Confirm Order</AppText>}
            </Pressable>
            <Pressable onPress={() => setPreviewOpen(false)} disabled={placing} style={s.cancelLink}>
              <AppText style={s.cancelLinkText}>Cancel</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },
  body: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge, flexGrow: 1 },

  accountPill: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, alignSelf: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, marginBottom: SPACE.md, ...GLASS_BORDER },
  accountPillText: { fontSize: 12, fontWeight: "700", color: COLORS.text, maxWidth: 200 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, height: 48, marginBottom: SPACE.lg, ...GLASS_BORDER },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  noResults: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center", marginTop: SPACE.xxl },
  resultRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md },
  resultSymbolBadge: { width: 38, height: 38, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  resultSymbolText: { fontSize: 10, fontWeight: "700", color: COLORS.primary },
  resultSymbol: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  resultDescription: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 1 },
  resultExchange: { fontSize: 11, color: COLORS.muted, fontWeight: "600" },

  quoteCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.lg, marginBottom: SPACE.xl, ...GLASS_BORDER },
  quoteSymbol: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  quoteDescription: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2, maxWidth: 180 },
  quotePrice: { fontSize: 20, fontWeight: "700", color: COLORS.text },

  actionToggle: { flexDirection: "row", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACE.xl, ...GLASS_BORDER },
  actionToggleBtn: { flex: 1, alignItems: "center", paddingVertical: SPACE.md, borderRadius: RADIUS.sm },
  actionToggleBtnActiveBuy: { backgroundColor: REAL_GREEN },
  actionToggleBtnActiveSell: { backgroundColor: COLORS.red },
  actionToggleText: { fontSize: 14, fontWeight: "700", color: COLORS.muted },
  actionToggleTextActive: { color: "#FFFFFF" },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: SPACE.sm, marginTop: SPACE.lg },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  chip: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.white, ...GLASS_BORDER },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  chipTextActive: { color: "#FFFFFF" },

  amountInput: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, height: 50, fontSize: 17, fontWeight: "700", color: COLORS.text, ...GLASS_BORDER },

  previewBtn: { backgroundColor: REAL_GREEN, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", marginTop: SPACE.xxl },
  previewBtnSell: { backgroundColor: COLORS.red },
  previewBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACE.xl, paddingBottom: SPACE.huge },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: SPACE.lg },
  modalRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md },
  modalRowTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  modalRowSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  previewSummary: { alignItems: "center", marginBottom: SPACE.lg },
  previewAction: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  previewSub: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 4 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SPACE.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
  previewRowLabel: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
  previewRowValue: { fontSize: 13, color: COLORS.text, fontWeight: "700" },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", marginTop: SPACE.xl },
  confirmBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  cancelLink: { alignItems: "center", paddingVertical: SPACE.md },
  cancelLinkText: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
});
