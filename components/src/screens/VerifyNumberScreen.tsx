import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, Keyboard, Alert, ActivityIndicator, StyleSheet, StatusBar, TextInput as RNTextInput } from "react-native";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import AppTextInput from "../../AppTextInput";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../../api/config";
import { COLORS } from "../../../theme/colors";

const OTP_LEN = 6;

export default function VerifyNumberScreen() {
  const router = useRouter();
  const { phone, requestId } = useLocalSearchParams<{ phone: string; requestId: string }>();
  const inputRef = useRef<RNTextInput | null>(null);

  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(requestId);

  const canContinue = code.length === OTP_LEN && !loading;

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

  const handleResend = async () => {
    if (seconds > 0 || loading) return;
    setLoading(true);
    try {
      const result = await api.sendOtp(phone || "");
      if (result.success) {
        setCurrentRequestId(result.request_id);
        setSeconds(60);
        setCode("");
        Alert.alert("Sent!", "A new code has been sent.");
      } else {
        Alert.alert("Error", result.message || "Failed to resend");
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!canContinue || !currentRequestId) return;
    setLoading(true);
    try {
      const result = await api.verifyOtp(currentRequestId, code);
      if (result.success) {
        await AsyncStorage.setItem("signup_stage", "phone_verified");
        router.replace({ pathname: "/pin", params: { phone, verified: "true" } });
      } else {
        Alert.alert("Invalid Code", result.message || "Please check and try again.");
        setCode("");
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

      {/* Header */}
      <View style={s.header}>
        <BackButton onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push("/support" as any)} style={s.helpPill}>
          <AppText style={s.helpText}>Get help</AppText>
        </Pressable>
      </View>

      {/* Content */}
      <View style={s.body}>
        {/* Icon */}
        <View style={s.iconRing}>
          <Ionicons name="phone-portrait-outline" size={28} color={COLORS.primary} />
        </View>

        <AppText style={s.title}>Verify your number</AppText>
        <AppText style={s.subtitle}>
          Enter the 6-digit code sent to{"\n"}
          <AppText style={s.phone}>{phone}</AppText>
        </AppText>

        {/* OTP Boxes */}
        <Pressable onPress={() => inputRef.current?.focus()} style={s.otpRow}>
          {Array.from({ length: OTP_LEN }).map((_, i) => {
            const char = code[i] || "";
            const isActive = focused && i === Math.min(code.length, OTP_LEN - 1);
            const isFilled = !!char;
            return (
              <View
                key={i}
                style={[
                  s.otpBox,
                  isActive && s.otpBoxActive,
                  isFilled && s.otpBoxFilled,
                ]}
              >
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
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
          />
        </Pressable>

        {/* Resend */}
        <View style={s.resendRow}>
          <AppText style={s.resendLabel}>Didn't receive it? </AppText>
          {seconds > 0 ? (
            <AppText style={s.resendTimer}>Retry in {mmss}</AppText>
          ) : (
            <Pressable onPress={handleResend} disabled={loading}>
              <AppText style={s.resendLink}>Resend code</AppText>
            </Pressable>
          )}
        </View>
      </View>

      {/* CTA */}
      <View style={s.footer}>
        <Pressable
          onPress={handleVerify}
          disabled={!canContinue}
          style={({ pressed }) => [s.ctaBtn, !canContinue && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
        >
          <View style={s.ctaInner}>
            {loading ? <ActivityIndicator color={COLORS.actionText} /> : <AppText style={s.ctaText}>Verify & Continue</AppText>}
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  helpPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primaryLight },
  helpText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  iconRing: { width: 68, height: 68, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 22 },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  subtitle: { fontSize: 13, color: COLORS.muted, fontWeight: "500", lineHeight: 22 },
  phone: { color: COLORS.text, fontWeight: "700" },
  otpRow: { flexDirection: "row", gap: 10, marginTop: 32 },
  otpBox: { flex: 1, height: 56, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  otpBoxActive: { borderColor: COLORS.primary, borderWidth: 2 },
  otpBoxFilled: { borderColor: COLORS.primaryMid, backgroundColor: COLORS.primaryLight },
  otpChar: { fontSize: 22, fontWeight: "700", color: COLORS.text },
  resendRow: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  resendLabel: { fontSize: 14, color: COLORS.muted, fontWeight: "600" },
  resendTimer: { fontSize: 14, color: COLORS.text, fontWeight: "700" },
  resendLink: { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  ctaBtn: { borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.actionBg },
  ctaInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.actionText, fontSize: 16, fontWeight: "700" },
});
