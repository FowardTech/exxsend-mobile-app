import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppText from "@/components/AppText";
import AppTextInput from "@/components/AppTextInput";
import BackButton from "@/components/BackButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { getCurrencySymbol } from "@/api/flutterwave";
import { getSnapTradeHoldings, Holding } from "@/api/investments";

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
      } catch {}
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
        <BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)} />
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
                  <AppText style={s.valueUsd}>${item.marketValueInUsd.toFixed(2)} USD</AppText>
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: COLORS.text },
  searchBox: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginHorizontal: SCREEN_PADDING, marginBottom: SPACE.md, backgroundColor: COLORS.card, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, height: 44, ...GLASS_BORDER, ...CARD_SHADOW },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.muted, fontWeight: "600" },
  listBody: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },
  row: { flexDirection: "row", justifyContent: "space-between", backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.sm + 2, ...GLASS_BORDER, ...CARD_SHADOW },
  symbol: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  description: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  qty: { fontSize: 11, color: COLORS.muted, fontWeight: "600", marginTop: SPACE.xs + 2 },
  valueBase: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  valueUsd: { fontSize: 11, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  valueNative: { fontSize: 10, color: COLORS.muted, fontWeight: "500", marginTop: 1 },
});
