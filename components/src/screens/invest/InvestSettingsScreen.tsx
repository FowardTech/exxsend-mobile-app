import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useCustomAlert } from "@/components/CustomAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { getCurrencySymbol } from "@/api/flutterwave";
import {
  getMySubscription,
  cancelSubscription,
  getSnapTradeAccounts,
  disconnectSnapTradeAccount,
  BrokerageAccount,
  SubscriptionState,
} from "@/api/investments";
import BrokerLogo from "@/components/BrokerLogo";

export default function InvestSettingsScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const savedPhone = (await AsyncStorage.getItem("user_phone")) || "";
      setPhone(savedPhone);
      if (!savedPhone) { setLoading(false); return; }

      const [sub, accountsRes] = await Promise.all([
        getMySubscription(savedPhone),
        getSnapTradeAccounts(savedPhone),
      ]);
      if (accountsRes.subscriptionRequired) {
        router.replace("/investpaywall" as any);
        return;
      }
      setSubscription({ isActive: sub.isActive, subscription: sub.subscription, plan: sub.plan });
      setAccounts(Array.isArray(accountsRes.accounts) ? accountsRes.accounts : []);
    } catch {}
    setLoading(false);
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDisconnect = (acc: BrokerageAccount) => {
    showAlert(
      "Disconnect broker",
      `Remove ${acc.brokerageName} (${acc.accountNumberMasked}) from your Stock account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            if (!acc.id) return;
            setDisconnectingId(acc.id);
            const res = await disconnectSnapTradeAccount(phone, acc.id);
            setDisconnectingId(null);
            if (res.success) {
              setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
            } else {
              showAlert("Couldn't disconnect", res.message || "Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleCancelSubscription = () => {
    showAlert(
      "Cancel subscription",
      "Your Stock subscription will remain active until the end of the current billing period, then will not renew. Continue?",
      [
        { text: "Keep subscription", style: "cancel" },
        {
          text: "Cancel subscription",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            const res = await cancelSubscription(phone);
            setCancelling(false);
            if (res.success) {
              load();
            } else {
              showAlert("Couldn't cancel", res.message || "Please try again.");
            }
          },
        },
      ]
    );
  };

  const renewsOn = subscription?.subscription?.currentPeriodEnd || subscription?.subscription?.renewsOn;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <AppText style={s.headerTitle}>Stock Settings</AppText>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.push("/investtaxreport" as any)} style={s.taxRow}>
            <View style={s.taxIconWrap}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
            </View>
            <AppText style={s.taxRowText}>Tax Report</AppText>
            <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
          </Pressable>

          <AppText style={s.sectionTitle}>Subscription</AppText>
          <View style={s.subCard}>
            <View style={s.subRow}>
              <AppText style={s.subLabel}>Status</AppText>
              <View style={[s.statusPill, { backgroundColor: subscription?.isActive ? COLORS.greenSoft : COLORS.errorLight }]}>
                <AppText style={[s.statusPillText, { color: subscription?.isActive ? COLORS.green : COLORS.red }]}>
                  {subscription?.isActive ? "Active" : "Inactive"}
                </AppText>
              </View>
            </View>
            {!!subscription?.plan && (
              <View style={s.subRow}>
                <AppText style={s.subLabel}>Plan</AppText>
                <AppText style={s.subValue}>
                  {getCurrencySymbol(subscription.plan.baseCurrency)}{subscription.plan.priceInBase.toFixed(2)} / {subscription.plan.currency}
                </AppText>
              </View>
            )}
            {!!renewsOn && (
              <View style={s.subRow}>
                <AppText style={s.subLabel}>Renews on</AppText>
                <AppText style={s.subValue}>{new Date(renewsOn).toLocaleDateString()}</AppText>
              </View>
            )}

            {subscription?.isActive && (
              <Pressable onPress={handleCancelSubscription} disabled={cancelling} style={s.cancelBtn}>
                {cancelling ? (
                  <ActivityIndicator color={COLORS.red} />
                ) : (
                  <AppText style={s.cancelBtnText}>Cancel Subscription</AppText>
                )}
              </Pressable>
            )}
          </View>

          <AppText style={[s.sectionTitle, { marginTop: SPACE.xxl }]}>Connected Brokers</AppText>
          {accounts.length === 0 ? (
            <View style={s.emptyCard}>
              <AppText style={s.emptyText}>No brokerage accounts connected.</AppText>
            </View>
          ) : (
            accounts.map((acc, i) => (
              <View key={acc.id || i} style={s.accountRow}>
                <BrokerLogo logoUrl={acc.logoUrl} size={36} />
                <View style={{ flex: 1, marginLeft: SPACE.md }}>
                  <AppText style={s.brokerName}>{acc.brokerageName}</AppText>
                  <AppText style={s.accountNumber}>{acc.accountNumberMasked}</AppText>
                </View>
                <Pressable
                  onPress={() => handleDisconnect(acc)}
                  disabled={disconnectingId === acc.id}
                  style={s.disconnectBtn}
                >
                  {disconnectingId === acc.id ? (
                    <ActivityIndicator size="small" color={COLORS.red} />
                  ) : (
                    <AppText style={s.disconnectBtnText}>Disconnect</AppText>
                  )}
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.md, paddingBottom: SPACE.huge },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: SPACE.md },
  taxRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.xxl, ...GLASS_BORDER, ...CARD_SHADOW },
  taxIconWrap: { width: 34, height: 34, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center", marginRight: SPACE.md },
  taxRowText: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.text },
  subCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACE.lg, ...GLASS_BORDER, ...CARD_SHADOW },
  subRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.md },
  subLabel: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
  subValue: { fontSize: 13, color: COLORS.text, fontWeight: "700" },
  statusPill: { paddingHorizontal: SPACE.sm + 2, paddingVertical: SPACE.xs, borderRadius: RADIUS.full },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  cancelBtn: { marginTop: SPACE.sm, alignItems: "center", paddingVertical: SPACE.md },
  cancelBtnText: { color: COLORS.red, fontSize: 14, fontWeight: "700" },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACE.xxl, alignItems: "center", ...GLASS_BORDER, ...CARD_SHADOW },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
  accountRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.sm, ...GLASS_BORDER, ...CARD_SHADOW },
  brokerName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  accountNumber: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  disconnectBtn: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, backgroundColor: COLORS.errorLight, borderRadius: RADIUS.sm },
  disconnectBtnText: { color: COLORS.red, fontSize: 12, fontWeight: "700" },
});
