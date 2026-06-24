import React, { useCallback } from "react";
import { View, Pressable, StyleSheet, Linking, Alert, ScrollView } from "react-native";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../../../theme/colors";
import { RADIUS, CARD_SHADOW, GLASS_BORDER } from "../../../../theme/designSystem";

const SUPPORT_EMAIL = "support@exxsend.com";
const SUPPORT_PHONE = "+1-800-555-1234";
const FAQ_URL = "https://help.exxsend.com";

function SupportItem({ icon, iconBg, iconColor, title, subtitle, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.item, pressed && { opacity: 0.75 }]}>
      <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor || COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={s.itemTitle}>{title}</AppText>
        <AppText style={s.itemSub}>{subtitle}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
    </Pressable>
  );
}

export default function SupportScreen() {
  const router = useRouter();

  const handleEmail = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Exxsend Support Request`).catch(() =>
      Alert.alert("Error", "Unable to open email client.")
    );
  }, []);

  const handleCall = useCallback(() => {
    Alert.alert("Call Support", `Would you like to call ${SUPPORT_PHONE}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Call", onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, "")}`).catch(() => Alert.alert("Error", "Unable to make call.")) },
    ]);
  }, []);

  const handleFAQ = useCallback(() => {
    Linking.openURL(FAQ_URL).catch(() => Alert.alert("Error", "Unable to open FAQ page."));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ width: 40 }}>{router.canGoBack() && <BackButton onPress={() => router.back()} />}</View>
          <AppText style={s.headerTitle}>Help & Support</AppText>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero */}
        <LinearGradient colors={["#315CFD", "#1E3FBF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <View style={s.heroIcon}>
            <Ionicons name="headset-outline" size={30} color="#FFFFFF" />
          </View>
          <AppText style={s.heroTitle}>We're here to help</AppText>
          <AppText style={s.heroSub}>Typically reply within a few minutes</AppText>
          <View style={s.responseTimePill}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80", marginRight: 6 }} />
            <AppText style={s.responseTimeText}>Support team online now</AppText>
          </View>
        </LinearGradient>

        {/* Contact options */}
        <AppText style={s.sectionLabel}>CONTACT US</AppText>
        <View style={s.card}>
          <SupportItem
            icon="chatbubble-ellipses-outline"
            iconBg={COLORS.primaryLight}
            title="Live Chat"
            subtitle="Chat with a support agent now"
            onPress={() => router.push("/chatsupport")}
          />
          <View style={s.divider} />
          <SupportItem
            icon="mail-outline"
            iconBg="rgba(99,102,241,0.10)"
            iconColor="#6366F1"
            title="Email us"
            subtitle={SUPPORT_EMAIL}
            onPress={handleEmail}
          />
          <View style={s.divider} />
          <SupportItem
            icon="call-outline"
            iconBg="rgba(16,185,129,0.10)"
            iconColor={COLORS.green}
            title="Call support"
            subtitle={SUPPORT_PHONE}
            onPress={handleCall}
          />
        </View>

        {/* Self-help */}
        <AppText style={s.sectionLabel}>SELF-HELP</AppText>
        <View style={s.card}>
          <SupportItem
            icon="book-outline"
            iconBg="rgba(245,158,11,0.10)"
            iconColor={COLORS.accent}
            title="Browse FAQ"
            subtitle="Find answers to common questions"
            onPress={handleFAQ}
          />
          <View style={s.divider} />
          <SupportItem
            icon="shield-outline"
            iconBg={COLORS.primaryLight}
            title="Security tips"
            subtitle="How to keep your account safe"
            onPress={() => router.push("/securityprivacy")}
          />
        </View>

        {/* Hours */}
        <View style={s.hoursBox}>
          <Ionicons name="time-outline" size={18} color={COLORS.muted} style={{ marginRight: 10 }} />
          <View>
            <AppText style={{ fontSize: 13, fontWeight: "700", color: COLORS.text }}>Support hours</AppText>
            <AppText style={{ fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 3 }}>Monday – Friday · 9am – 9pm EST</AppText>
            <AppText style={{ fontSize: 12, color: COLORS.muted, fontWeight: "600" }}>Saturday – Sunday · 10am – 6pm EST</AppText>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: COLORS.text },
  hero: { marginHorizontal: 16, marginTop: 12, borderRadius: 20, padding: 22, overflow: "hidden" },
  heroIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center", marginBottom: 14 },
  heroTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF", marginBottom: 6 },
  heroSub: { fontSize: 14, color: "rgba(255,255,255,0.80)", fontWeight: "500", marginBottom: 14 },
  responseTimePill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  responseTimeText: { fontSize: 12, color: "#FFFFFF", fontWeight: "700" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted, letterSpacing: 0.8, paddingHorizontal: 20, marginTop: 22, marginBottom: 8 },
  card: { marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  iconWrap: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 14 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  itemSub: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 3 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 72 },
  hoursBox: { flexDirection: "row", alignItems: "flex-start", marginHorizontal: 16, marginTop: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 16, ...GLASS_BORDER, ...CARD_SHADOW },
});
