import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import AppText from "./AppText";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useAppTheme } from "../theme/ThemeProvider";
import { ColorTokens } from "../theme/palettes";

interface PromoCard {
  key: string;
  title: string;
  subtitle: string;
  bg: "gradient" | "light";
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export default function HomeQuickActionsCarousel() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [showBiometricCard, setShowBiometricCard] = useState(false);
  const [bioEnabledConfirmed, setBioEnabledConfirmed] = useState(false);
  // Fail-closed (defaults false) until the cached KYC status loads, same
  // as the Profile and tab-bar verification gates — a cold-start tap on
  // either promo card can't slip through before it resolves.
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [enabledFlag, hasHardware, isEnrolled, kycStatus] = await Promise.all([
          AsyncStorage.getItem("biometric_enabled"),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          AsyncStorage.getItem("user_kyc_status"),
        ]);
        // Only worth promoting if the device actually supports it, it's
        // enrolled at the OS level, and the user hasn't already turned it on.
        if (mounted) {
          setShowBiometricCard(hasHardware && isEnrolled && enabledFlag !== "true");
          setBioEnabledConfirmed(enabledFlag === "true");
          setVerified(kycStatus === "verified");
        }
      } catch {
        if (mounted) { setShowBiometricCard(false); setBioEnabledConfirmed(false); }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const blocked = () => Alert.alert("Verification Required", "Please complete identity verification to use this feature.");

  const cards: PromoCard[] = [];

  if (showBiometricCard) {
    cards.push({
      key: "biometrics",
      title: "Enable Biometric",
      subtitle: "Login and approve transfers with your face ID or fingerprint",
      bg: "gradient",
      icon: "finger-print",
      onPress: () => verified ? router.push("/securityprivacy") : blocked(),
    });
  } else if (bioEnabledConfirmed) {
    // Once biometric is already on, the same gradient card slot switches
    // to promoting Scan to Pay instead of just disappearing — same visual
    // weight, new purpose, rather than losing a promo slot entirely.
    cards.push({
      key: "scantopay",
      title: "Scan to pay",
      subtitle: "Scan another ExxSend user's code to send them money instantly",
      bg: "gradient",
      icon: "qr-code-outline",
      onPress: () => router.push("/scantopay"),
    });
  }

  cards.push({
    key: "rates",
    title: "Rate Alert",
    subtitle: "Get notified when a currency rate hits your target",
    bg: "light",
    icon: "trending-up",
    onPress: () => verified ? router.push("/ratealerts") : blocked(),
  });

  return (
    <View style={s.wrap}>
      <AppText style={s.sectionTitle}>Quick actions</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollRow}
      >
        {cards.map((card) => (
          <PromoCardView key={card.key} card={card} s={s} colors={colors} />
        ))}
      </ScrollView>
    </View>
  );
}

function PromoCardView({ card, s, colors }: { card: PromoCard; s: ReturnType<typeof makeStyles>; colors: ColorTokens }) {
  const isGradient = card.bg === "gradient";

  const content = (
    <>
      <View style={s.cardTextWrap}>
        <AppText style={[s.cardTitle, isGradient && s.cardTitleLight]}>{card.title}</AppText>
        <AppText style={[s.cardSubtitle, isGradient && s.cardSubtitleLight]}>{card.subtitle}</AppText>
      </View>

      <View style={s.illustrationWrap}>
        <View style={[s.illustrationCircle, isGradient ? s.illustrationCircleLight : s.illustrationCircleTint]}>
          <Ionicons
            name={card.icon}
            size={30}
            color={isGradient ? "#FFFFFF" : colors.primary}
          />
        </View>
      </View>
    </>
  );

  if (isGradient) {
    return (
      <Pressable onPress={card.onPress} style={s.cardPressable}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.card}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={card.onPress} style={[s.cardPressable, s.card, s.cardLight]}>
      {content}
    </Pressable>
  );
}

const CARD_WIDTH = 168;
const CARD_HEIGHT = 150;

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { marginTop: 8 },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginHorizontal: 20, marginBottom: 12 },
    scrollRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
    cardPressable: { width: CARD_WIDTH },
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 18,
      padding: 16,
      justifyContent: "space-between",
      overflow: "hidden",
    },
    cardLight: {
      backgroundColor: colors.primaryLight,
    },
    cardTextWrap: { flex: 1 },
    cardTitle: { fontSize: 14, fontWeight: "700", color: colors.text, lineHeight: 19 },
    cardTitleLight: { color: "#FFFFFF" },
    cardSubtitle: { fontSize: 11, fontWeight: "500", color: colors.muted, marginTop: 6, lineHeight: 15 },
    cardSubtitleLight: { color: "rgba(255,255,255,0.85)" },
    illustrationWrap: { flexDirection: "row", justifyContent: "flex-end" },
    illustrationCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    illustrationCircleLight: { backgroundColor: "rgba(255,255,255,0.2)" },
    illustrationCircleTint: { backgroundColor: colors.card },
  });
}
