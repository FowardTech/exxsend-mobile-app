import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { getCurrencySymbol } from "@/api/flutterwave";
import { getTaxReport, TaxLot } from "@/api/investments";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function InvestTaxReportScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [dividendIncome, setDividendIncome] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [realizedGains, setRealizedGains] = useState(0);
  const [realizedLoss, setRealizedLoss] = useState(0);
  const [netRealized, setNetRealized] = useState(0);
  const [lots, setLots] = useState<TaxLot[]>([]);
  const [disclaimer, setDisclaimer] = useState("");

  const load = useCallback(async (targetYear: number) => {
    setLoading(true);
    try {
      const phone = (await AsyncStorage.getItem("user_phone")) || "";
      if (!phone) { setLoading(false); return; }
      const res = await getTaxReport(phone, targetYear);
      if (res.subscriptionRequired) {
        router.replace("/investpaywall" as any);
        return;
      }
      setBaseCurrency(res.baseCurrency || "USD");
      setDividendIncome(res.dividendIncome);
      setTotalFees(res.totalFees);
      setRealizedGains(res.realizedGains);
      setRealizedLoss(res.realizedLoss);
      setNetRealized(res.netRealized);
      setLots(res.lots);
      setDisclaimer(res.disclaimer || "Informational estimate using FIFO lot matching. Not a tax filing document.");
    } catch {}
    setLoading(false);
  }, [router]);

  useEffect(() => { load(year); }, [year, load]);

  const sym = getCurrencySymbol(baseCurrency);
  const currentYear = new Date().getFullYear();

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)} showLabel={false} />
        <AppText style={s.headerTitle}>Tax Report</AppText>
        <View style={{ width: 34 }} />
      </View>

      {/* Year picker */}
      <View style={s.yearRow}>
        <Pressable onPress={() => setYear((y) => y - 1)} style={s.yearBtn}>
          <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
        </Pressable>
        <AppText style={s.yearText}>{year}</AppText>
        <Pressable onPress={() => setYear((y) => y + 1)} disabled={year >= currentYear} style={[s.yearBtn, year >= currentYear && { opacity: 0.35 }]}>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {/* Summary */}
          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <SummaryItem label="Dividend Income" value={dividendIncome} sym={sym} positive />
              <SummaryItem label="Total Fees" value={totalFees} sym={sym} />
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryRow}>
              <SummaryItem label="Realized Gains" value={realizedGains} sym={sym} positive />
              <SummaryItem label="Realized Loss" value={realizedLoss} sym={sym} />
            </View>
            <View style={s.summaryDivider} />
            <View style={{ alignItems: "center" }}>
              <AppText style={s.netLabel}>Net Realized</AppText>
              <AppText style={[s.netValue, { color: netRealized >= 0 ? COLORS.green : COLORS.red }]}>
                {netRealized >= 0 ? "+" : ""}{sym}{netRealized.toFixed(2)}
              </AppText>
            </View>
          </View>

          <AppText style={s.disclaimer}>{disclaimer}</AppText>

          {/* Lots */}
          <AppText style={s.sectionTitle}>Realized lots (FIFO)</AppText>
          {lots.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="document-text-outline" size={28} color={COLORS.muted} />
              <AppText style={s.emptyText}>No realized lots for {year}.</AppText>
            </View>
          ) : (
            lots.map((lot, i) => (
              <View key={i} style={s.lotRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={s.lotSymbol}>{lot.symbol}</AppText>
                  <AppText style={s.lotDate}>{formatDate(lot.tradeDate)} · {lot.quantity} shares</AppText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <AppText style={[s.lotGain, { color: lot.gainLossInBase >= 0 ? COLORS.green : COLORS.red }]}>
                    {lot.gainLossInBase >= 0 ? "+" : ""}{sym}{lot.gainLossInBase.toFixed(2)}
                  </AppText>
                  <AppText style={s.lotDetail}>
                    {sym}{lot.proceedsInBase.toFixed(2)} − {sym}{lot.costBasisInBase.toFixed(2)}
                  </AppText>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SummaryItem({ label, value, sym, positive }: { label: string; value: number; sym: string; positive?: boolean }) {
  const color = positive ? COLORS.green : value < 0 ? COLORS.red : COLORS.text;
  return (
    <View style={{ flex: 1 }}>
      <AppText style={s.summaryLabel}>{label}</AppText>
      <AppText style={[s.summaryValue, { color }]}>{sym}{Math.abs(value).toFixed(2)}</AppText>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },

  yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xl, marginBottom: SPACE.lg },
  yearBtn: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...GLASS_BORDER, ...CARD_SHADOW },
  yearText: { fontSize: 18, fontWeight: "600", color: COLORS.text, minWidth: 60, textAlign: "center" },

  summaryCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl, ...GLASS_BORDER, ...CARD_SHADOW },
  summaryRow: { flexDirection: "row" },
  summaryLabel: { fontSize: 11, fontWeight: "600", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  summaryValue: { fontSize: 18, fontWeight: "600", marginTop: 4 },
  summaryDivider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACE.lg },
  netLabel: { fontSize: 12, fontWeight: "600", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  netValue: { fontSize: 26, fontWeight: "600", marginTop: 4 },

  disclaimer: { fontSize: 11, color: COLORS.muted, textAlign: "center", marginTop: SPACE.md, lineHeight: 16, paddingHorizontal: SPACE.md },

  sectionTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginTop: SPACE.xxl, marginBottom: SPACE.md },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xxxl, alignItems: "center", gap: SPACE.md, ...GLASS_BORDER, ...CARD_SHADOW },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },

  lotRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.sm, ...GLASS_BORDER, ...CARD_SHADOW },
  lotSymbol: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  lotDate: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  lotGain: { fontSize: 14, fontWeight: "600" },
  lotDetail: { fontSize: 11, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
});
