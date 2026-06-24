import React, { useMemo, useRef, useState } from "react";
import { View, Pressable, Alert, ActivityIndicator, StyleSheet, StatusBar } from "react-native";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cachePinIfBiometricEnabled } from "../../../utils/pinCache";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../../theme/colors";
import { createPin } from "../../../api/config";

function DotRow({ count }: { count: number }) {
  return (
    <View style={s.dotsRow}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[s.dot, i < count && s.dotFilled]} />
      ))}
    </View>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { width: `${(step / total) * 100}%` as any }]} />
    </View>
  );
}

export default function VerifyPinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const keys = useMemo(() => [["1","2","3"],["4","5","6"],["7","8","9"],["","0","del"]], []);

  async function handlePinComplete(confirmPin: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const phone = (await AsyncStorage.getItem("user_phone"))?.trim();
      const firstPin = await AsyncStorage.getItem("pending_pin");
      if (!phone) { router.replace("/getstarted"); return; }
      if (!firstPin) { setError("Session expired. Please start again."); router.replace("/pin"); return; }
      if (firstPin !== confirmPin) {
        setError("PINs don't match. Please try again.");
        setPin("");
        await AsyncStorage.removeItem("pending_pin");
        return;
      }
      const response = await createPin(phone, confirmPin);
      if (response?.success) {
        await cachePinIfBiometricEnabled(confirmPin);
        await AsyncStorage.removeItem("pending_pin");
        await AsyncStorage.setItem("signup_stage", "pin_set");
        // If user already has an auth token they are authenticated (e.g. came from send money)
        // so go to tabs. Otherwise continue signup flow to basicinfo.
        const token = await AsyncStorage.getItem("auth_token");
        if (token) {
          router.replace("/(tabs)");
        } else {
          router.replace("/basicinfo");
        }
      } else {
        setError(response?.message || "Failed to set PIN");
        setPin("");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to set PIN");
      setPin("");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  function press(k: string) {
    if (loading || submittingRef.current) return;
    if (k === "del") { setError(""); setPin(p => p.slice(0, -1)); return; }
    if (!/^\d$/.test(k)) return;
    setError("");
    setPin(prev => {
      if (prev.length >= 4) return prev;
      const next = prev + k;
      if (next.length === 4) void handlePinComplete(next);
      return next;
    });
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View style={s.header}>
        <BackButton onPress={() => router.back()} disabled={loading} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <AppText style={s.headerTitle}>Confirm PIN</AppText>
          <ProgressBar step={3} total={4} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        <View style={s.iconRing}>
          <Ionicons name="shield-checkmark-outline" size={30} color={COLORS.primary} />
        </View>
        <AppText style={s.title}>Confirm your PIN</AppText>
        <AppText style={s.subtitle}>Re-enter your 4-digit PIN to confirm it</AppText>

        <DotRow count={pin.length} />
        {!!error && <AppText style={s.error}>{error}</AppText>}
        {loading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 16 }} />}
      </View>

      <View style={s.pad}>
        {keys.map((row, rIdx) => (
          <View key={rIdx} style={s.keyRow}>
            {row.map((k) => (
              <Pressable
                key={k}
                onPress={() => press(k)}
                disabled={loading || k === ""}
                style={({ pressed }) => [s.key, k === "" && s.keyEmpty, pressed && k !== "" && { opacity: 0.6 }]}
              >
                {k === "del" ? (
                  <Ionicons name="backspace-outline" size={22} color={COLORS.text} />
                ) : (
                  <AppText style={s.keyText}>{k}</AppText>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const KEY_SIZE = 72;
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  progressTrack: { height: 4, backgroundColor: COLORS.borderLight, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 99 },
  body: { flex: 1, alignItems: "center", paddingTop: 32, paddingHorizontal: 24 },
  iconRing: { width: 68, height: 68, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.muted, fontWeight: "500", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  dotsRow: { flexDirection: "row", gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.border, backgroundColor: "transparent" },
  dotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  error: { marginTop: 14, color: COLORS.red, fontWeight: "600", fontSize: 13, textAlign: "center" },
  pad: { paddingHorizontal: 32, paddingBottom: 32 },
  keyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.borderLight, justifyContent: "center", alignItems: "center",},
  keyEmpty: { backgroundColor: "transparent", borderColor: "transparent",},
  keyText: { fontSize: 22, fontWeight: "600", color: COLORS.text },
});
