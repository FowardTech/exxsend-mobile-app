import React, { useEffect, useState, useCallback } from "react";
import { View, Pressable, ActivityIndicator, StyleSheet, ScrollView, Alert } from "react-native";
import AppText from "../../../../AppText";
import BackButton from "../../../../BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearCachedPin } from "../../../../../utils/pinCache";
import { LinearGradient } from "expo-linear-gradient";
import { getUserProfile } from "../../../../../api/config";
import { toHandle } from "../../../../../utils/handle";
import { COLORS } from "../../../../../theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "../../../../../theme/designSystem";

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  rightText?: string;
  onPress?: () => void;
  danger?: boolean;
  showChev?: boolean;
}

function MenuRow({ icon, iconBg, iconColor, title, subtitle, rightText, onPress, danger, showChev = true }: MenuRowProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.menuRow, pressed && { opacity: 0.7 }]}>
      <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor || (danger ? COLORS.red : COLORS.primary)} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={[s.menuTitle, danger && { color: COLORS.red }]}>{title}</AppText>
        {!!subtitle && <AppText style={s.menuSub}>{subtitle}</AppText>}
      </View>
      {!!rightText && <AppText style={s.rightText}>{rightText}</AppText>}
      {showChev && <Ionicons name="chevron-forward" size={16} color={COLORS.border} style={{ marginLeft: 6 }} />}
    </Pressable>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <View style={s.section}>{children}</View>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{ fullName: string; email: string; phone?: string } | null>(null);
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user_info");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUserInfo({ fullName: `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim() || "User", email: parsed.email || "" });
          setHandle(toHandle(parsed.firstName, parsed.lastName));
        }
        const cachedKyc = await AsyncStorage.getItem("user_kyc_status");
        if (cachedKyc) setVerified(cachedKyc === "verified");
        const phone = await AsyncStorage.getItem("user_phone");
        if (phone) {
          const result = await getUserProfile(phone);
          if (result.success && result.user) {
            const { firstName, lastName, email, kycStatus } = result.user;
            setUserInfo({ fullName: `${firstName || ""} ${lastName || ""}`.trim() || "User", email: email || "", phone });
            setHandle(toHandle(firstName, lastName));
            if (kycStatus) { setVerified(kycStatus === "verified"); AsyncStorage.setItem("user_kyc_status", kycStatus); }
          }
        }
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const requireVerified = useCallback((action: () => void) => {
    if (!verified) {
      Alert.alert("Verification Required", "Please complete identity verification to use this feature.");
      return;
    }
    action();
  }, [verified]);

  const logout = useCallback(async () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: async () => {
        try { await AsyncStorage.clear(); } catch {}
        try { await clearCachedPin(); } catch {}
        finally { router.replace("/login"); }
      }},
    ]);
  }, [router]);

  const initials = userInfo?.fullName?.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "U";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <BackButton onPress={() => router.back()} />
          <AppText style={s.headerTitle}>Profile</AppText>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar Hero */}
        <LinearGradient colors={["#315CFD", "#315CFD"]} style={s.heroBanner}>
          <View style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.07)" }} />
        </LinearGradient>

        <View style={s.avatarSection}>
          <View style={s.avatarRing}>
            <View style={s.avatarCircle}>
              <AppText style={s.avatarInitials}>{initials}</AppText>
            </View>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <AppText style={s.profileName}>{userInfo?.fullName || "User"}</AppText>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
              </View>
              {!!handle && <AppText style={s.profileHandle}>{handle}</AppText>}
              <AppText style={s.profileEmail}>{userInfo?.email}</AppText>
            </>
          )}
        </View>

        {/* Account */}
        <AppText style={s.sectionLabel}>ACCOUNT</AppText>
        <Section>
          <MenuRow icon="person-outline" iconBg={COLORS.primaryLight} title="Account information" subtitle="View and update your details" onPress={() => requireVerified(() => router.push("/accountInfo"))}
          />
          <View style={s.divider} />
          <MenuRow icon="people-outline" iconBg={COLORS.primaryLight} title="Saved recipients" subtitle="Manage your saved recipients" onPress={() => requireVerified(() => router.push("/recipientsmanagement" as any))} />
          <View style={s.divider} />
          <MenuRow icon="speedometer-outline" iconBg="rgba(245,158,11,0.12)" iconColor={COLORS.accent} title="Account limits" subtitle="View transfer and balance limits" onPress={() => requireVerified(() => router.push("/accountlimit"))} />
          <View style={s.divider} />
          <MenuRow icon="globe-outline" iconBg="rgba(59,130,246,0.10)" iconColor="#3B82F6" title="Global accounts" subtitle="Receive money in multiple currencies" onPress={() => requireVerified(() => router.push("/globalaccount"))} />
        </Section>

        {/* Security */}
        <AppText style={s.sectionLabel}>SECURITY</AppText>
        <Section>
          <MenuRow icon="shield-checkmark-outline" iconBg={COLORS.primaryLight} title="Security & privacy" subtitle="Biometrics, PIN, and more" onPress={() => requireVerified(() => router.push("/securityprivacy"))} />
          <View style={s.divider} />
          <MenuRow icon="key-outline" iconBg="rgba(239,68,68,0.10)" iconColor={COLORS.red} title="Change PIN" subtitle="Update your transaction PIN" onPress={() => requireVerified(() => router.push("/pin"))} />
        </Section>

        {/* Support */}
        <AppText style={s.sectionLabel}>SUPPORT</AppText>
        <Section>
          <MenuRow icon="headset-outline" iconBg="rgba(16,185,129,0.10)" iconColor={COLORS.primary} title="Help & support" subtitle="Chat with us or browse FAQs" onPress={() => router.push("/support")} />
          <View style={s.divider} />
          <MenuRow icon="notifications-outline" iconBg={COLORS.primaryLight} title="Notification preferences" subtitle="Control what you hear from us" onPress={() => router.push("/notificationpref" as any)} />
          <View style={s.divider} />
          <MenuRow icon="information-circle-outline" iconBg="rgba(99,102,241,0.10)" iconColor="#6366F1" title="About Exxsend" subtitle="Version 5.15.0" showChev={false} />
        </Section>

        {/* Refer */}
        <Pressable onPress={() => router.push("/referral")} style={s.referralRow}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.accentLight, justifyContent: "center", alignItems: "center", marginRight: 12 }}>
            <Ionicons name="gift-outline" size={20} color={COLORS.accentDark} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: "700", color: COLORS.text }}>Refer a friend</AppText>
            <AppText style={{ fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 2 }}>Earn 3% on their first transfer</AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
        </Pressable>

        {/* Logout */}
        <Pressable onPress={logout} style={s.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
          <AppText style={s.logoutText}>Log out</AppText>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.sm, paddingBottom: SPACE.xs + 2, flexDirection: "row", alignItems: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: COLORS.text },
  heroBanner: { height: 90, marginHorizontal: SCREEN_PADDING, borderRadius: RADIUS.lg, overflow: "hidden" },
  avatarSection: { alignItems: "center", marginTop: -40 },
  avatarRing: { width: 84, height: 84, borderRadius: RADIUS.full, backgroundColor: "#FFFFFF", padding: 3, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  avatarCircle: { flex: 1, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center" },
  avatarInitials: { color: "#FFFFFF", fontWeight: "700", fontSize: 26 },
  profileName: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  profileHandle: { fontSize: 13, color: COLORS.primary, fontWeight: "700", marginTop: 3 },
  profileEmail: { fontSize: 13, color: COLORS.muted, fontWeight: "600", marginTop: 4, marginBottom: SPACE.sm },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted, letterSpacing: 0.8, paddingHorizontal: SPACE.xl, marginTop: SPACE.xl, marginBottom: SPACE.sm },
  section: { marginHorizontal: SCREEN_PADDING, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SCREEN_PADDING, paddingVertical: SPACE.lg - 2 },
  iconWrap: { width: 40, height: 40, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", marginRight: SPACE.md },
  menuTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  menuSub: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  rightText: { fontSize: 13, fontWeight: "600", color: COLORS.primary, marginRight: 6 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 68 },
  referralRow: { marginHorizontal: SCREEN_PADDING, marginTop: SPACE.lg - 2, backgroundColor: COLORS.accentLight, borderRadius: RADIUS.lg, padding: SPACE.lg, flexDirection: "row", alignItems: "center" },
  logoutBtn: { marginHorizontal: SCREEN_PADDING, marginTop: SPACE.lg - 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, paddingVertical: SPACE.lg, borderRadius: RADIUS.md, backgroundColor: "rgba(239,68,68,0.08)" },
  logoutText: { color: COLORS.red, fontWeight: "700", fontSize: 15 },
});
