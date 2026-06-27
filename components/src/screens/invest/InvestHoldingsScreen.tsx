import { getCurrencySymbol } from "@/api/flutterwave";
import { getSnapTradeHoldings, Holding } from "@/api/investments";
import AppText from "@/components/AppText";
import AppTextInput from "@/components/AppTextInput";
import BackButton from "@/components/BackButton";
import { COLORS } from "@/theme/colors";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// COLORS.green in this app's theme is actually the brand blue — gain/loss
// needs a genuinely green/red color pair, same pattern used elsewhere in
// the stock screens (TradeTicketScreen, PendingOrdersScreen).
const REAL_GREEN = "#10B981";

export default function InvestHoldingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const phone = (await AsyncStorage.getItem("user_phone")) || "";
        if (!phone) { setLoading(false); return; }
        const res = await getSnapTradeHoldings(phone);
        if (res.subscriptionRequired) {
          router.replace("/investpaywall" as any);
          return;
        }
        setHoldings(res.holdings);
        setBaseCurrency(res.baseCurrency || "USD");
      } catch { }
      setLoading(false);
    })();
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return holdings;
    return holdings.filter(
      (h) => h.symbol.toLowerCase().includes(q) || h.description.toLowerCase().includes(q)
    );
  }, [holdings, search]);

  const baseSym = getCurrencySymbol(baseCurrency);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)} showLabel={false} />
        <AppText style={s.headerTitle}>Holdings</AppText>
        <View style={{ width: 34 }} />
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={16} color={COLORS.muted} />
        <AppTextInput
          style={s.searchInput}
          placeholder="Search symbol or company"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${item.symbol}-${i}`}
          contentContainerStyle={s.listBody}
          ListEmptyComponent={
            <View style={s.centered}>
              <AppText style={s.emptyText}>
                {holdings.length === 0 ? "No holdings yet." : "No holdings match your search."}
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const isForeign = item.currency !== baseCurrency;
            const nativeSym = getCurrencySymbol(item.currency);
            const hasCostBasis = item.avgCostInUsd != null && item.avgCostInUsd > 0;
            const gainLossUsd = hasCostBasis ? item.marketValueInUsd - item.avgCostInUsd! * item.quantity : null;
            const gainLossPct = hasCostBasis ? ((item.marketPriceInUsd - item.avgCostInUsd!) / item.avgCostInUsd!) * 100 : null;
            const isUp = (gainLossUsd ?? 0) >= 0;
            return (
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <AppText style={s.symbol}>{item.symbol}</AppText>
                  <AppText style={s.description} numberOfLines={1}>{item.description}</AppText>
                  <AppText style={s.qty}>
                    {item.quantity} × {nativeSym}{item.marketPrice.toFixed(2)}
                  </AppText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <AppText style={s.valueBase}>{baseSym}{item.marketValueInBase.toFixed(2)}</AppText>
                  {hasCostBasis ? (
                    <View style={s.gainLossRow}>
                      <Ionicons name={isUp ? "caret-up" : "caret-down"} size={10} color={isUp ? REAL_GREEN : COLORS.red} />
                      <AppText style={[s.gainLossText, { color: isUp ? REAL_GREEN : COLORS.red }]}>
                        ${Math.abs(gainLossUsd!).toFixed(2)} ({Math.abs(gainLossPct!).toFixed(2)}%)
                      </AppText>
                    </View>
                  ) : (
                    <AppText style={s.valueUsd}>${item.marketValueInUsd.toFixed(2)} USD</AppText>
                  )}
                  {isForeign && (
                    <AppText style={s.valueNative}>
                      {nativeSym}{item.marketValue.toFixed(2)} {item.currency}
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: COLORS.text },
  searchBox: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginHorizontal: SCREEN_PADDING, marginBottom: SPACE.md, backgroundColor: COLORS.card, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, height: 44, ...GLASS_BORDER, ...CARD_SHADOW },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.muted, fontWeight: "600" },
  listBody: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },
  row: { flexDirection: "row", justifyContent: "space-between", backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.sm + 2, ...GLASS_BORDER, ...CARD_SHADOW },
  symbol: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  description: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  qty: { fontSize: 11, color: COLORS.muted, fontWeight: "600", marginTop: SPACE.xs + 2 },
  valueBase: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  gainLossRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  gainLossText: { fontSize: 11, fontWeight: "600" },
  valueUsd: { fontSize: 11, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  valueNative: { fontSize: 10, color: COLORS.muted, fontWeight: "500", marginTop: 1 },
});
