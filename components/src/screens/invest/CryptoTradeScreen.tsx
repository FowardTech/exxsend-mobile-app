import {
  BrokerageAccount,
  CryptoOrderType,
  CryptoSide,
  CryptoTimeInForce,
  getSnapTradeAccounts,
  placeCryptoTrade,
  previewCryptoTrade,
  syncSnapTrade,
} from "@/api/investments";
import AppText from "@/components/AppText";
import AppTextInput from "@/components/AppTextInput";
import BackButton from "@/components/BackButton";
import BrokerLogo from "@/components/BrokerLogo";
import { COLORS } from "@/theme/colors";
import { GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Crypto pair quick-select chips.

const COMMON_PAIRS = ["BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD"];

const ORDER_TYPES: { value: CryptoOrderType; label: string }[] = [
  { value: "MARKET", label: "Market" },
  { value: "LIMIT", label: "Limit" },
  { value: "STOP_LOSS_MARKET", label: "Stop Loss" },
  { value: "STOP_LOSS_LIMIT", label: "Stop Limit" },
  { value: "TAKE_PROFIT_MARKET", label: "Take Profit" },
  { value: "TAKE_PROFIT_LIMIT", label: "Take Profit Limit" },
];

const TIME_IN_FORCE: { value: CryptoTimeInForce; label: string }[] = [
  { value: "GTC", label: "Until Cancelled" },
  { value: "FOK", label: "Fill or Kill" },
  { value: "IOC", label: "Immediate or Cancel" },
  { value: "GTD", label: "Good Till Date" },
];

export default function CryptoTradeScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BrokerageAccount | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [pair, setPair] = useState("BTC-USD");
  const [side, setSide] = useState<CryptoSide>("BUY");
  const [orderType, setOrderType] = useState<CryptoOrderType>("MARKET");
  const [timeInForce, setTimeInForce] = useState<CryptoTimeInForce>("GTC");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [postOnly, setPostOnly] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");

  const [previewing, setPreviewing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

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
        } catch { }
      }
      setLoadingAccounts(false);
    })();
  }, []);

  const needsLimitPrice = orderType === "LIMIT" || orderType === "STOP_LOSS_LIMIT" || orderType === "TAKE_PROFIT_LIMIT";
  const needsStopPrice = orderType === "STOP_LOSS_MARKET" || orderType === "STOP_LOSS_LIMIT" || orderType === "TAKE_PROFIT_MARKET" || orderType === "TAKE_PROFIT_LIMIT";

  const buildBody = useCallback(() => ({
    phone,
    accountId: selectedAccount?.id || "",
    instrument: { symbol: pair.trim().toUpperCase(), type: "CRYPTOCURRENCY_PAIR" as const },
    side,
    type: orderType,
    timeInForce,
    amount: amount.trim(),
    limitPrice: needsLimitPrice ? limitPrice.trim() : null,
    stopPrice: needsStopPrice ? stopPrice.trim() : null,
    postOnly,
    expirationDate: timeInForce === "GTD" ? expirationDate.trim() : null,
  }), [phone, selectedAccount, pair, side, orderType, timeInForce, amount, limitPrice, stopPrice, postOnly, expirationDate, needsLimitPrice, needsStopPrice]);

  const handlePreview = async () => {
    if (!selectedAccount?.id) return;
    if (!pair.trim()) { Alert.alert("Enter a pair", "Please enter a crypto pair, e.g. BTC-USD."); return; }
    if (!amount.trim() || parseFloat(amount) <= 0) { Alert.alert("Enter amount", "Please enter how much to trade."); return; }
    if (needsLimitPrice && !limitPrice.trim()) { Alert.alert("Enter a limit price", "This order type needs a limit price."); return; }
    if (needsStopPrice && !stopPrice.trim()) { Alert.alert("Enter a stop price", "This order type needs a stop price."); return; }
    if (timeInForce === "GTD" && !expirationDate.trim()) { Alert.alert("Enter an expiration date", "Good-Till-Date orders need an expiration date (e.g. 2026-12-31T00:00:00Z)."); return; }

    setPreviewing(true);
    try {
      const res = await previewCryptoTrade(buildBody());
      if (res.success) {
        setPreviewData(res.preview || {});
        setPreviewOpen(true);
      } else {
        Alert.alert("Couldn't preview this order", res.error?.message || "Please try again.");
      }
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirm = async () => {
    setPlacing(true);
    try {
      const res = await placeCryptoTrade(buildBody());
      if (res.success) {
        syncSnapTrade(phone).catch(() => { });
        setPreviewOpen(false);
        router.replace({
          pathname: "/result" as any,
          params: {
            type: "success",
            title: "Order placed",
            message: `Your ${side === "BUY" ? "buy" : "sell"} order for ${amount} ${pair.toUpperCase()} has been submitted.`,
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
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <AppText style={s.headerTitle}>Crypto Trade</AppText>
        <View style={{ width: 34 }} />
      </View>

      {!loadingAccounts && accounts.length > 0 && (
        <Pressable onPress={() => accounts.length > 1 && setAccountPickerOpen(true)} style={s.accountPill}>
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
          <AppText style={s.emptyText}>Connect a brokerage account first to trade crypto.</AppText>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <AppText style={s.fieldLabel}>Pair</AppText>
            <AppTextInput
              value={pair}
              onChangeText={setPair}
              placeholder="BTC-USD"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={s.pairInput}
            />
            <View style={s.chipsRow}>
              {COMMON_PAIRS.map((p) => (
                <Pressable key={p} onPress={() => setPair(p)} style={[s.chip, pair === p && s.chipActive]}>
                  <AppText style={[s.chipText, pair === p && s.chipTextActive]}>{p}</AppText>
                </Pressable>
              ))}
            </View>

            <View style={s.actionToggle}>
              <Pressable onPress={() => setSide("BUY")} style={[s.actionToggleBtn, side === "BUY" && s.actionToggleBtnActiveBuy]}>
                <AppText style={[s.actionToggleText, side === "BUY" && s.actionToggleTextActiveBuy]}>Buy</AppText>
              </Pressable>
              <Pressable onPress={() => setSide("SELL")} style={[s.actionToggleBtn, side === "SELL" && s.actionToggleBtnActiveSell]}>
                <AppText style={[s.actionToggleText, side === "SELL" && s.actionToggleTextActiveSell]}>Sell</AppText>
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

            {timeInForce === "GTD" && (
              <>
                <AppText style={s.fieldLabel}>Expiration date</AppText>
                <AppTextInput
                  value={expirationDate}
                  onChangeText={setExpirationDate}
                  placeholder="2026-12-31T00:00:00Z"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  style={s.pairInput}
                />
              </>
            )}

            <AppText style={s.fieldLabel}>Amount</AppText>
            <AppTextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.005"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              style={s.amountInput}
            />

            {needsLimitPrice && (
              <>
                <AppText style={s.fieldLabel}>Limit price</AppText>
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

            {needsStopPrice && (
              <>
                <AppText style={s.fieldLabel}>Stop price</AppText>
                <AppTextInput
                  value={stopPrice}
                  onChangeText={setStopPrice}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="decimal-pad"
                  style={s.amountInput}
                />
              </>
            )}

            {needsLimitPrice && (
              <Pressable onPress={() => setPostOnly((v) => !v)} style={s.postOnlyRow}>
                <View style={[s.checkbox, postOnly && s.checkboxOn]}>
                  {postOnly && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <AppText style={s.postOnlyText}>Post-only (don't take liquidity)</AppText>
              </Pressable>
            )}

            <Pressable
              onPress={handlePreview}
              disabled={previewing}
              style={[s.previewBtn, previewing && { opacity: 0.6 }]}
            >
              {previewing ? <ActivityIndicator color="#FFFFFF" /> : <AppText style={s.previewBtnText}>Review {side === "BUY" ? "Buy" : "Sell"} Order</AppText>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={accountPickerOpen} transparent animationType="fade" onRequestClose={() => setAccountPickerOpen(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setAccountPickerOpen(false)}>
          <View style={s.modalSheet}>
            <AppText style={s.modalTitle}>Trade from</AppText>
            {accounts.map((acc, i) => (
              <Pressable key={i} onPress={() => { setSelectedAccount(acc); setAccountPickerOpen(false); }} style={s.modalRow}>
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

      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <AppText style={s.modalTitle}>Confirm order</AppText>
            <View style={s.previewSummary}>
              <AppText style={s.previewAction}>{side === "BUY" ? "Buy" : "Sell"} {amount} {pair.toUpperCase()}</AppText>
              <AppText style={s.previewSub}>
                {ORDER_TYPES.find((t) => t.value === orderType)?.label} · {TIME_IN_FORCE.find((t) => t.value === timeInForce)?.label}
              </AppText>
            </View>
            {!!previewData?.estimated_fees && (
              <View style={s.previewRow}>
                <AppText style={s.previewRowLabel}>Estimated fees</AppText>
                <AppText style={s.previewRowValue}>${Number(previewData.estimated_fees).toFixed(2)}</AppText>
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },
  body: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },

  accountPill: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, alignSelf: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, marginBottom: SPACE.md, ...GLASS_BORDER },
  accountPillText: { fontSize: 12, fontWeight: "600", color: COLORS.text, maxWidth: 200 },

  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: SPACE.sm, marginTop: SPACE.lg },
  pairInput: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, height: 50, fontSize: 15, fontWeight: "600", color: COLORS.text, ...GLASS_BORDER },
  amountInput: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, height: 50, fontSize: 17, fontWeight: "600", color: COLORS.text, ...GLASS_BORDER },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginTop: SPACE.sm },
  chip: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.white, ...GLASS_BORDER },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  chipTextActive: { color: "#FFFFFF" },

  actionToggle: { flexDirection: "row", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 4, marginTop: SPACE.xl, ...GLASS_BORDER },
  actionToggleBtn: { flex: 1, alignItems: "center", paddingVertical: SPACE.md, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: "transparent" },
  actionToggleBtnActiveBuy: { backgroundColor: "transparent", borderColor: COLORS.primary },
  actionToggleBtnActiveSell: { backgroundColor: COLORS.borderLight, borderColor: COLORS.border },
  actionToggleText: { fontSize: 14, fontWeight: "600", color: COLORS.muted },
  actionToggleTextActiveBuy: { color: COLORS.primary },
  actionToggleTextActiveSell: { color: COLORS.text },

  postOnlyRow: { flexDirection: "row", alignItems: "center", marginTop: SPACE.lg, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  postOnlyText: { fontSize: 13, color: COLORS.muted, fontWeight: "500" },

  previewBtn: { backgroundColor: COLORS.primaryDark, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", marginTop: SPACE.xxl },
  previewBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACE.xl, paddingBottom: SPACE.huge },
  modalTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text, marginBottom: SPACE.lg },
  modalRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md },
  modalRowTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  modalRowSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  previewSummary: { alignItems: "center", marginBottom: SPACE.lg },
  previewAction: { fontSize: 18, fontWeight: "600", color: COLORS.text },
  previewSub: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 4 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SPACE.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
  previewRowLabel: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
  previewRowValue: { fontSize: 13, color: COLORS.text, fontWeight: "600" },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", marginTop: SPACE.xl },
  confirmBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  cancelLink: { alignItems: "center", paddingVertical: SPACE.md },
  cancelLinkText: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
});
