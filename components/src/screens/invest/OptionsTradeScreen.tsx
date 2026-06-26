import React, { useEffect, useState } from "react";
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
import { getSnapTradeAccounts, BrokerageAccount, placeOptionsOrder, OptionLeg, OptionLegAction, syncSnapTrade } from "@/api/investments";

const LEG_ACTIONS: { value: OptionLegAction; label: string }[] = [
  { value: "BUY_TO_OPEN", label: "Buy to Open" },
  { value: "SELL_TO_OPEN", label: "Sell to Open" },
  { value: "BUY_TO_CLOSE", label: "Buy to Close" },
  { value: "SELL_TO_CLOSE", label: "Sell to Close" },
];

const ORDER_TYPES = [
  { value: "MARKET" as const, label: "Market" },
  { value: "LIMIT" as const, label: "Limit" },
  { value: "STOP_LOSS_MARKET" as const, label: "Stop Loss" },
  { value: "STOP_LOSS_LIMIT" as const, label: "Stop Limit" },
];

const TIME_IN_FORCE = [
  { value: "Day" as const, label: "Day" },
  { value: "GTC" as const, label: "Until Cancelled" },
  { value: "FOK" as const, label: "Fill or Kill" },
  { value: "IOC" as const, label: "Immediate or Cancel" },
];

const PRICE_EFFECTS = [
  { value: "DEBIT" as const, label: "Debit" },
  { value: "CREDIT" as const, label: "Credit" },
  { value: "EVEN" as const, label: "Even" },
];

interface LegDraft {
  symbol: string;
  action: OptionLegAction;
  units: string;
}

export default function OptionsTradeScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BrokerageAccount | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT" | "STOP_LOSS_MARKET" | "STOP_LOSS_LIMIT">("LIMIT");
  const [timeInForce, setTimeInForce] = useState<"Day" | "GTC" | "FOK" | "IOC">("Day");
  const [priceEffect, setPriceEffect] = useState<"CREDIT" | "DEBIT" | "EVEN">("DEBIT");
  const [limitPrice, setLimitPrice] = useState("");
  const [legs, setLegs] = useState<LegDraft[]>([{ symbol: "", action: "BUY_TO_OPEN", units: "1" }]);
  const [submitting, setSubmitting] = useState(false);

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

  const updateLeg = (index: number, patch: Partial<LegDraft>) => {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLeg = () => setLegs((prev) => [...prev, { symbol: "", action: "BUY_TO_OPEN", units: "1" }]);
  const removeLeg = (index: number) => setLegs((prev) => prev.filter((_, i) => i !== index));

  const needsLimitPrice = orderType === "LIMIT" || orderType === "STOP_LOSS_LIMIT";

  const handleSubmit = async () => {
    if (!selectedAccount?.id) return;
    if (legs.some((l) => !l.symbol.trim())) {
      Alert.alert("Missing contract", "Please enter the option contract symbol for every leg.");
      return;
    }
    if (legs.some((l) => !l.units || parseFloat(l.units) <= 0)) {
      Alert.alert("Missing quantity", "Please enter a quantity for every leg.");
      return;
    }
    if (needsLimitPrice && !limitPrice.trim()) {
      Alert.alert("Enter a limit price", "This order type needs a limit price.");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        phone,
        accountId: selectedAccount.id,
        orderType,
        timeInForce,
        limitPrice: needsLimitPrice ? limitPrice.trim() : undefined,
        priceEffect,
        legs: legs.map<OptionLeg>((l) => ({
          instrument: { symbol: l.symbol.trim(), instrument_type: "OPTION" as const },
          action: l.action,
          units: parseFloat(l.units),
        })),
      };
      const res = await placeOptionsOrder(body);
      if (res.success) {
        syncSnapTrade(phone).catch(() => {});
        router.replace({
          pathname: "/result" as any,
          params: {
            type: "success",
            title: "Order placed",
            message: `Your ${legs.length > 1 ? `${legs.length}-leg` : ""} options order has been submitted.`,
            primaryText: "Done",
            primaryRoute: "/(tabs)/invest",
            secondaryText: "View pending orders",
            secondaryRoute: "/pendingorders",
          } as any,
        });
      } else {
        // Brokerage support for multi-leg options is genuinely limited —
        // surface this as an expected, friendly outcome rather than a
        // generic failure, per the spec's explicit guidance.
        Alert.alert("Order not accepted", res.error?.message || "This options strategy isn't supported by your connected brokerage.");
      }
    } catch (e: any) {
      Alert.alert("Order failed", e?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <AppText style={s.headerTitle}>Options Order</AppText>
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
          <AppText style={s.emptyText}>Connect a brokerage account first to trade options.</AppText>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.noticeBox}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
              <AppText style={s.noticeText}>
                Enter each contract's exact symbol (e.g. "AAPL  250718C00200000"). There's no contract browser here yet —
                check your brokerage's own app for available strikes/expiries first.
              </AppText>
            </View>

            <AppText style={s.fieldLabel}>Legs</AppText>
            {legs.map((leg, i) => (
              <View key={i} style={s.legCard}>
                <View style={s.legHeader}>
                  <AppText style={s.legHeaderText}>Leg {i + 1}</AppText>
                  {legs.length > 1 && (
                    <Pressable onPress={() => removeLeg(i)}>
                      <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                    </Pressable>
                  )}
                </View>
                <AppTextInput
                  value={leg.symbol}
                  onChangeText={(t) => updateLeg(i, { symbol: t })}
                  placeholder="Contract symbol"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="characters"
                  style={s.legInput}
                />
                <View style={s.chipsRow}>
                  {LEG_ACTIONS.map((a) => (
                    <Pressable key={a.value} onPress={() => updateLeg(i, { action: a.value })} style={[s.chip, leg.action === a.value && s.chipActive]}>
                      <AppText style={[s.chipText, leg.action === a.value && s.chipTextActive]}>{a.label}</AppText>
                    </Pressable>
                  ))}
                </View>
                <AppTextInput
                  value={leg.units}
                  onChangeText={(t) => updateLeg(i, { units: t })}
                  placeholder="Contracts"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="decimal-pad"
                  style={[s.legInput, { marginTop: SPACE.sm }]}
                />
              </View>
            ))}

            <Pressable onPress={addLeg} style={s.addLegBtn}>
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <AppText style={s.addLegBtnText}>Add another leg</AppText>
            </Pressable>

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

            <AppText style={s.fieldLabel}>Price effect</AppText>
            <View style={s.chipsRow}>
              {PRICE_EFFECTS.map((t) => (
                <Pressable key={t.value} onPress={() => setPriceEffect(t.value)} style={[s.chip, priceEffect === t.value && s.chipActive]}>
                  <AppText style={[s.chipText, priceEffect === t.value && s.chipTextActive]}>{t.label}</AppText>
                </Pressable>
              ))}
            </View>

            {needsLimitPrice && (
              <>
                <AppText style={s.fieldLabel}>Limit price</AppText>
                <AppTextInput
                  value={limitPrice}
                  onChangeText={setLimitPrice}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="decimal-pad"
                  style={s.legInput}
                />
              </>
            )}

            <Pressable onPress={handleSubmit} disabled={submitting} style={[s.submitBtn, submitting && { opacity: 0.6 }]}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <AppText style={s.submitBtnText}>Submit Order</AppText>}
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },
  body: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },

  accountPill: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, alignSelf: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, marginBottom: SPACE.md, ...GLASS_BORDER },
  accountPillText: { fontSize: 12, fontWeight: "700", color: COLORS.text, maxWidth: 200 },

  noticeBox: { flexDirection: "row", backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.md },
  noticeText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: "500", lineHeight: 17 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: SPACE.sm, marginTop: SPACE.lg },

  legCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.md, ...GLASS_BORDER },
  legHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.sm },
  legHeaderText: { fontSize: 12, fontWeight: "700", color: COLORS.muted },
  legInput: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, height: 44, fontSize: 14, fontWeight: "600", color: COLORS.text },

  addLegBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: SPACE.md, marginBottom: SPACE.md },
  addLegBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  chip: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.white, ...GLASS_BORDER },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  chipTextActive: { color: "#FFFFFF" },

  submitBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", marginTop: SPACE.xxl },
  submitBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACE.xl, paddingBottom: SPACE.huge },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: SPACE.lg },
  modalRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md },
  modalRowTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  modalRowSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
});
