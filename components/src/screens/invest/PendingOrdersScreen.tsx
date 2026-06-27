import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, RefreshControl, Alert, Modal, StyleSheet } from "react-native";
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
import { getSnapTradeAccounts, BrokerageAccount, getOrders, cancelOrder, BrokerageOrder, syncSnapTrade, replaceOrder, TradeAction, TimeInForce } from "@/api/investments";

type Tab = "open" | "history";

// COLORS.green in this app's theme is actually the brand blue (#315CFD) —
// using the real green here since order status needs to be genuinely
// color-coded, not just on-brand.
const REAL_GREEN = "#10B981";

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function statusColor(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("fill") || s.includes("complet") || s.includes("execut")) return REAL_GREEN;
  if (s.includes("cancel") || s.includes("reject") || s.includes("expir")) return COLORS.red;
  return COLORS.primary;
}

export default function PendingOrdersScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BrokerageAccount | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);

  const [tab, setTab] = useState<Tab>("open");
  const [orders, setOrders] = useState<BrokerageOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [modifyOrder, setModifyOrder] = useState<BrokerageOrder | null>(null);
  const [modifyUnits, setModifyUnits] = useState("");
  const [modifyPrice, setModifyPrice] = useState("");
  const [modifyStop, setModifyStop] = useState("");
  const [modifying, setModifying] = useState(false);

  const loadOrders = useCallback(async (p: string, accountId: string, t: Tab) => {
    try {
      const res = await getOrders(p, accountId, t === "open" ? "open" : "executed", t === "open" ? 30 : 90);
      setOrders(res.success ? res.orders : []);
      if (!res.success && res.error) {
        Alert.alert("Couldn't load orders", res.error.message);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    (async () => {
      const p = (await AsyncStorage.getItem("user_phone")) || "";
      setPhone(p);
      if (!p) { setLoading(false); return; }
      try {
        const res = await getSnapTradeAccounts(p);
        const list = Array.isArray(res.accounts) ? res.accounts : [];
        setAccounts(list);
        if (list.length >= 1) {
          setSelectedAccount(list[0]);
          await loadOrders(p, list[0].id || "", "open");
          return;
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    if (phone && selectedAccount?.id) {
      setLoading(true);
      loadOrders(phone, selectedAccount.id, t);
    }
  };

  const switchAccount = (acc: BrokerageAccount) => {
    setSelectedAccount(acc);
    setAccountPickerOpen(false);
    if (phone && acc.id) {
      setLoading(true);
      loadOrders(phone, acc.id, tab);
    }
  };

  const onRefresh = () => {
    if (!phone || !selectedAccount?.id) return;
    setRefreshing(true);
    loadOrders(phone, selectedAccount.id, tab);
  };

  const handleOpenModify = (order: BrokerageOrder) => {
    setModifyOrder(order);
    setModifyUnits(String(order.open_quantity ?? order.quantity ?? ""));
    setModifyPrice(order.price != null ? String(order.price) : "");
    setModifyStop((order as any).stop_price != null ? String((order as any).stop_price) : "");
  };

  const handleSubmitModify = async () => {
    if (!modifyOrder || !phone || !selectedAccount?.id) return;
    const unitsNum = parseFloat(modifyUnits);
    if (!unitsNum || unitsNum <= 0) {
      Alert.alert("Enter quantity", "Please enter how many shares this order should be for.");
      return;
    }
    setModifying(true);
    try {
      // BrokerageOrder doesn't have a clean documented order_type field —
      // fall back to inferring Limit-vs-Market from whether a price is
      // already set on the original order, which is the best signal
      // available without a dedicated field.
      const inferredType = (modifyOrder as any).order_type || (modifyOrder as any).orderType || (modifyPrice ? "Limit" : "Market");
      const res = await replaceOrder({
        phone,
        accountId: selectedAccount.id,
        brokerageOrderId: modifyOrder.brokerage_order_id,
        action: (modifyOrder.action as TradeAction) || "BUY",
        orderType: inferredType,
        timeInForce: (modifyOrder.time_in_force as TimeInForce) || "Day",
        units: unitsNum,
        price: modifyPrice ? parseFloat(modifyPrice) : undefined,
        stop: modifyStop ? parseFloat(modifyStop) : null,
        symbol: modifyOrder.symbol,
      });
      if (res.success) {
        setModifyOrder(null);
        syncSnapTrade(phone).catch(() => {});
        // The brokerage_order_id may have changed — refresh from the
        // server rather than trying to patch the old entry in place.
        if (selectedAccount?.id) loadOrders(phone, selectedAccount.id, tab);
      } else {
        Alert.alert("Couldn't modify order", res.error?.message || "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Couldn't modify order", e?.message || "Please try again.");
    } finally {
      setModifying(false);
    }
  };

  const handleCancel = (order: BrokerageOrder) => {
    if (!phone || !selectedAccount?.id) return;
    Alert.alert(
      "Cancel order",
      `Cancel the ${order.action?.toLowerCase()} order for ${order.quantity} ${order.symbol}?`,
      [
        { text: "Keep order", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: async () => {
            setCancellingId(order.brokerage_order_id);
            try {
              const res = await cancelOrder(phone, selectedAccount.id!, order.brokerage_order_id);
              if (res.success) {
                syncSnapTrade(phone).catch(() => {});
                setOrders((prev) => prev.filter((o) => o.brokerage_order_id !== order.brokerage_order_id));
              } else {
                Alert.alert("Couldn't cancel order", res.error?.message || "Please try again.");
              }
            } catch (e: any) {
              Alert.alert("Couldn't cancel order", e?.message || "Please try again.");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        {router.canGoBack() && <BackButton onPress={() => router.back()} showLabel={false} />}
        <AppText style={s.headerTitle}>Orders</AppText>
        <View style={{ width: 34 }} />
      </View>

      {accounts.length > 1 && (
        <Pressable onPress={() => setAccountPickerOpen(true)} style={s.accountPill}>
          <BrokerLogo logoUrl={selectedAccount?.logoUrl} size={20} />
          <AppText style={s.accountPillText} numberOfLines={1}>
            {selectedAccount?.brokerageName} {selectedAccount?.accountNumberMasked}
          </AppText>
          <Ionicons name="chevron-down" size={14} color={COLORS.muted} />
        </Pressable>
      )}

      <View style={s.tabsRow}>
        <Pressable onPress={() => switchTab("open")} style={[s.tab, tab === "open" && s.tabActive]}>
          <AppText style={[s.tabText, tab === "open" && s.tabTextActive]}>Open</AppText>
        </Pressable>
        <Pressable onPress={() => switchTab("history")} style={[s.tab, tab === "history" && s.tabActive]}>
          <AppText style={[s.tabText, tab === "history" && s.tabTextActive]}>History</AppText>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="small" color={COLORS.primary} /></View>
      ) : !selectedAccount ? (
        <View style={s.centered}>
          <Ionicons name="business-outline" size={28} color={COLORS.muted} style={{ marginBottom: 10 }} />
          <AppText style={s.emptyText}>Connect a brokerage account to see your orders.</AppText>
        </View>
      ) : orders.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="time-outline" size={28} color={COLORS.muted} style={{ marginBottom: 10 }} />
          <AppText style={s.emptyText}>{tab === "open" ? "No open orders right now." : "No order history yet."}</AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {orders.map((o, i) => (
            <Pressable
              key={o.brokerage_order_id || i}
              onPress={() => router.push({
                pathname: "/orderdetail" as any,
                params: { order: JSON.stringify(o), accountId: selectedAccount?.id || "", phone } as any,
              })}
              style={s.orderCard}
            >
              <View style={s.orderTop}>
                <View style={s.orderTopLeft}>
                  <AppText style={[s.orderSymbol, { color: (o.action || "").toUpperCase() === "BUY" ? REAL_GREEN : COLORS.red }]} numberOfLines={1}>
                    {(o.action || "").toUpperCase() === "BUY" ? "Buy" : "Sell"} {o.symbol}
                  </AppText>
                  <AppText style={s.orderMeta} numberOfLines={1}>
                    {o.quantity} shares{o.price ? ` @ $${Number(o.price).toFixed(2)}` : ""} · {o.time_in_force}
                  </AppText>
                </View>
                <View style={[s.statusPill, { backgroundColor: `${statusColor(o.status)}1A` }]}>
                  <AppText style={[s.statusPillText, { color: statusColor(o.status) }]}>{o.status}</AppText>
                </View>
              </View>

              {(o.open_quantity != null || o.filled_quantity != null) && (
                <AppText style={s.orderFillInfo}>
                  {o.filled_quantity || 0} filled · {o.open_quantity ?? o.quantity} remaining
                </AppText>
              )}

              <AppText style={s.orderTime}>{formatDate(o.time_placed)}</AppText>

              {tab === "open" && (
                <View style={s.openActionsRow}>
                  <Pressable onPress={() => handleOpenModify(o)} style={s.modifyBtn}>
                    <AppText style={s.modifyBtnText}>Modify</AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleCancel(o)}
                    disabled={cancellingId === o.brokerage_order_id}
                    style={s.cancelBtn}
                  >
                    {cancellingId === o.brokerage_order_id ? (
                      <ActivityIndicator size="small" color={COLORS.red} />
                    ) : (
                      <AppText style={s.cancelBtnText}>Cancel order</AppText>
                    )}
                  </Pressable>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={accountPickerOpen} transparent animationType="fade" onRequestClose={() => setAccountPickerOpen(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setAccountPickerOpen(false)}>
          <View style={s.modalSheet}>
            <AppText style={s.modalTitle}>Account</AppText>
            {accounts.map((acc, i) => (
              <Pressable key={i} onPress={() => switchAccount(acc)} style={s.modalRow}>
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

      <Modal visible={!!modifyOrder} transparent animationType="fade" onRequestClose={() => setModifyOrder(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <AppText style={s.modalTitle}>Modify order</AppText>
            {!!modifyOrder && (
              <AppText style={s.modifySubtitle}>{modifyOrder.action} {modifyOrder.symbol}</AppText>
            )}

            <AppText style={s.modifyFieldLabel}>Quantity</AppText>
            <AppTextInput
              value={modifyUnits}
              onChangeText={setModifyUnits}
              placeholder="0"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              style={s.modifyInput}
            />

            <AppText style={s.modifyFieldLabel}>Limit price</AppText>
            <AppTextInput
              value={modifyPrice}
              onChangeText={setModifyPrice}
              placeholder="Leave blank for market"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              style={s.modifyInput}
            />

            <AppText style={s.modifyFieldLabel}>Stop price (optional)</AppText>
            <AppTextInput
              value={modifyStop}
              onChangeText={setModifyStop}
              placeholder="Leave blank if not a stop order"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              style={s.modifyInput}
            />

            <Pressable onPress={handleSubmitModify} disabled={modifying} style={[s.confirmBtn, modifying && { opacity: 0.6 }]}>
              {modifying ? <ActivityIndicator color="#FFFFFF" /> : <AppText style={s.confirmBtnText}>Submit Changes</AppText>}
            </Pressable>
            <Pressable onPress={() => setModifyOrder(null)} disabled={modifying} style={s.cancelLinkModal}>
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

  accountPill: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, alignSelf: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, marginBottom: SPACE.md, ...GLASS_BORDER },
  accountPillText: { fontSize: 12, fontWeight: "600", color: COLORS.text, maxWidth: 200 },

  tabsRow: { flexDirection: "row", paddingHorizontal: SCREEN_PADDING, gap: SPACE.lg, marginBottom: SPACE.lg },
  tab: { paddingVertical: SPACE.sm, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.muted },
  tabTextActive: { color: COLORS.primary, fontWeight: "600" },

  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge, gap: SPACE.md },
  orderCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.lg, ...GLASS_BORDER },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderTopLeft: { flex: 1, minWidth: 0, marginRight: SPACE.sm },
  orderSymbol: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  orderMeta: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  statusPill: { flexShrink: 0, borderRadius: RADIUS.full, paddingHorizontal: SPACE.sm, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "600" },
  orderFillInfo: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: SPACE.sm },
  orderTime: { fontSize: 11, color: COLORS.muted, fontWeight: "500", marginTop: 4 },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.red },
  openActionsRow: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.md },
  modifyBtn: { flex: 1, alignItems: "center", paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryLight },
  modifyBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  modifySubtitle: { fontSize: 13, color: COLORS.muted, fontWeight: "600", marginBottom: SPACE.lg },
  modifyFieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: SPACE.sm, marginTop: SPACE.md },
  modifyInput: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.lg, height: 46, fontSize: 14, fontWeight: "600", color: COLORS.text },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", marginTop: SPACE.xl },
  confirmBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  cancelLinkModal: { alignItems: "center", paddingVertical: SPACE.md },
  cancelLinkModalText: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
  cancelBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.red },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACE.xl, paddingBottom: SPACE.huge },
  modalTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text, marginBottom: SPACE.lg },
  modalRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.md },
  modalRowTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  modalRowSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
});
