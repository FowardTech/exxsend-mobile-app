import { COUNTRY_NAMES, CURRENCY_TO_COUNTRY } from "@/api/flutterwave";
import { RecentRecipientFromDB } from "@/api/sync";
import { getUserTransactions, WalletTransaction } from "@/api/transactions";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import RecipientAvatar from "@/components/RecipientAvatar";
import { COLORS } from "@/theme/colors";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function getInitials(name: string) {
  return (name || "U").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
}

function getTxIcon(tx: WalletTransaction): keyof typeof Ionicons.glyphMap {
  return tx.transactionType === "payout" || tx.transactionType === "transfer_out" ? "arrow-up" : "arrow-down";
}

function formatTxAmount(tx: WalletTransaction): string {
  const isOutgoing = tx.transactionType === "payout" || tx.transactionType === "transfer_out" || tx.amount < 0;
  const formatted = Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${isOutgoing ? "-" : "+"}${formatted} ${tx.currency}`;
}

function formatTxDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function RecipientActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recipient?: string }>();
  const recipient: RecentRecipientFromDB | null = useMemo(() => {
    if (!params.recipient) return null;
    try { return JSON.parse(String(params.recipient)); } catch { return null; }
  }, [params.recipient]);

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  useEffect(() => {
    (async () => {
      if (!recipient) { setLoading(false); return; }
      try {
        const phone = (await AsyncStorage.getItem("user_phone")) || "";
        if (!phone) { setLoading(false); return; }
        // No "transactions by recipient" endpoint exists, so pull a recent
        // batch and filter client-side by matching account number (falling
        // back to name) — good enough for "recent activity with this person".
        const res = await getUserTransactions(phone, 1, 100, recipient.destCurrency || undefined);
        if (res.success) {
          const matches = res.transactions.filter((tx) => {
            if (recipient.accountNumber && tx.counterpartyAccount) {
              return tx.counterpartyAccount === recipient.accountNumber;
            }
            return (tx.counterpartyName || "").toLowerCase() === (recipient.accountName || "").toLowerCase();
          });
          setTransactions(matches);
        }
      } catch { }
      setLoading(false);
    })();
  }, [recipient]);

  const handleSendToRecipient = () => {
    if (!recipient) return;
    if (recipient.bankCode === "EXXSEND" || (recipient as any).payoutMethod === "exxsend" || (recipient as any).payoutType === "exxsend") {
      router.push({
        pathname: "/exxsendmembers" as any,
        params: { prefillUsername: String(recipient.accountNumber || "").replace(/^@/, "") } as any,
      });
      return;
    }
    const destCurrency = (recipient.destCurrency || "NGN").toUpperCase();
    const countryCode = destCurrency === "CAD" ? "CA" : (recipient.countryCode || CURRENCY_TO_COUNTRY[destCurrency] || "NG").toUpperCase();
    const countryName = COUNTRY_NAMES[countryCode] || countryCode;
    router.push({
      pathname: "/recipientnew" as any,
      params: {
        destCurrency,
        countryCode,
        countryName,
        prefilledRecipient: JSON.stringify(recipient),
      } as any,
    });
  };

  if (!recipient) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          {router.canGoBack() && <BackButton onPress={() => router.back()} showLabel={false} />}
        </View>
        <View style={s.centered}>
          <AppText style={{ color: COLORS.muted }}>Recipient not found.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        {router.canGoBack() && <BackButton onPress={() => router.back()} showLabel={false} />}
        <AppText style={s.headerTitle}>Recipient</AppText>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.profileBlock}>
          <RecipientAvatar
            name={recipient.accountName}
            currencyCode={recipient.destCurrency}
            countryCode={(recipient as any).countryCode}
            isExxsend={recipient.bankCode === "EXXSEND" || (recipient as any).payoutType === "exxsend"}
            photoUrl={(recipient as any).avatarUrl}
            size={72}
            backgroundColor={COLORS.primaryLight}
            textColor={COLORS.primary}
            style={{ marginBottom: SPACE.md }}
          />
          <AppText style={s.name}>{recipient.accountName}</AppText>
          <AppText style={s.meta}>
            {recipient.bankName || "Bank"}
            {recipient.accountNumber ? ` · •••• ${recipient.accountNumber.slice(-4)}` : ""}
          </AppText>
          {!!recipient.destCurrency && <AppText style={s.metaCurrency}>{recipient.destCurrency}</AppText>}
        </View>

        <Pressable onPress={handleSendToRecipient} style={s.sendBtn}>
          <Ionicons name="arrow-forward-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <AppText style={s.sendBtnText}>Send to this recipient</AppText>
        </Pressable>

        <AppText style={s.sectionTitle}>Recent activity</AppText>

        {loading ? (
          <View style={s.card}>
            <View style={{ padding: 24, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          </View>
        ) : transactions.length === 0 ? (
          <View style={s.card}>
            <View style={{ padding: 24, alignItems: "center" }}>
              <Ionicons name="receipt-outline" size={26} color={COLORS.muted} style={{ marginBottom: 8 }} />
              <AppText style={{ fontSize: 13, fontWeight: "600", color: COLORS.muted }}>
                No previous transfers to {recipient.accountName.split(" ")[0]} yet
              </AppText>
            </View>
          </View>
        ) : (
          <View style={s.card}>
            {transactions.map((tx, i) => (
              <View key={`${tx.reference}_${i}`}>
                <View style={s.txRow}>
                  <View style={s.txIconWrap}>
                    <Ionicons name={getTxIcon(tx)} size={16} color={COLORS.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={s.txTitle} numberOfLines={1}>{tx.description || "Transfer"}</AppText>
                    <AppText style={s.txDate}>{formatTxDate(tx.createdAt)}</AppText>
                  </View>
                  <AppText style={[s.txAmount, { color: (tx.transactionType === "payout" || tx.amount < 0) ? COLORS.red : COLORS.green }]}>
                    {formatTxAmount(tx)}
                  </AppText>
                </View>
                {i < transactions.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: COLORS.text },
  body: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },
  profileBlock: { alignItems: "center", paddingVertical: SPACE.xl },
  avatar: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: SPACE.md },
  avatarText: { fontSize: 24, fontWeight: "600", color: COLORS.primary },
  name: { fontSize: 19, fontWeight: "600", color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.muted, fontWeight: "600", marginTop: 4 },
  metaCurrency: { fontSize: 11, color: COLORS.primary, fontWeight: "600", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, marginBottom: SPACE.xxl },
  sendBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginBottom: SPACE.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
  txRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md + 1, gap: SPACE.md },
  txIconWrap: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  txTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  txDate: { fontSize: 11, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.borderLight, marginLeft: SPACE.lg + 36 + SPACE.md },
});
