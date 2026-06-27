import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, TextInput as RNTextInput, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../api/config";
import { verifyDevice } from "../../../api/devices";
import { COLORS } from "../../../theme/colors";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";

const OTP_LEN = 6;

export default function VerifyDeviceScreen() {
  const router = useRouter();
  // redirectTo lets a transaction-gating call site send the user back to
  // resume exactly where they were once this device is trusted, rather
  // than always landing on Home.
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const inputRef = useRef<RNTextInput | null>(null);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true);
  const [requestId, setRequestId] = useState("");

  const canContinue = code.length === OTP_LEN && !loading && !!requestId;

  const sendCode = async (savedPhone: string) => {
    setSending(true);
    try {
      const result = await api.sendOtp(savedPhone);
      if (result.success) {
        setRequestId(result.request_id);
        setSeconds(60);
      } else {
        Alert.alert("Couldn't send code", result.message || "Please try again.");
      }
    } catch {
      Alert.alert("Network error", "Please try again.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    (async () => {
      const savedPhone = (await AsyncStorage.getItem("user_phone")) || "";
      if (!savedPhone) { router.replace("/login" as any); return; }
      setPhone(savedPhone);
      sendCode(savedPhone);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const mmss = useMemo(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? `0${s}` : s}`;
  }, [seconds]);

  const handleResend = () => {
    if (seconds > 0 || sending) return;
    setCode("");
    sendCode(phone);
  };

  const handleVerify = async () => {
    if (!canContinue) return;
    setLoading(true);
    try {
      const result = await api.verifyOtp(requestId, code);
      if (!result.success) {
        Alert.alert("Invalid code", result.message || "Please check and try again.");
        setCode("");
        return;
      }
      const deviceRes = await verifyDevice(phone);
      if (!deviceRes.success) {
        Alert.alert("Couldn't verify device", deviceRes.message || "Please try again.");
        return;
      }
      if (params.redirectTo) {
        router.replace(decodeURIComponent(params.redirectTo) as any);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)" as any);
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push("/support" as any)} style={s.helpPill}>
          <AppText style={s.helpText}>Get help</AppText>
        </Pressable>
      </View>

      <View style={s.body}>
        <View style={s.iconRing}>
          <Ionicons name="shield-checkmark-outline" size={28} color={COLORS.primary} />
        </View>

        <AppText style={s.title}>Verify this device</AppText>
        <AppText style={s.subtitle}>
          For your security, we need to confirm it's really you on this device.{"\n"}
          Enter the 6-digit code sent to{"\n"}
          <AppText style={s.phone}>{phone}</AppText>
        </AppText>

        <Pressable onPress={() => inputRef.current?.focus()} style={s.otpRow}>
          {Array.from({ length: OTP_LEN }).map((_, i) => {
            const char = code[i] || "";
            const isActive = focused && i === Math.min(code.length, OTP_LEN - 1);
            const isFilled = !!char;
            return (
              <View key={i} style={[s.otpBox, isActive && s.otpBoxActive, isFilled && s.otpBoxFilled]}>
                <AppText style={s.otpChar}>{char}</AppText>
              </View>
            );
          })}
          <AppTextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, OTP_LEN))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            editable={!sending}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
          />
        </Pressable>

        <View style={s.resendRow}>
          <AppText style={s.resendLabel}>Didn't receive it? </AppText>
          {seconds > 0 ? (
            <AppText style={s.resendTimer}>Retry in {mmss}</AppText>
          ) : (
            <Pressable onPress={handleResend} disabled={sending}>
              <AppText style={s.resendLink}>Resend code</AppText>
            </Pressable>
          )}
        </View>
      </View>

      <View style={s.footer}>
        <Pressable
          onPress={handleVerify}
          disabled={!canContinue}
          style={({ pressed }) => [s.ctaBtn, !canContinue && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
        >
          <View style={s.ctaInner}>
            {loading ? <ActivityIndicator color={COLORS.actionText} /> : <AppText style={s.ctaText}>Verify Device</AppText>}
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  helpPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primaryLight },
  helpText: { color: COLORS.primary, fontWeight: "600", fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  iconRing: { width: 68, height: 68, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 22 },
  title: { fontSize: 20, fontWeight: "600", color: COLORS.text, marginBottom: 10 },
  subtitle: { fontSize: 13, color: COLORS.muted, fontWeight: "500", lineHeight: 22 },
  phone: { color: COLORS.text, fontWeight: "600" },
  otpRow: { flexDirection: "row", gap: 10, marginTop: 32 },
  otpBox: { flex: 1, height: 56, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  otpBoxActive: { borderColor: COLORS.primary, borderWidth: 2 },
  otpBoxFilled: { borderColor: COLORS.primaryMid, backgroundColor: COLORS.primaryLight },
  otpChar: { fontSize: 22, fontWeight: "600", color: COLORS.text },
  resendRow: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  resendLabel: { fontSize: 14, color: COLORS.muted, fontWeight: "600" },
  resendTimer: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
  resendLink: { fontSize: 14, color: COLORS.primary, fontWeight: "600" },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  ctaBtn: { borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.actionBg },
  ctaInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.actionText, fontSize: 16, fontWeight: "600" },
});
