/**
 * AddMoneyMethodsScreen
 *
 * For CAD wallets → shows Card / Interac / EFT (Paysafe)
 * For non-CAD wallets → redirects straight to /add-money/local (Flutterwave)
 * If accessed with no currencyCode → shows CAD methods as default
 */
import { COLORS } from "@/theme/colors";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../../../../components/ScreenHeader";
import AppText from "../../../AppText";

interface Method {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  fee: string;
  eta: string;
  feeColor?: string;
  etaBg?: string;
  route: string;
}

const CAD_METHODS: Method[] = [
  {
    id: "card",
    icon: <Ionicons name="card-outline" size={22} color={COLORS.primary} />,
    iconBg: COLORS.primaryLight,
    title: "Credit / Debit Card",
    subtitle: "Visa, Mastercard or Amex — instant deposit",
    fee: "2.9% + $0.30",
    eta: "Instant",
    feeColor: COLORS.textSecondary,
    etaBg: COLORS.greenSoft,
    route: "/addmoneycard",
  },
  {
    id: "interac",
    icon: <AppText style={{ fontWeight: "600", fontSize: 11, color: "#8B6000" }}>INTERAC</AppText>,
    iconBg: "#FEF3C7",
    title: "INTERAC e-Transfer®",
    subtitle: "Canadian bank transfer — funds in minutes",
    fee: "Free",
    eta: "Minutes",
    feeColor: COLORS.green,
    etaBg: COLORS.greenSoft,
    route: "/addmoneyinterac",
  },
  {
    id: "eft",
    icon: <MaterialCommunityIcons name="bank-outline" size={22} color={COLORS.primary} />,
    iconBg: COLORS.primaryLight,
    title: "Bank Transfer (EFT)",
    subtitle: "Direct bank wire — no fees, worldwide",
    fee: "Free",
    eta: "1–3 days",
    feeColor: COLORS.green,
    etaBg: "#F0F4FA",
    route: "/addmoneyeft",
  },
];

export default function AddMoneyMethodsScreen() {
  const params = useLocalSearchParams<{ currencyCode?: string; accountId?: string }>();
  const ccy = (params.currencyCode || "CAD").toUpperCase();
  const isCAD = ccy === "CAD" || !params.currencyCode;

  // Non-CAD wallets → immediately redirect to local deposit screen
  useEffect(() => {
    if (!isCAD) {
      router.replace(`/add-money/local?currency=${ccy}` as any);
    }
  }, [isCAD, ccy]);

  if (!isCAD) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <ScreenHeader title="Add Money" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScreenHeader title="Add Money (CAD)" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <AppText style={s.sectionLabel}>CHOOSE A METHOD</AppText>

        {CAD_METHODS.map((m) => (
          <Pressable
            key={m.id}
            onPress={() =>
              router.push({
                pathname: m.route as any,
                params: { currencyCode: ccy, accountId: params.accountId },
              })
            }
            style={({ pressed }) => [s.card, pressed && { opacity: 0.75 }]}
          >
            <View style={[s.iconWrap, { backgroundColor: m.iconBg }]}>{m.icon}</View>
            <View style={s.cardBody}>
              <AppText style={s.cardTitle}>{m.title}</AppText>
              <AppText style={s.cardSub}>{m.subtitle}</AppText>
              <View style={s.metaRow}>
                <View style={s.metaItem}>
                  <Ionicons name="pricetag-outline" size={11} color={COLORS.muted} />
                  <AppText style={[s.metaFee, { color: m.feeColor || COLORS.muted }]}>{m.fee}</AppText>
                </View>
                <View style={{ width: 1, height: 12, backgroundColor: COLORS.borderLight }} />
                <View style={[s.metaItem, { backgroundColor: m.etaBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }]}>
                  <Ionicons name="time-outline" size={11} color={COLORS.green} />
                  <AppText style={s.metaEta}>{m.eta}</AppText>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
          </Pressable>
        ))}

        <View style={s.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} style={{ marginRight: 8, marginTop: 1 }} />
          <AppText style={s.infoText}>All transactions are secured with 256-bit encryption and monitored 24/7.</AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: COLORS.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 14 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.borderLight, },
  iconWrap: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 14, flexShrink: 0 },
  cardBody: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginBottom: 3 },
  cardSub: { fontSize: 12, color: COLORS.muted, fontWeight: "500", lineHeight: 17, marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaFee: { fontSize: 11, fontWeight: "600" },
  metaEta: { fontSize: 11, fontWeight: "600", color: COLORS.green },
  infoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14, marginTop: 8 },
  infoText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: "600", lineHeight: 18 },
});
