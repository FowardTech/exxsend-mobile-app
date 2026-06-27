import { getUserProfile } from "@/api/config";
import {
  cancelMoneyRequest,
  declineMoneyRequest,
  getIncomingMoneyRequests,
  getOutgoingMoneyRequests,
  MoneyRequest,
} from "@/api/moneyRequests";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import { COLORS } from "@/theme/colors";
import { GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Tab = "incoming" | "outgoing";

function statusColor(status: string): string {
  if (status === "paid") return "#059669";
  if (status === "declined" || status === "cancelled" || status === "expired") return COLORS.red;
  return COLORS.primary;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MoneyRequestsScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [tab, setTab] = useState<Tab>("incoming");
  const [incoming, setIncoming] = useState<MoneyRequest[]>([]);
  const [outgoing, setOutgoing] = useState<MoneyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOnId, setActingOnId] = useState<number | null>(null);

  const load = useCallback(async (p: string) => {
    const [inRes, outRes] = await Promise.all([getIncomingMoneyRequests(p), getOutgoingMoneyRequests(p)]);
    if (inRes.success) setIncoming(inRes.requests);
    if (outRes.success) setOutgoing(outRes.requests);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    (async () => {
      const p = (await AsyncStorage.getItem("user_phone")) || "";
      setPhone(p);
      if (p) load(p);
      else setLoading(false);
    })();
  }, [load]);

  const onRefresh = () => {
    if (!phone) return;
    setRefreshing(true);
    load(phone);
  };

  const [resolvingPayId, setResolvingPayId] = useState<number | null>(null);

  const handlePay = async (req: MoneyRequest) => {
    // The documented request shape only has requesterPhone/requesterName,
    // no username — but /transfers/internal needs a username, not a
    // phone. getUserProfile is phone-keyed the same way as every other
    // endpoint in this app, so it's a reasonable best-effort way to
    // resolve the requester's username (and photo) before handing off to
    // the Exxsend send screen — if it doesn't resolve, falls back to the
    // normal manual-lookup flow rather than blocking the payment.
    setResolvingPayId(req.id);
    let prefillUsername: string | undefined;
    try {
      const profile = await getUserProfile(req.requesterPhone);
      prefillUsername = profile.success ? profile.user?.username || undefined : undefined;
    } catch { }
    setResolvingPayId(null);

    router.push({
      pathname: "/exxsendmembers" as any,
      params: {
        fromAmount: String(req.amount),
        fromCurrency: req.currency,
        requestId: String(req.id),
        requestNote: req.note ? encodeURIComponent(req.note) : undefined,
        ...(prefillUsername ? { prefillUsername } : {}),
      } as any,
    });
  };

  const handleDecline = (req: MoneyRequest) => {
    Alert.alert("Decline request", `Decline the request for ${req.currency} ${req.amount} from ${req.requesterName || req.requesterPhone}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          setActingOnId(req.id);
          try {
            const res = await declineMoneyRequest(req.id, phone);
            if (res.success) {
              setIncoming((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "declined" } : r)));
            } else {
              Alert.alert("Couldn't decline", res.message || "Please try again.");
            }
          } finally {
            setActingOnId(null);
          }
        },
      },
    ]);
  };

  const handleCancel = (req: MoneyRequest) => {
    Alert.alert("Cancel request", `Cancel your request for ${req.currency} ${req.amount} from ${req.recipientName || req.recipientPhone}?`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel request",
        style: "destructive",
        onPress: async () => {
          setActingOnId(req.id);
          try {
            const res = await cancelMoneyRequest(req.id, phone);
            if (res.success) {
              setOutgoing((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "cancelled" } : r)));
            } else {
              Alert.alert("Couldn't cancel", res.message || "Please try again.");
            }
          } finally {
            setActingOnId(null);
          }
        },
      },
    ]);
  };

  const list = tab === "incoming" ? incoming : outgoing;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        {router.canGoBack() && <BackButton onPress={() => router.back()} showLabel={false} />}
        <AppText style={s.headerTitle}>Money Requests</AppText>
        <Pressable onPress={() => router.push("/requestmoney" as any)} style={s.newBtn}>
          <Ionicons name="add" size={20} color={COLORS.primary} />
        </Pressable>
      </View>

      <View style={s.tabsRow}>
        <Pressable onPress={() => setTab("incoming")} style={[s.tab, tab === "incoming" && s.tabActive]}>
          <AppText style={[s.tabText, tab === "incoming" && s.tabTextActive]}>Incoming</AppText>
        </Pressable>
        <Pressable onPress={() => setTab("outgoing")} style={[s.tab, tab === "outgoing" && s.tabActive]}>
          <AppText style={[s.tabText, tab === "outgoing" && s.tabTextActive]}>Outgoing</AppText>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="small" color={COLORS.primary} /></View>
      ) : list.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="cash-outline" size={28} color={COLORS.muted} style={{ marginBottom: 10 }} />
          <AppText style={s.emptyText}>
            {tab === "incoming" ? "No one has requested money from you yet." : "You haven't requested money from anyone yet."}
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {list.map((req) => (
            <View key={req.id} style={s.card}>
              <View style={s.cardTop}>
                <View>
                  <AppText style={s.cardName}>
                    {tab === "incoming" ? (req.requesterName || req.requesterPhone) : (req.recipientName || req.recipientPhone)}
                  </AppText>
                  {!!req.note && <AppText style={s.cardNote} numberOfLines={1}>{req.note}</AppText>}
                </View>
                <View style={[s.statusPill, { backgroundColor: `${statusColor(req.status)}1A` }]}>
                  <AppText style={[s.statusPillText, { color: statusColor(req.status) }]}>{req.status}</AppText>
                </View>
              </View>

              <View style={s.cardBottom}>
                <AppText style={s.cardAmount}>{req.currency} {Number(req.amount).toFixed(2)}</AppText>
                <AppText style={s.cardDate}>{formatDate(req.createdAt)}</AppText>
              </View>

              {tab === "incoming" && req.status === "pending" && (
                <View style={s.actionsRow}>
                  <Pressable
                    onPress={() => handleDecline(req)}
                    disabled={actingOnId === req.id}
                    style={s.declineBtn}
                  >
                    <AppText style={s.declineBtnText}>Decline</AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => handlePay(req)}
                    disabled={actingOnId === req.id || resolvingPayId === req.id}
                    style={s.payBtn}
                  >
                    {resolvingPayId === req.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <AppText style={s.payBtnText}>Pay</AppText>}
                  </Pressable>
                </View>
              )}

              {tab === "outgoing" && req.status === "pending" && (
                <Pressable
                  onPress={() => handleCancel(req)}
                  disabled={actingOnId === req.id}
                  style={s.cancelLink}
                >
                  {actingOnId === req.id ? (
                    <ActivityIndicator size="small" color={COLORS.red} />
                  ) : (
                    <AppText style={s.cancelLinkText}>Cancel request</AppText>
                  )}
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: COLORS.text },
  newBtn: { width: 34, height: 34, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },

  tabsRow: { flexDirection: "row", paddingHorizontal: SCREEN_PADDING, gap: SPACE.lg, marginBottom: SPACE.lg },
  tab: { paddingVertical: SPACE.sm, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.muted },
  tabTextActive: { color: COLORS.primary, fontWeight: "600" },

  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge, gap: SPACE.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.lg, ...GLASS_BORDER },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  cardNote: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2, maxWidth: 200 },
  statusPill: { borderRadius: RADIUS.full, paddingHorizontal: SPACE.sm, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: SPACE.md },
  cardAmount: { fontSize: 18, fontWeight: "600", color: COLORS.text },
  cardDate: { fontSize: 11, color: COLORS.muted, fontWeight: "500" },

  actionsRow: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.md },
  declineBtn: { flex: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.sm + 2, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  declineBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.muted },
  payBtn: { flex: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.sm + 2, alignItems: "center", backgroundColor: COLORS.primary },
  payBtnText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  cancelLink: { marginTop: SPACE.md, alignSelf: "flex-start" },
  cancelLinkText: { fontSize: 13, fontWeight: "600", color: COLORS.red },
});
