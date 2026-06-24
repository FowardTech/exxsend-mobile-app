import React, { useEffect, useMemo, useState } from "react";
import { View, SectionList, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { getCurrencySymbol } from "@/api/flutterwave";
import { getSnapTradeTransactions, InvestmentTransaction } from "@/api/investments";

function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function badgeColors(type: string): { bg: string; text: string } {
  const t = type.toUpperCase();
  if (t === "BUY") return { bg: COLORS.primaryLight, text: COLORS.primary };
  if (t === "SELL") return { bg: COLORS.errorLight, text: COLORS.red };
  if (t === "DIV") return { bg: COLORS.greenSoft, text: COLORS.green };
  return { bg: COLORS.bgTertiary, text: COLORS.muted };
}

export default function InvestTransactionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const phone = (await AsyncStorage.getItem("user_phone")) || "";
        if (!phone) { setLoading(false); return; }
        const res = await getSnapTradeTransactions(phone);
        if (res.subscriptionRequired) {
          router.replace("/investpaywall" as any);
          return;
        }
        setTransactions(res.transactions);
      } catch {}
      setLoading(false);
    })();
  }, [router]);

  const sections = useMemo(() => {
    const groups = new Map<string, InvestmentTransaction[]>();
    for (const tx of transactions) {
      const key = formatDateGroup(tx.tradeDate);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }
    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [transactions]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)} />
        <AppText style={s.headerTitle}>Investment Activity</AppText>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => `${item.symbol}-${item.tradeDate}-${i}`}
          contentContainerStyle={s.listBody}
          ListEmptyComponent={
            <View style={s.centered}>
              <AppText style={s.emptyText}>No investment activity yet.</AppText>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <AppText style={s.sectionHeader}>{section.title}</AppText>
          )}
          renderItem={({ item }) => {
            const badge = badgeColors(item.type);
            return (
              <View style={s.row}>
                <View style={[s.badge, { backgroundColor: badge.bg }]}>
                  <AppText style={[s.badgeText, { color: badge.text }]}>{item.type.toUpperCase()}</AppText>
                </View>
                <View style={{ flex: 1, marginLeft: SPACE.md }}>
                  <AppText style={s.symbol}>{item.symbol}</AppText>
                  <AppText style={s.qty}>{item.quantity} shares</AppText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <AppText style={s.amountBase}>
                    {getCurrencySymbol("USD")}{(item.amountInUsd ?? item.amount).toFixed(2)} USD
                  </AppText>
                  {!!item.amountInBase && (
                    <AppText style={s.amountNative}>
                      {getCurrencySymbol(item.currency)}{item.amount.toFixed(2)} {item.currency}
                    </AppText>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.muted, fontWeight: "600" },
  listBody: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },
  sectionHeader: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: SPACE.lg, marginBottom: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.sm, ...GLASS_BORDER, ...CARD_SHADOW },
  badge: { paddingHorizontal: SPACE.sm + 2, paddingVertical: SPACE.xs, borderRadius: RADIUS.xs - 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  symbol: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  qty: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  amountBase: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  amountNative: { fontSize: 11, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
});
