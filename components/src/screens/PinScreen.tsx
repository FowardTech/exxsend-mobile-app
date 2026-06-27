import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../../theme/colors";
import AppText from "../../AppText";
import BackButton from "../../BackButton";

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

export default function PinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const keys = useMemo(() => [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "del"]], []);

  async function handlePinComplete(firstPin: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const phone = (await AsyncStorage.getItem("user_phone"))?.trim();
      if (!phone) { Alert.alert("Error", "Session expired."); router.replace("/getstarted"); return; }
      await AsyncStorage.setItem("pending_pin", firstPin);
      router.push("/verifypin");
    } catch (e: any) {
      setError(e?.message || "Failed to continue");
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
          <AppText style={s.headerTitle}>Create PIN</AppText>
          <ProgressBar step={2} total={4} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        <View style={s.iconRing}>
          <Ionicons name="keypad-outline" size={30} color={COLORS.primary} />
        </View>
        <AppText style={s.title}>Create your PIN</AppText>
        <AppText style={s.subtitle}>This 4-digit PIN authorises your transfers and payments</AppText>

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
  headerTitle: { fontSize: 17, fontWeight: "600", color: COLORS.text, marginBottom: 6 },
  progressTrack: { height: 4, backgroundColor: COLORS.borderLight, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 99 },
  body: { flex: 1, alignItems: "center", paddingTop: 32, paddingHorizontal: 24 },
  iconRing: { width: 68, height: 68, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "600", color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.muted, fontWeight: "500", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  dotsRow: { flexDirection: "row", gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.border, backgroundColor: "transparent" },
  dotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  error: { marginTop: 14, color: COLORS.red, fontWeight: "600", fontSize: 13, textAlign: "center" },
  pad: { paddingHorizontal: 32, paddingBottom: 32 },
  keyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.borderLight, justifyContent: "center", alignItems: "center", },
  keyEmpty: { backgroundColor: "transparent", borderColor: "transparent", },
  keyText: { fontSize: 22, fontWeight: "600", color: COLORS.text },
});
