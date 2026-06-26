import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Alert } from "react-native";
import AppText from "./AppText";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { COLORS } from "../theme/colors";
import { SPACE, RADIUS, GLASS_BORDER } from "../theme/designSystem";

interface AppLockScreenProps {
  onUnlock: () => void;
}

export default function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const router = useRouter();
  const [bioType, setBioType] = useState<string>("Biometric");
  const [savedUserName, setSavedUserName] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBioType(
          types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
            ? "Face ID"
            : "Touch ID"
        );
      } catch {}
      try {
        const storedUser = await AsyncStorage.getItem("user_info");
        if (storedUser) {
          const u = JSON.parse(storedUser);
          setSavedUserName(u.firstName || u.first_name || u.name || null);
        }
      } catch {}
    })();
    // Biometric no longer fires automatically on mount — the user gets a
    // genuine, equal choice between biometric and password from the
    // start, rather than a prompt that pops up immediately with password
    // buried as an escape hatch underneath it.
  }, []);

  const attemptUnlock = async () => {
    if (authenticating) return;
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock ExxSend`,
        fallbackLabel: "Use password",
      });
      if (result.success) {
        onUnlock();
      }
    } catch {
      Alert.alert("Authentication failed", "Please try again.");
    } finally {
      setAuthenticating(false);
    }
  };

  const usePasswordInstead = async () => {
    try {
      await AsyncStorage.removeItem("auth_token");
    } catch {}
    onUnlock();
    router.replace("/login");
  };

  return (
    <View style={s.root}>
      <View style={s.brandBar}>
        <AppText style={s.brandBarText}>Exxsend</AppText>
      </View>

      <View style={s.body}>
        <AppText style={s.welcomeTitle}>
          Welcome Back{savedUserName ? `, ${savedUserName}` : ""}
        </AppText>
        <AppText style={s.welcomeSub}>Choose how you'd like to sign in</AppText>

        <Pressable onPress={attemptUnlock} style={s.bioCard}>
          <View style={s.bioIconCircle}>
            <Ionicons
              name={bioType === "Face ID" ? "scan-outline" : "finger-print-outline"}
              size={36}
              color={COLORS.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={s.optionTitle}>{bioType}</AppText>
            <AppText style={s.optionSub}>Unlock instantly</AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </Pressable>

        <Pressable onPress={usePasswordInstead} style={s.passwordCard}>
          <View style={s.passwordIconCircle}>
            <Ionicons name="key-outline" size={32} color={COLORS.text} />
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
  brandBar: { paddingTop: 14, paddingBottom: 18, alignItems: "center", marginTop: 25 },
  brandBarText: { color: COLORS.text, fontSize: 20, fontWeight: "600" },
  body: { flex: 1, paddingHorizontal: SPACE.xxl, paddingTop: SPACE.xxxl },
  welcomeTitle: { fontSize: 24, fontWeight: "600", color: COLORS.text, lineHeight: 32 },
  welcomeSub: { fontSize: 14, color: COLORS.muted, marginTop: SPACE.sm, marginBottom: SPACE.xxxl, },
  bioCard: { flexDirection: "row", alignItems: "center", gap: SPACE.lg, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACE.lg, marginBottom: SPACE.md, ...GLASS_BORDER },
  bioIconCircle: { width: 64, height: 64, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  passwordCard: { flexDirection: "row", alignItems: "center", gap: SPACE.lg, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACE.lg, ...GLASS_BORDER },
  passwordIconCircle: { width: 64, height: 64, borderRadius: RADIUS.full, backgroundColor: COLORS.bgTertiary, alignItems: "center", justifyContent: "center" },
  optionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  optionSub: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
});
