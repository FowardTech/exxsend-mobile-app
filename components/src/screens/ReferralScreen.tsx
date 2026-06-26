import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Pressable, ScrollView, Share, ActivityIndicator, StyleSheet, Alert } from "react-native";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMyReferralCode, getReferralPublicConfig } from "../../../api/config";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useStyles } from "../../../theme/styles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import * as Clipboard from "expo-clipboard";

function StepRow({ num, title, subtitle }: { num: string; title: string; subtitle: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
        <AppText style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>{num}</AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{title}</AppText>
        <AppText style={{ fontSize: 13, color: colors.muted, fontWeight: "500", marginTop: 3, lineHeight: 18 }}>{subtitle}</AppText>
      </View>
    </View>
  );
}

export default function ReferralScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [referralCode, setReferralCode] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  // Admin-configured reward — this used to be hardcoded as "3%" everywhere
  // on this screen (and before that, fetched from the wrong endpoint
  // entirely with no flat-bonus handling), which is why it never actually
  // showed up. rewardText is pre-formatted per the documented rendering
  // rule: "3%" for a percentage bonus, "5 CAD" for a flat one.
  const [rewardText, setRewardText] = useState<string | null>(null);

  const fetchReferralData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const phone = await AsyncStorage.getItem("user_phone");
      if (!token || !phone) { setLoading(false); return; }
      const [codeResult, configResult] = await Promise.all([
        getMyReferralCode(token, phone),
        getReferralPublicConfig(),
      ]);
      if (codeResult.success) {
        setReferralCode(codeResult.referral_code || "");
        setReferralLink(codeResult.referral_link || "");
      }
      if (configResult.success && configResult.rewardText) {
        setRewardText(configResult.rewardText);
      }
    } catch (e) {
      console.error("Failed to fetch referral data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReferralData(); }, [fetchReferralData]);

  const handleCopyLink = async () => {
    if (!referralLink) return;
    await Clipboard.setStringAsync(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleShare = async () => {
    if (!referralCode || !referralLink) return;
    try {
      await Share.share({
        message: `Join me on Exxsend for fast, low-cost international transfers! Use my referral code: ${referralCode}\n\n${referralLink}`,
        title: "Invite Friends to Exxsend",
      });
    } catch (error: any) {
      if (error.message !== "User did not share") console.error("Share error:", error);
    }
  };

  const s = useMemo(() => StyleSheet.create({

  // Hero
  hero: {
    paddingTop: 56, paddingBottom: 36, paddingHorizontal: 24,
    overflow: "hidden",
  },
  backBtn: {
    position: "absolute", top: 14, left: 16,
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
  },
  heroIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  heroTitle: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginBottom: 8 },
  heroSub:   { fontSize: 15, color: "rgba(255,255,255,0.85)", fontWeight: "500", lineHeight: 22 },
  rewardPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", marginTop: 18,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: colors.accentLight,
  },
  rewardPillText: { fontSize: 13, fontWeight: "700", color: colors.accentDark },
  leaderboardLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  leaderboardLinkText: { fontSize: 12.5, fontWeight: "700", color: "#FFFFFF" },

  // Sections
  section: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: colors.card, borderRadius: 20,
    padding: 18, borderWidth: 1, borderColor: colors.borderLight,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 16 },

  // Steps
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepNum: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: "center", alignItems: "center",
    flexShrink: 0,
  },
  stepNumText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  stepTitle:   { fontSize: 15, fontWeight: "700", color: colors.text },
  stepSub:     { fontSize: 13, color: colors.muted, fontWeight: "500", marginTop: 3, lineHeight: 18 },
  stepDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 14, marginLeft: 46 },

  // Code box
  loadingBox: { height: 60, justifyContent: "center", alignItems: "center" },
  codeBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.primaryLight, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1.5, borderColor: colors.border,
    borderStyle: "dashed",
  },
  codeText: { fontSize: 22, fontWeight: "700", color: colors.primary, letterSpacing: 4 },

  // Link box
  linkBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bg, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  linkText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.textSecondary },

  // Copy pill
  copyPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.border,
  },
  copyPillDone: { backgroundColor: colors.greenSoft, borderColor: colors.greenLight },
  copyPillText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  // Share button
  shareBtn: { marginHorizontal: 16, marginTop: 20, borderRadius: 18, overflow: "hidden", backgroundColor: colors.actionBg },
  shareBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 18,
  },
  shareBtnText: { color: colors.actionText, fontSize: 16, fontWeight: "700" },

  // Terms
  termsBox: { marginHorizontal: 16, marginTop: 16, gap: 10 },
  termRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  termText: { flex: 1, fontSize: 12, color: colors.muted, fontWeight: "600", lineHeight: 18 },
  }), [colors]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Hero ── */}
        <LinearGradient
          colors={["#315CFD", "#1E3FBF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          {/* decorative circles */}
          <View style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <View style={{ position: "absolute", left: -20, bottom: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)" }} />

          <BackButton onPress={() => router.back()} color="#FFFFFF" />

          <View style={s.heroIconWrap}>
            <Ionicons name="gift" size={36} color="#FFFFFF" />
          </View>
          <AppText style={s.heroTitle}>Invite & Earn</AppText>
          <AppText style={s.heroSub}>
            {rewardText
              ? `Share Exxsend and earn ${rewardText} on your friend's first transfer`
              : "Share Exxsend and earn a cash bonus on your friend's first transfer"}
          </AppText>

          {/* Reward pill */}
          <View style={s.rewardPill}>
            <Ionicons name="star" size={14} color={colors.accentDark} />
            <AppText style={s.rewardPillText}>
              {rewardText ? `${rewardText} Cash Bonus per referral` : "Cash Bonus per referral"}
            </AppText>
          </View>

          <Pressable onPress={() => router.push("/referralleaderboard" as any)} style={s.leaderboardLink}>
            <Ionicons name="trophy-outline" size={14} color="#FFFFFF" />
            <AppText style={s.leaderboardLinkText}>See the leaderboard</AppText>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        {/* ── How it works ── */}
        <View style={s.section}>
          <AppText style={s.sectionTitle}>How it works</AppText>
          <StepRow num="1" title="Share your link" subtitle="Send your unique referral link or code to a friend" />
          <View style={s.stepDivider} />
          <StepRow num="2" title="They sign up" subtitle="Your friend creates an account using your link" />
          <View style={s.stepDivider} />
          <StepRow
            num="3"
            title={rewardText ? `You earn ${rewardText}` : "You earn a bonus"}
            subtitle={rewardText ? `Get ${rewardText} of their first transfer credited to your wallet` : "Get a bonus credited to your wallet from their first transfer"}
          />
        </View>

        {/* ── Referral Code ── */}
        <View style={s.section}>
          <AppText style={s.sectionTitle}>Your referral code</AppText>

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <Pressable onPress={handleCopyCode} style={s.codeBox}>
              <AppText style={s.codeText}>{referralCode || "------"}</AppText>
              <View style={[s.copyPill, copiedCode && s.copyPillDone]}>
                <Ionicons name={copiedCode ? "checkmark" : "copy-outline"} size={14} color={copiedCode ? colors.green : colors.primary} />
                <AppText style={[s.copyPillText, copiedCode && { color: colors.green }]}>
                  {copiedCode ? "Copied!" : "Copy code"}
                </AppText>
              </View>
            </Pressable>
          )}
        </View>

        {/* ── Referral Link ── */}
        <View style={s.section}>
          <AppText style={s.sectionTitle}>Your referral link</AppText>

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <Pressable onPress={handleCopyLink} style={s.linkBox}>
              <AppText style={s.linkText} numberOfLines={1} ellipsizeMode="middle">
                {referralLink || "Loading your link…"}
              </AppText>
              <View style={[s.copyPill, copiedLink && s.copyPillDone]}>
                <Ionicons name={copiedLink ? "checkmark" : "copy-outline"} size={14} color={copiedLink ? colors.green : colors.primary} />
                <AppText style={[s.copyPillText, copiedLink && { color: colors.green }]}>
                  {copiedLink ? "Copied!" : "Copy"}
                </AppText>
              </View>
            </Pressable>
          )}
        </View>

        {/* ── Share CTA ── */}
        <Pressable
          onPress={handleShare}
          disabled={loading || !referralLink}
          style={({ pressed }) => [s.shareBtn, (loading || !referralLink) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
        >
          <View style={s.shareBtnInner}>
            <Ionicons name="share-social-outline" size={20} color={colors.actionText} />
            <AppText style={s.shareBtnText}>Share with Friends</AppText>
          </View>
        </Pressable>

        {/* ── Terms ── */}
        <View style={s.termsBox}>
          <View style={s.termRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
            <AppText style={s.termText}>One referral code can be used per account.</AppText>
          </View>
          <View style={s.termRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
            <AppText style={s.termText}>Bonus applies to your friend's first transfer only.</AppText>
          </View>
          <View style={s.termRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
            <AppText style={s.termText}>Rewards are credited within 3 business days.</AppText>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
