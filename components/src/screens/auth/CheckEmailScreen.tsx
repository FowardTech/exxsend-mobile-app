import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, Keyboard, ActivityIndicator, Alert, StyleSheet, StatusBar, Platform, TextInput as RNTextInput } from "react-native";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";
import AppTextInput from "../../../AppTextInput";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../../../../theme/colors";
import { checkEmailVerified, resendEmailOtp, verifyEmailOtp } from "@/api/config";

const CODE_LEN = 6;
const RESEND_SECONDS = 45;

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { width: `${(step / total) * 100}%` as any }]} />
    </View>
  );
}

export default function CheckEmailCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = useMemo(() => {
    const e = params.email;
    return Array.isArray(e) ? (e[0] ?? "") : ((e as string) ?? "");
  }, [params.email]);

  const [code, setCode] = useState<string[]>(Array(CODE_LEN).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputsRef = useRef<Array<RNTextInput | null>>([]);
  const codeValue = useMemo(() => code.join(""), [code]);
  const canContinue = useMemo(() => code.every(d => d !== "") && !submitting, [code, submitting]);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const id = setInterval(() => setSecondsLeft(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const onChangeDigit = (text: string, i: number) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = digit;
    setCode(next);
    if (digit && i < CODE_LEN - 1) inputsRef.current[i + 1]?.focus();
    if (digit && i === CODE_LEN - 1) Keyboard.dismiss();
  };

  const onKeyPress = (e: any, i: number) => {
    if (e.nativeEvent.key === "Backspace") {
      if (code[i]) { const next = [...code]; next[i] = ""; setCode(next); return; }
      if (!code[i] && i > 0) { const next = [...code]; next[i - 1] = ""; setCode(next); inputsRef.current[i - 1]?.focus(); }
    }
  };

  const handleContinue = async () => {
    if (!canContinue || !email) return;
    setSubmitting(true);
    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) return;
      await verifyEmailOtp(email, codeValue, phone);
      const status = await checkEmailVerified(phone);
      if (status.emailVerified) await AsyncStorage.setItem("email_verified", "true");
      router.replace("/homeaddress");
    } catch {
      Alert.alert("Invalid Code", "Please check the code and try again.");
      setCode(Array(CODE_LEN).fill(""));
      inputsRef.current[0]?.focus();
    } finally { setSubmitting(false); }
  };

  const resendCode = async () => {
    if (secondsLeft > 0 || submitting || !email) return;
    setSubmitting(true);
    try {
      await resendEmailOtp(email);
      setSecondsLeft(RESEND_SECONDS);
      setCode(Array(CODE_LEN).fill(""));
      inputsRef.current[0]?.focus();
      Alert.alert("Sent!", "A new code has been sent to your email.");
    } catch { Alert.alert("Error", "Could not resend code."); }
    finally { setSubmitting(false); }
  };

  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View style={s.header}>
        <BackButton onPress={() => router.back()} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <AppText style={s.headerTitle}>Verify email</AppText>
          <ProgressBar step={3} total={4} />
        </View>
        <Pressable onPress={() => router.push("/support" as any)} style={s.helpPill}>
          <AppText style={s.helpText}>Help</AppText>
        </Pressable>
      </View>

      <View style={s.body}>
        <View style={s.iconRing}>
          <Ionicons name="mail-unread-outline" size={30} color={COLORS.primary} />
        </View>
        <AppText style={s.title}>Check your email</AppText>
        <AppText style={s.subtitle}>
          Enter the 6-digit code sent to{"\n"}
          <AppText style={{ color: COLORS.text, fontWeight: "700" }}>{email}</AppText>
        </AppText>

        {/* OTP inputs */}
        <View style={s.otpRow}>
          {Array.from({ length: CODE_LEN }).map((_, i) => {
            const firstEmpty = code.findIndex(d => d === "");
            const isActive = i === (firstEmpty === -1 ? CODE_LEN - 1 : firstEmpty);
            return (
              <AppTextInput
                key={i}
                ref={r => { inputsRef.current[i] = r; }}
                value={code[i]}
                onChangeText={t => onChangeDigit(t, i)}
                onKeyPress={e => onKeyPress(e, i)}
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                maxLength={1}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                selectionColor={COLORS.primary}
                style={[s.otpBox, isActive && s.otpBoxActive, !!code[i] && s.otpBoxFilled]}
              />
            );
          })}
        </View>

        {/* Resend */}
        <View style={s.resendRow}>
          <AppText style={s.resendLabel}>Didn't receive it? </AppText>
          {secondsLeft > 0 ? (
            <AppText style={s.resendTimer}>Retry in {mmss(secondsLeft)}</AppText>
          ) : (
            <Pressable onPress={resendCode} disabled={submitting}>
              <AppText style={s.resendLink}>Resend code</AppText>
            </Pressable>
          )}
        </View>
      </View>

      <View style={s.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={({ pressed }) => [s.ctaBtn, !canContinue && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
        >
          <View style={s.ctaInner}>
            {submitting ? <ActivityIndicator color={COLORS.actionText} /> : <AppText style={s.ctaText}>Verify & Continue</AppText>}
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  progressTrack: { height: 4, backgroundColor: COLORS.borderLight, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 99 },
  helpPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primaryLight },
  helpText: { color: COLORS.primary, fontWeight: "700", fontSize: 12 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  iconRing: { width: 68, height: 68, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 22 },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  subtitle: { fontSize: 13, color: COLORS.muted, fontWeight: "500", lineHeight: 22 },
  otpRow: { flexDirection: "row", gap: 10, marginTop: 32 },
  otpBox: { flex: 1, height: 56, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: COLORS.border, textAlign: "center", fontSize: 22, fontWeight: "700", color: COLORS.text },
  otpBoxActive: { borderColor: COLORS.primary, borderWidth: 2 },
  otpBoxFilled: { borderColor: COLORS.primaryMid, backgroundColor: COLORS.primaryLight },
  resendRow: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  resendLabel: { fontSize: 14, color: COLORS.muted, fontWeight: "600" },
  resendTimer: { fontSize: 14, color: COLORS.text, fontWeight: "700" },
  resendLink: { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  ctaBtn: { borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.actionBg },
  ctaInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.actionText, fontSize: 16, fontWeight: "700" },
});
