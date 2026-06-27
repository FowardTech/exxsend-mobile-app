import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Alert, Image } from "react-native";
import AppText from "./AppText";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { COLORS } from "../theme/colors";
import { SPACE, RADIUS, GLASS_BORDER } from "../theme/designSystem";

interface AppLockScreenProps {
  onUnlock: () => void;
}

type BioOption = "face" | "fingerprint";

export default function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const router = useRouter();
  // Detected independently rather than one overriding the other — a
  // device can genuinely report both (e.g. some Android phones expose
  // both a fingerprint sensor and face unlock), and previously this
  // always silently preferred Face ID even when fingerprint was also
  // available, never actually giving a choice.
  const [hasFace, setHasFace] = useState(false);
  const [hasFingerprint, setHasFingerprint] = useState(false);
  const [savedUserName, setSavedUserName] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState<BioOption | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setHasFace(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION));
        setHasFingerprint(types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT));
      } catch {}
      try {
        const storedUser = await AsyncStorage.getItem("user_info");
        if (storedUser) {
          const u = JSON.parse(storedUser);
          setSavedUserName(u.firstName || u.first_name || u.name || null);
          setProfilePhotoUrl(u.profilePhotoUrl || null);
        }
      } catch {}
    })();
    // Biometric no longer fires automatically on mount — the user gets a
    // genuine, equal choice between biometric and password from the
    // start, rather than a prompt that pops up immediately with password
    // buried as an escape hatch underneath it.
  }, []);

  // Both options ultimately call the same native authenticateAsync — iOS
  // and Android don't expose a way for an app to force "use fingerprint
  // specifically" vs "use Face ID specifically," that choice happens at
  // the OS level based on what's actually enrolled. Showing both lets the
  // user pick whichever they think of as "theirs," but which sensor
  // physically runs is still up to the device.
  const attemptUnlock = async (option: BioOption) => {
    if (authenticating) return;
    setAuthenticating(option);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Exxsend",
        fallbackLabel: "Use password",
      });
      if (result.success) {
        onUnlock();
      }
    } catch {
      Alert.alert("Authentication failed", "Please try again.");
    } finally {
      setAuthenticating(null);
    }
  };

  const usePasswordInstead = async () => {
    try {
      await AsyncStorage.removeItem("auth_token");
    } catch {}
    onUnlock();
    router.replace("/login");
  };

  const showBothOptions = hasFace && hasFingerprint;

  return (
    <View style={s.root}>
      <LinearGradient colors={["transparent", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.avatarRing}>
          {profilePhotoUrl ? (
            <Image source={{ uri: profilePhotoUrl }} style={s.avatarImage} />
          ) : (
            <View style={s.avatarFallback}>
              <Ionicons name="person" size={30} color="#FFFFFF" />
            </View>
          )}
        </View>
        <AppText style={s.brandBarText}>Exxsend</AppText>
      </LinearGradient>

      <View style={s.body}>
        <AppText style={s.welcomeTitle}>
          Welcome Back{savedUserName ? `, ${savedUserName} 👋` : ""}
        </AppText>
        <AppText style={s.welcomeSub}>Choose how you'd like to sign in</AppText>

        {hasFace && (
          <Pressable onPress={() => attemptUnlock("face")} disabled={!!authenticating} style={[s.bioCard, authenticating === "face" && s.bioCardActive]}>
            <View style={[s.bioIconCircle, { backgroundColor: "transparent" }]}>
              <Ionicons name="scan-outline" size={34} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.optionTitle}>Face ID</AppText>
              <AppText style={s.optionSub}>Unlock instantly by looking at your phone</AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </Pressable>
        )}

        {hasFingerprint && (
          <Pressable onPress={() => attemptUnlock("fingerprint")} disabled={!!authenticating} style={[s.bioCard, authenticating === "fingerprint" && s.bioCardActive]}>
            <View style={[s.bioIconCircle, { backgroundColor: "transparent" }]}>
              <Ionicons name="finger-print-outline" size={34} color={COLORS.primaryMid} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.optionTitle}>Fingerprint</AppText>
              <AppText style={s.optionSub}>{showBothOptions ? "Or unlock with your fingerprint" : "Unlock instantly with your fingerprint"}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </Pressable>
        )}

        <Pressable onPress={usePasswordInstead} style={[s.passwordCard, !hasFace && !hasFingerprint && { marginTop: 0 }]}>
          <View style={s.passwordIconCircle}>
            <Ionicons name="key-outline" size={30} color={COLORS.text} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={s.optionTitle}>Password</AppText>
            <AppText style={s.optionSub}>Sign in with your password</AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    paddingTop: 64, paddingBottom: 28, alignItems: "center",
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 8 }, 
  },
  avatarRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center", marginBottom: SPACE.md },
  avatarImage: { width: 68, height: 68, borderRadius: 34 },
  avatarFallback: { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  brandBarText: { color: COLORS.text, fontSize: 20, fontWeight: "600", letterSpacing: 0.3 },
  body: { flex: 1, paddingHorizontal: SPACE.xxl, paddingTop: SPACE.xxxl },
  welcomeTitle: { fontSize: 22, fontWeight: "600", color: COLORS.text, lineHeight: 32, textAlign: "center" },
  welcomeSub: { fontSize: 14, color: COLORS.muted, marginTop: SPACE.sm, marginBottom: SPACE.xxxl, textAlign: "center" },
  bioCard: {
    flexDirection: "row", alignItems: "center", gap: SPACE.lg,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACE.lg, marginBottom: SPACE.md,
    borderColor: COLORS.border,
    
  },
  bioCardActive: { opacity: 0.6 },
  bioIconCircle: { width: 64, height: 64, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" },
  passwordCard: {
    flexDirection: "row", alignItems: "center", gap: SPACE.lg,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACE.lg, marginTop: SPACE.md,
    borderColor: COLORS.border,
  },
  passwordIconCircle: { width: 64, height: 64, borderRadius: RADIUS.full, backgroundColor: COLORS.bgTertiary, alignItems: "center", justifyContent: "center" },
  optionTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  optionSub: { fontSize: 12.5, color: COLORS.muted, marginTop: 2, lineHeight: 17 },
});
