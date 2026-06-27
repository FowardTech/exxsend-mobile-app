import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createPin, verifyPin } from "../../../../api/config";
import { COLORS } from "../../../../theme/colors";
import { cachePinIfBiometricEnabled } from "../../../../utils/pinCache";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";

type Step = "current" | "new" | "confirm";

const STEP_CONFIG: Record<Step, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; progress: number }> = {
  current: {
    title: "Enter current PIN",
    subtitle: "Confirm it's you before changing your transaction PIN",
    icon: "lock-closed-outline",
    progress: 1,
  },
  new: {
    title: "Create a new PIN",
    subtitle: "Choose a new 4-digit PIN to authorize your transfers and payments",
    icon: "keypad-outline",
    progress: 2,
  },
  confirm: {
    title: "Confirm new PIN",
    subtitle: "Re-enter your new 4-digit PIN to confirm it",
    icon: "shield-checkmark-outline",
    progress: 3,
  },
};

function DotRow({ count, error }: { count: number; error: boolean }) {
  return (
    <View style={s.dotsRow}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            s.dot,
            i < count && (error ? s.dotError : s.dotFilled),
          ]}
        />
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

export default function ChangePinScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("current");
  // Each step gets its own buffer instead of sharing one — this removes any
  // possibility of the confirm step's dots reflecting a previous step's digits,
  // since there is no shared variable left for a stale value to live in.
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [newPin, setNewPin] = useState(""); // the committed new PIN, held for comparison in "confirm"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const keys = useMemo(() => [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "del"]], []);

  // The buffer + setter for whichever step is currently active.
  const activeBuffer =
    step === "current" ? currentPinInput : step === "new" ? newPinInput : confirmPinInput;
  const setActiveBuffer =
    step === "current" ? setCurrentPinInput : step === "new" ? setNewPinInput : setConfirmPinInput;

  function goToStep(next: Step) {
    setError("");
    // Clear every buffer, not just the one for the step we're leaving — guarantees
    // zero carryover no matter which step we land on next.
    setCurrentPinInput("");
    setNewPinInput("");
    setConfirmPinInput("");
    setStep(next);
  }

  async function handleCurrentPin(entered: string) {
    const phone = (await AsyncStorage.getItem("user_phone"))?.trim();
    if (!phone) {
      Alert.alert("Session expired", "Please log in again.");
      router.replace("/login");
      return;
    }
    const response = await verifyPin(phone, entered);
    if (response?.success) {
      goToStep("new");
    } else {
      setError(response?.message || "Incorrect PIN. Try again.");
      setCurrentPinInput("");
    }
  }

  function handleNewPin(entered: string) {
    setNewPin(entered);
    goToStep("confirm");
  }

  async function handleConfirmPin(entered: string) {
    if (entered !== newPin) {
      setError("PINs don't match. Let's start over.");
      setNewPin("");
      goToStep("new");
      return;
    }

    const phone = (await AsyncStorage.getItem("user_phone"))?.trim();
    if (!phone) {
      Alert.alert("Session expired", "Please log in again.");
      router.replace("/login");
      return;
    }

    const response = await createPin(phone, entered);
    if (response?.success) {
      await cachePinIfBiometricEnabled(entered);
      router.replace({
        pathname: "/result",
        params: {
          type: "success",
          title: "PIN Changed",
          message: "Your transaction PIN has been changed successfully.",
          primaryText: "Done",
          primaryRoute: "/securityprivacy",
        },
      });
    } else {
      setError(response?.message || "Failed to update PIN. Please try again.");
      setNewPin("");
      goToStep("current");
    }
  }

  async function handleComplete(entered: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    try {
      if (step === "current") await handleCurrentPin(entered);
      else if (step === "new") handleNewPin(entered);
      else await handleConfirmPin(entered);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
      setActiveBuffer("");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  function press(k: string) {
    if (loading || submittingRef.current) return;
    if (k === "del") {
      setError("");
      setActiveBuffer((p) => p.slice(0, -1));
      return;
    }
    if (!/^\d$/.test(k)) return;
    setError("");
    setActiveBuffer((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + k;
      if (next.length === 4) void handleComplete(next);
      return next;
    });
  }

  function handleBack() {
    if (step === "current") {
      router.back();
    } else if (step === "new") {
      setNewPin("");
      goToStep("current");
    } else {
      setNewPin("");
      goToStep("new");
    }
  }

  const config = STEP_CONFIG[step];

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View style={s.header}>
        <BackButton onPress={handleBack} disabled={loading} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <AppText style={s.headerTitle}>Change Transaction PIN</AppText>
          <ProgressBar step={config.progress} total={3} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        <View style={s.iconRing}>
          <Ionicons name={config.icon} size={30} color={COLORS.primary} />
        </View>
        <AppText style={s.title}>{config.title}</AppText>
        <AppText style={s.subtitle}>{config.subtitle}</AppText>

        <DotRow count={activeBuffer.length} error={!!error} />
        {!!error && <AppText style={s.error}>{error}</AppText>}
        {loading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 16 }} />}

        {step === "current" && !loading && (
          <Pressable onPress={() => router.push("/forgotpin")} style={{ marginTop: 24 }}>
            <AppText style={s.forgotLink}>Forgot your PIN?</AppText>
          </Pressable>
        )}
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
  dotError: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  error: { marginTop: 14, color: COLORS.red, fontWeight: "600", fontSize: 13, textAlign: "center" },
  forgotLink: { fontSize: 14, fontWeight: "600", color: COLORS.primary },
  pad: { paddingHorizontal: 32, paddingBottom: 32 },
  keyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  keyEmpty: { backgroundColor: "transparent", borderColor: "transparent", elevation: 0, shadowOpacity: 0 },
  keyText: { fontSize: 22, fontWeight: "600", color: COLORS.text },
});
