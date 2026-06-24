import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, Keyboard, Alert, ActivityIndicator, StyleSheet, StatusBar, TextInput as RNTextInput } from "react-native";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";
import AppTextInput from "../../../AppTextInput";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cachePinIfBiometricEnabled } from "../../../../utils/pinCache";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../../../theme/colors";
import { getUserProfile, sendEmailOtp, verifyEmailOtp, resendEmailOtp, createPin } from "../../../../api/config";

type Step = "email" | "otp" | "newpin" | "confirm";
const CODE_LEN = 6;
const RESEND_SECONDS = 45;

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user[0] || ""}***@${domain}`;
  return `${user.slice(0, 2)}***@${domain}`;
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { width: `${(step / total) * 100}%` as any }]} />
    </View>
  );
}

function DotRow({ count, error }: { count: number; error: boolean }) {
  return (
    <View style={s.dotsRow}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[s.dot, i < count && (error ? s.dotError : s.dotFilled)]} />
      ))}
    </View>
  );
}

const STEP_PROGRESS: Record<Step, number> = { email: 1, otp: 2, newpin: 3, confirm: 4 };

export default function ForgotPinScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // OTP step state
  const [code, setCode] = useState<string[]>(Array(CODE_LEN).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputsRef = useRef<Array<RNTextInput | null>>([]);
  const codeValue = useMemo(() => code.join(""), [code]);
  const canSubmitOtp = useMemo(() => code.every((d) => d !== "") && !submitting, [code, submitting]);

  // PIN step state (reuses the same keypad pattern as ChangePinScreen).
  // newpin and confirm each get their own buffer instead of sharing one — this
  // removes any possibility of the confirm step's dots reflecting digits left
  // over from the newpin step.
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const submittingRef = useRef(false);
  const keys = useMemo(() => [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "del"]], []);

  // The buffer + setter for whichever PIN step is currently active.
  const activePinBuffer = step === "newpin" ? newPinInput : confirmPinInput;
  const setActivePinBuffer = step === "newpin" ? setNewPinInput : setConfirmPinInput;

  // Load the user's registered phone/email up front
  useEffect(() => {
    (async () => {
      try {
        const storedPhone = (await AsyncStorage.getItem("user_phone"))?.trim();
        if (!storedPhone) {
          Alert.alert("Session expired", "Please log in again.");
          router.replace("/login");
          return;
        }
        setPhone(storedPhone);
        const res = await getUserProfile(storedPhone);
        if (res?.success && res.user?.email) {
          setEmail(res.user.email);
        } else {
          setError("We couldn't find an email on file for your account.");
        }
      } catch {
        setError("Could not load your account details. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (step !== "otp" || secondsLeft === 0) return;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step, secondsLeft]);

  function goToPinStep(next: Step) {
    setError("");
    setNewPinInput("");
    setConfirmPinInput("");
    setStep(next);
  }

  const handleSendOtp = async () => {
    if (!email) return;
    setSubmitting(true);
    setError("");
    try {
      await sendEmailOtp(email);
      setSecondsLeft(RESEND_SECONDS);
      setStep("otp");
    } catch {
      Alert.alert("Error", "Could not send the verification code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
      if (code[i]) {
        const next = [...code];
        next[i] = "";
        setCode(next);
        return;
      }
      if (!code[i] && i > 0) {
        const next = [...code];
        next[i - 1] = "";
        setCode(next);
        inputsRef.current[i - 1]?.focus();
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!canSubmitOtp || !email || !phone) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await verifyEmailOtp(email, codeValue, phone);
      if (res?.success === false) {
        setError(res?.message || "Invalid code. Please check and try again.");
        setCode(Array(CODE_LEN).fill(""));
        inputsRef.current[0]?.focus();
        return;
      }
      goToPinStep("newpin");
    } catch {
      setError("Invalid code. Please check and try again.");
      setCode(Array(CODE_LEN).fill(""));
      inputsRef.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (secondsLeft > 0 || submitting || !email) return;
    setSubmitting(true);
    try {
      await resendEmailOtp(email);
      setSecondsLeft(RESEND_SECONDS);
      setCode(Array(CODE_LEN).fill(""));
      inputsRef.current[0]?.focus();
      Alert.alert("Sent!", "A new code has been sent to your email.");
    } catch {
      Alert.alert("Error", "Could not resend code.");
    } finally {
      setSubmitting(false);
    }
  };

  async function handleNewPinDigits(entered: string) {
    setNewPin(entered);
    goToPinStep("confirm");
  }

  async function handleConfirmPinDigits(entered: string) {
    if (entered !== newPin) {
      setError("PINs don't match. Let's start over.");
      setNewPin("");
      goToPinStep("newpin");
      return;
    }
    try {
      const response = await createPin(phone, entered);
      if (response?.success) {
        await cachePinIfBiometricEnabled(entered);
        router.replace({
          pathname: "/result",
          params: {
            type: "success",
            title: "PIN Reset",
            message: "Your transaction PIN has been reset successfully.",
            primaryText: "Done",
            primaryRoute: "/securityprivacy",
          },
        });
      } else {
        setError(response?.message || "Failed to set your new PIN. Please try again.");
        setNewPin("");
        goToPinStep("newpin");
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
      setNewPin("");
      goToPinStep("newpin");
    }
  }

  async function handlePinComplete(entered: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (step === "newpin") await handleNewPinDigits(entered);
      else await handleConfirmPinDigits(entered);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  function pressKey(k: string) {
    if (submitting || submittingRef.current) return;
    if (k === "del") {
      setError("");
      setActivePinBuffer((p) => p.slice(0, -1));
      return;
    }
    if (!/^\d$/.test(k)) return;
    setError("");
    setActivePinBuffer((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + k;
      if (next.length === 4) void handlePinComplete(next);
      return next;
    });
  }

  function handleBack() {
    if (step === "email") router.back();
    else if (step === "otp") setStep("email");
    else if (step === "newpin") setStep("otp");
    else {
      setNewPin("");
      goToPinStep("newpin");
    }
  }

  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View style={s.header}>
        <BackButton onPress={handleBack} disabled={submitting} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <AppText style={s.headerTitle}>Reset Transaction PIN</AppText>
          <ProgressBar step={STEP_PROGRESS[step]} total={4} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Step 1: confirm email, send OTP ── */}
      {step === "email" && (
        <View style={s.body}>
          <View style={s.iconRing}>
            <Ionicons name="mail-outline" size={30} color={COLORS.primary} />
          </View>
          <AppText style={s.title}>Verify it's you</AppText>
          <AppText style={s.subtitle}>
            We'll send a 6-digit code to your registered email so you can reset your transaction PIN.
          </AppText>

          {email ? (
            <View style={s.emailPill}>
              <Ionicons name="mail" size={16} color={COLORS.primary} />
              <AppText style={s.emailPillText}>{maskEmail(email)}</AppText>
            </View>
          ) : null}

          {!!error && <AppText style={s.error}>{error}</AppText>}

          <Pressable
            style={[s.primaryBtn, (!email || submitting) && s.primaryBtnDisabled]}
            onPress={handleSendOtp}
            disabled={!email || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.actionText} />
            ) : (
              <AppText style={s.primaryBtnText}>Send Code</AppText>
            )}
          </Pressable>
        </View>
      )}

      {/* ── Step 2: enter OTP ── */}
      {step === "otp" && (
        <View style={s.body}>
          <View style={s.iconRing}>
            <Ionicons name="shield-checkmark-outline" size={30} color={COLORS.primary} />
          </View>
          <AppText style={s.title}>Enter verification code</AppText>
          <AppText style={s.subtitle}>
            We sent a 6-digit code to {email ? maskEmail(email) : "your email"}. Enter it below to continue.
          </AppText>

          <View style={s.otpRow}>
            {code.map((digit, i) => (
              <AppTextInput
                key={i}
                ref={(r) => { inputsRef.current[i] = r; }}
                value={digit}
                onChangeText={(t) => onChangeDigit(t, i)}
                onKeyPress={(e) => onKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                style={[s.otpBox, !!error && s.otpBoxError]}
                autoFocus={i === 0}
              />
            ))}
          </View>

          {!!error && <AppText style={s.error}>{error}</AppText>}

          <Pressable
            style={[s.primaryBtn, !canSubmitOtp && s.primaryBtnDisabled]}
            onPress={handleVerifyOtp}
            disabled={!canSubmitOtp}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.actionText} />
            ) : (
              <AppText style={s.primaryBtnText}>Verify</AppText>
            )}
          </Pressable>

          <Pressable onPress={handleResendOtp} disabled={secondsLeft > 0 || submitting} style={{ marginTop: 18 }}>
            <AppText style={[s.resendText, secondsLeft > 0 && s.resendTextDisabled]}>
              {secondsLeft > 0 ? `Resend code in ${mmss(secondsLeft)}` : "Resend code"}
            </AppText>
          </Pressable>
        </View>
      )}

      {/* ── Step 3 & 4: new PIN + confirm (same keypad pattern as ChangePinScreen) ── */}
      {(step === "newpin" || step === "confirm") && (
        <>
          <View style={s.body}>
            <View style={s.iconRing}>
              <Ionicons name="keypad-outline" size={30} color={COLORS.primary} />
            </View>
            <AppText style={s.title}>{step === "newpin" ? "Create a new PIN" : "Confirm new PIN"}</AppText>
            <AppText style={s.subtitle}>
              {step === "newpin"
                ? "Choose a new 4-digit PIN to authorize your transfers and payments"
                : "Re-enter your new 4-digit PIN to confirm it"}
            </AppText>

            <DotRow count={activePinBuffer.length} error={!!error} />
            {!!error && <AppText style={s.error}>{error}</AppText>}
            {submitting && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 16 }} />}
          </View>

          <View style={s.pad}>
            {keys.map((row, rIdx) => (
              <View key={rIdx} style={s.keyRow}>
                {row.map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => pressKey(k)}
                    disabled={submitting || k === ""}
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
        </>
      )}
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
  title: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: COLORS.muted, fontWeight: "500", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  emailPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primaryLight, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, marginBottom: 28 },
  emailPillText: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  otpRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  otpBox: { width: 44, height: 54, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: "#FFFFFF", textAlign: "center", fontSize: 20, fontWeight: "700", color: COLORS.text },
  otpBoxError: { borderColor: COLORS.red },
  resendText: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  resendTextDisabled: { color: COLORS.muted },
  dotsRow: { flexDirection: "row", gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.border, backgroundColor: "transparent" },
  dotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotError: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  error: { marginTop: 14, marginBottom: 4, color: COLORS.red, fontWeight: "600", fontSize: 13, textAlign: "center" },
  primaryBtn: { backgroundColor: COLORS.actionBg, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignItems: "center", justifyContent: "center", marginTop: 16, minWidth: 200 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: COLORS.actionText, fontSize: 16, fontWeight: "700" },
  pad: { paddingHorizontal: 32, paddingBottom: 32 },
  keyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  keyEmpty: { backgroundColor: "transparent", borderColor: "transparent", elevation: 0, shadowOpacity: 0 },
  keyText: { fontSize: 22, fontWeight: "600", color: COLORS.text },
});
