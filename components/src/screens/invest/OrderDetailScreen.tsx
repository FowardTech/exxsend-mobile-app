import React, { useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, Alert, Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import AppText from "@/components/AppText";
import AppTextInput from "@/components/AppTextInput";
import BackButton from "@/components/BackButton";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, GLASS_BORDER, CARD_SHADOW, SCREEN_PADDING } from "@/theme/designSystem";
import { BrokerageOrder, cancelOrder, replaceOrder, syncSnapTrade, TradeAction, TimeInForce } from "@/api/investments";

// COLORS.green in this app's theme is actually the brand blue — Buy/Sell
// needs a genuinely green/red color pair to be immediately readable at a
// glance, same pattern used throughout the other stock screens.
const REAL_GREEN = "#10B981";

function statusColor(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("fill") || s.includes("complet") || s.includes("execut")) return REAL_GREEN;
  if (s.includes("cancel") || s.includes("reject") || s.includes("expir") || s.includes("fail")) return COLORS.red;
  if (s.includes("partial")) return "#D97706";
  return COLORS.primary;
}

function statusDescription(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("partial")) return "Part of this order has been filled — the rest is still open in the market.";
  if (s.includes("fill") || s.includes("complet") || s.includes("execut")) return "This order has been fully filled.";
  if (s.includes("cancel")) return "This order was cancelled before it could be filled.";
  if (s.includes("reject")) return "This order was rejected by your brokerage.";
  if (s.includes("expir")) return "This order expired before it could be filled.";
  if (s.includes("pending") || s.includes("open") || s.includes("queued") || s.includes("accept")) return "This order is live and waiting to be filled.";
  return "";
}

function formatFullDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ order?: string; accountId?: string; phone?: string }>();
  const order: BrokerageOrder | null = (() => {
    try { return params.order ? JSON.parse(params.order) : null; } catch { return null; }
  })();

  const [cancelling, setCancelling] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyUnits, setModifyUnits] = useState(order ? String(order.open_quantity ?? order.quantity ?? "") : "");
  const [modifyPrice, setModifyPrice] = useState(order?.price != null ? String(order.price) : "");
  const [modifyStop, setModifyStop] = useState((order as any)?.stop_price != null ? String((order as any).stop_price) : "");
  const [modifying, setModifying] = useState(false);

  if (!order) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <BackButton onPress={() => router.back()} showLabel={false} />
          <AppText style={s.headerTitle}>Order Details</AppText>
          <View style={{ width: 34 }} />
        </View>
        <View style={s.centered}>
          <AppText style={s.emptyText}>Couldn't load this order's details.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const isBuy = (order.action || "").toUpperCase() === "BUY";
  const actionColor = isBuy ? REAL_GREEN : COLORS.red;
  const isOpenOrder = !["filled", "executed", "completed", "cancelled", "rejected", "expired"].some((s) =>
    (order.status || "").toLowerCase().includes(s)
  );

  const filled = order.filled_quantity ?? 0;
  const remaining = order.open_quantity ?? Math.max((order.quantity || 0) - filled, 0);
  const totalValue = order.price != null ? order.price * (order.quantity || 0) : null;
  const orderTypeLabel = (order as any).order_type || (order as any).orderType || (order.price != null ? "Limit" : "Market");

  const handleCopyId = async () => {
    await Clipboard.setStringAsync(order.brokerage_order_id);
    Alert.alert("Copied", "Order ID copied to clipboard.");
  };

  const handleCancel = () => {
    Alert.alert("Cancel order", `Cancel your ${order.action} order for ${order.symbol}?`, [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: async () => {
          if (!params.phone || !params.accountId) return;
          setCancelling(true);
          try {
            const res = await cancelOrder(params.phone, params.accountId, order.brokerage_order_id);
            if (res.success) {
              syncSnapTrade(params.phone).catch(() => {});
              router.back();
            } else {
              Alert.alert("Couldn't cancel", res.error?.message || "Please try again.");
            }
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleSubmitModify = async () => {
    if (!params.phone || !params.accountId) return;
    const unitsNum = parseFloat(modifyUnits);
    if (!unitsNum || unitsNum <= 0) {
      Alert.alert("Enter quantity", "Please enter how many shares this order should be for.");
      return;
    }
    setModifying(true);
    try {
      const res = await replaceOrder({
        phone: params.phone,
        accountId: params.accountId,
        brokerageOrderId: order.brokerage_order_id,
        action: (order.action as TradeAction) || "BUY",
        orderType: orderTypeLabel,
        timeInForce: (order.time_in_force as TimeInForce) || "Day",
        units: unitsNum,
        price: modifyPrice ? parseFloat(modifyPrice) : undefined,
        stop: modifyStop ? parseFloat(modifyStop) : null,
        symbol: order.symbol,
      });
      if (res.success) {
        syncSnapTrade(params.phone).catch(() => {});
        setModifyOpen(false);
        router.back();
      } else {
        Alert.alert("Couldn't modify order", res.error?.message || "Please try again.");
      }
    } finally {
      setModifying(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <AppText style={s.headerTitle}>Order Details</AppText>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* ── Hero: action + symbol, color-coded ── */}
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: `${actionColor}1A` }]}>
            <Ionicons name={isBuy ? "arrow-down-circle" : "arrow-up-circle"} size={32} color={actionColor} />
          </View>
          <AppText style={[s.heroAction, { color: actionColor }]}>{isBuy ? "Buy" : "Sell"}</AppText>
          <AppText style={s.heroSymbol}>{order.symbol}</AppText>
          <View style={[s.statusPill, { backgroundColor: `${statusColor(order.status)}1A` }]}>
            <View style={[s.statusDot, { backgroundColor: statusColor(order.status) }]} />
            <AppText style={[s.statusPillText, { color: statusColor(order.status) }]}>{order.status}</AppText>
          </View>
          {!!statusDescription(order.status) && (
            <AppText style={s.statusDescription}>{statusDescription(order.status)}</AppText>
          )}
        </View>

        {/* ── Quantity & fill progress ── */}
        <View style={s.card}>
          <AppText style={s.cardTitle}>Quantity</AppText>
          <View style={s.row}>
            <AppText style={s.rowLabel}>Total ordered</AppText>
            <AppText style={s.rowValue}>{order.quantity}</AppText>
          </View>
          {(order.filled_quantity != null || order.open_quantity != null) && (
            <>
              <View style={s.row}>
                <AppText style={s.rowLabel}>Filled</AppText>
                <AppText style={[s.rowValue, { color: REAL_GREEN }]}>{filled}</AppText>
              </View>
              <View style={s.row}>
                <AppText style={s.rowLabel}>Remaining</AppText>
                <AppText style={s.rowValue}>{remaining}</AppText>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${order.quantity ? (filled / order.quantity) * 100 : 0}%`, backgroundColor: REAL_GREEN }]} />
              </View>
            </>
          )}
        </View>

        {/* ── Order parameters ── */}
        <View style={s.card}>
          <AppText style={s.cardTitle}>Order Details</AppText>
          <View style={s.row}>
            <AppText style={s.rowLabel}>Order type</AppText>
            <AppText style={s.rowValue}>{orderTypeLabel}</AppText>
          </View>
          <View style={s.row}>
            <AppText style={s.rowLabel}>Time in force</AppText>
            <AppText style={s.rowValue}>{order.time_in_force}</AppText>
          </View>
          {order.price != null && (
            <View style={s.row}>
              <AppText style={s.rowLabel}>Limit price</AppText>
              <AppText style={s.rowValue}>${Number(order.price).toFixed(2)}</AppText>
            </View>
          )}
          {(order as any).stop_price != null && (
            <View style={s.row}>
              <AppText style={s.rowLabel}>Stop price</AppText>
              <AppText style={s.rowValue}>${Number((order as any).stop_price).toFixed(2)}</AppText>
            </View>
          )}
          {totalValue != null && (
            <View style={s.row}>
              <AppText style={s.rowLabel}>Estimated total</AppText>
              <AppText style={s.rowValue}>${totalValue.toFixed(2)}</AppText>
            </View>
          )}
        </View>

        {/* ── Timing & reference ── */}
        <View style={s.card}>
          <AppText style={s.cardTitle}>Timing & Reference</AppText>
          <View style={s.row}>
            <AppText style={s.rowLabel}>Placed</AppText>
            <AppText style={s.rowValue}>{formatFullDate(order.time_placed)}</AppText>
          </View>
          <Pressable onPress={handleCopyId} style={s.row}>
            <AppText style={s.rowLabel}>Order ID</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <AppText style={s.rowValueMono} numberOfLines={1}>{order.brokerage_order_id.slice(0, 12)}…</AppText>
              <Ionicons name="copy-outline" size={14} color={COLORS.muted} />
            </View>
          </Pressable>
        </View>

        {isOpenOrder && params.accountId && (
          <View style={s.actionsRow}>
            <Pressable onPress={() => setModifyOpen(true)} style={s.modifyBtn}>
              <AppText style={s.modifyBtnText}>Modify Order</AppText>
            </Pressable>
            <Pressable onPress={handleCancel} disabled={cancelling} style={s.cancelBtn}>
              {cancelling ? <ActivityIndicator size="small" color={COLORS.red} /> : <AppText style={s.cancelBtnText}>Cancel Order</AppText>}
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={modifyOpen} transparent animationType="fade" onRequestClose={() => setModifyOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <AppText style={s.modalTitle}>Modify order</AppText>
            <AppText style={s.modifyFieldLabel}>Quantity</AppText>
            <AppTextInput value={modifyUnits} onChangeText={setModifyUnits} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.muted} style={s.modifyInput} />
            <AppText style={s.modifyFieldLabel}>Limit price</AppText>
            <AppTextInput value={modifyPrice} onChangeText={setModifyPrice} keyboardType="decimal-pad" placeholder="Leave blank for market" placeholderTextColor={COLORS.muted} style={s.modifyInput} />
            <AppText style={s.modifyFieldLabel}>Stop price (optional)</AppText>
            <AppTextInput value={modifyStop} onChangeText={setModifyStop} keyboardType="decimal-pad" placeholder="Leave blank if not a stop order" placeholderTextColor={COLORS.muted} style={s.modifyInput} />
            <Pressable onPress={handleSubmitModify} disabled={modifying} style={[s.confirmBtn, modifying && { opacity: 0.6 }]}>
              {modifying ? <ActivityIndicator color="#FFFFFF" /> : <AppText style={s.confirmBtnText}>Submit Changes</AppText>}
            </Pressable>
            <Pressable onPress={() => setModifyOpen(false)} disabled={modifying} style={s.cancelLinkModal}>
              <AppText style={s.cancelLinkModalText}>Cancel</AppText>
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

  hero: { alignItems: "center", paddingVertical: SPACE.xl },
  heroIcon: { width: 64, height: 64, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", marginBottom: SPACE.md },
  heroAction: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  heroSymbol: { fontSize: 24, fontWeight: "600", color: COLORS.text, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.full, paddingHorizontal: SPACE.md, paddingVertical: 6, marginTop: SPACE.md },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  statusDescription: { fontSize: 12, color: COLORS.muted, fontWeight: "500", textAlign: "center", marginTop: SPACE.sm, maxWidth: 260, lineHeight: 17 },

  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.lg, marginBottom: SPACE.md, ...GLASS_BORDER, ...CARD_SHADOW },
  cardTitle: { fontSize: 12, fontWeight: "600", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: SPACE.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACE.sm },
  rowLabel: { fontSize: 13, color: COLORS.muted, fontWeight: "500" },
  rowValue: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
  rowValueMono: { fontSize: 13, color: COLORS.text, fontWeight: "600", maxWidth: 160 },

  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.borderLight, marginTop: SPACE.sm, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },

  actionsRow: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.sm },
  modifyBtn: { flex: 1, alignItems: "center", paddingVertical: SPACE.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight },
  modifyBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: SPACE.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.red },
  cancelBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.red },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACE.xl, paddingBottom: SPACE.huge },
  modalTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text, marginBottom: SPACE.lg },
  modifyFieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: SPACE.sm, marginTop: SPACE.md },
  modifyInput: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.lg, height: 46, fontSize: 14, fontWeight: "600", color: COLORS.text },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", marginTop: SPACE.xl },
  confirmBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  cancelLinkModal: { alignItems: "center", paddingVertical: SPACE.md },
  cancelLinkModalText: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
});
