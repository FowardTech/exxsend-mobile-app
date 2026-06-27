import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saveBasicInfo } from "../../../api/config";
import { COLORS } from "../../../theme/colors";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";

function FieldLabel({ label }: { label: string }) {
  return <AppText style={s.fieldLabel}>{label}</AppText>;
}

function InputBox({ value, onChangeText, placeholder, keyboardType, autoCapitalize }: any) {
  return (
    <View style={s.inputBox}>
      <AppTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ""}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "words"}
        style={s.input}
      />
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

export default function BasicInfoScreen() {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [middle, setMiddle] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showAndroidDate, setShowAndroidDate] = useState(false);
  const [showIOSDate, setShowIOSDate] = useState(false);
  const [tempDob, setTempDob] = useState<Date>(new Date(2000, 0, 1));
  const [loading, setLoading] = useState(false);

  const formatDob = (d: Date | null) => {
    if (!d) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  const age = useMemo(() => {
    if (!dob) return null;
    const now = new Date();
    let a = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) a -= 1;
    return a;
  }, [dob]);

  const isAdult = age !== null && age >= 18;

  const canContinue = useMemo(() =>
    !!(first.trim() && last.trim() && email.trim() && dob && isAdult),
    [first, last, email, dob, isAdult]
  );

  const openDatePicker = () => {
    if (Platform.OS === "ios") {
      setTempDob(dob || new Date(2000, 0, 1));
      setShowIOSDate(true);
    } else {
      setShowAndroidDate(true);
    }
  };

  const handleContinue = async () => {
    if (!canContinue || loading || !dob) return;
    setLoading(true);
    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) { Alert.alert("Error", "Phone number not found"); return; }
      const result = await saveBasicInfo(phone, {
        first_name: first.trim(),
        middle_name: middle.trim() || undefined,
        last_name: last.trim(),
        email: email.trim().toLowerCase(),
        date_of_birth: dob.toISOString().split("T")[0],
      });
      if (result?.success) {
        await AsyncStorage.setItem("user_info", JSON.stringify({
          firstName: first.trim(), lastName: last.trim(), email: email.trim().toLowerCase(),
        }));
        await AsyncStorage.setItem("signup_stage", "basic_info_saved");
        router.push("/protectpassword");
      } else {
        Alert.alert("Error", result?.message || "Failed to save info");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong");
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
        <View style={{ flex: 1, marginLeft: 12 }}>
          <AppText style={s.headerTitle}>Basic Information</AppText>
          <ProgressBar step={1} total={4} />
        </View>
        <Pressable onPress={() => router.push("/support" as any)} style={s.helpPill}>
          <AppText style={s.helpText}>Help</AppText>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info banner */}
          <View style={s.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.accentDark} style={{ marginRight: 10, marginTop: 1 }} />
            <AppText style={s.infoBannerText}>
              Enter your full legal name exactly as it appears on your government-issued ID. No initials.
            </AppText>
          </View>

          {/* Name row */}
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="First name" />
              <InputBox value={first} onChangeText={setFirst} placeholder="John" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <FieldLabel label="Middle name" />
              <InputBox value={middle} onChangeText={setMiddle} placeholder="Optional" />
            </View>
          </View>

          <FieldLabel label="Last name" />
          <InputBox value={last} onChangeText={setLast} placeholder="Smith" />

          <FieldLabel label="Email address" />
          <View style={s.inputBox}>
            <Ionicons name="mail-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
            <AppTextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.input, { flex: 1 }]}
            />
          </View>

          <FieldLabel label="Date of birth" />
          <Pressable onPress={openDatePicker} style={[s.inputBox, s.dobBox]}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={{ marginRight: 10 }} />
            <AppText style={[s.input, { flex: 1, color: dob ? COLORS.text : COLORS.muted }]}>
              {dob ? formatDob(dob) : "Select your date of birth"}
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
          </Pressable>

          {/* Age feedback */}
          {dob && (
            <View style={[s.agePill, !isAdult && s.agePillError]}>
              <Ionicons
                name={isAdult ? "checkmark-circle" : "alert-circle-outline"}
                size={15}
                color={isAdult ? COLORS.green : COLORS.red}
                style={{ marginRight: 6 }}
              />
              <AppText style={[s.ageText, !isAdult && { color: COLORS.red }]}>
                {isAdult ? `Age ${age} — eligible to open an account` : `You must be 18 or older to continue`}
              </AppText>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer CTA */}
        <View style={s.footer}>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || loading}
            style={({ pressed }) => [s.ctaBtn, (!canContinue || loading) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
          >
            <View style={s.ctaInner}>
              {loading ? <ActivityIndicator color={COLORS.actionText} /> : <AppText style={s.ctaText}>Continue</AppText>}
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Android date picker */}
      {showAndroidDate && (
        <DateTimePicker
          value={dob || new Date(2000, 0, 1)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, selected) => {
            setShowAndroidDate(false);
            if (event.type !== "dismissed" && selected) setDob(selected);
          }}
        />
      )}

      {/* iOS date picker modal */}
      <Modal visible={showIOSDate} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowIOSDate(false)} />
          <View style={s.dateSheet}>
            <View style={s.dateSheetHandle} />
            <View style={s.dateSheetHeader}>
              <Pressable onPress={() => setShowIOSDate(false)} style={s.dateSheetCancel}>
                <AppText style={s.dateSheetCancelText}>Cancel</AppText>
              </Pressable>
              <AppText style={s.dateSheetTitle}>Date of Birth</AppText>
              <Pressable
                style={s.dateSheetDone}
                onPress={() => { setDob(tempDob); setShowIOSDate(false); }}
              >
                <AppText style={s.dateSheetDoneText}>Done</AppText>
              </Pressable>
            </View>
            <DateTimePicker
              value={tempDob}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              textColor={COLORS.text}
              onChange={(_, selected) => { if (selected) setTempDob(selected); }}
              style={{ backgroundColor: "#FFFFFF" }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: COLORS.text, marginBottom: 6 },
  helpPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primaryLight },
  helpText: { color: COLORS.primary, fontWeight: "600", fontSize: 12 },
  progressTrack: { height: 4, backgroundColor: COLORS.borderLight, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 99 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.accentLight, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "rgba(245,158,11,0.20)" },
  infoBannerText: { flex: 1, fontSize: 13, color: COLORS.accentDark, fontWeight: "600", lineHeight: 20 },
  twoCol: { flexDirection: "row", marginBottom: 0 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 14, marginBottom: 8 },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52 },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text, padding: 0 },
  dobBox: { borderColor: COLORS.primary, borderWidth: 1.5 },
  agePill: { flexDirection: "row", alignItems: "center", marginTop: 10, backgroundColor: COLORS.greenSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  agePillError: { backgroundColor: "rgba(239,68,68,0.08)" },
  ageText: { fontSize: 13, fontWeight: "600", color: COLORS.green },
  footer: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  ctaBtn: { borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.actionBg },
  ctaInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.actionText, fontSize: 16, fontWeight: "600" },
  // Date modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(12,26,46,0.45)" },
  dateSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34, overflow: "hidden" },
  dateSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  dateSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  dateSheetTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  dateSheetCancel: { paddingVertical: 4, paddingHorizontal: 4 },
  dateSheetCancelText: { fontSize: 15, color: COLORS.muted, fontWeight: "600" },
  dateSheetDone: { paddingVertical: 4, paddingHorizontal: 4 },
  dateSheetDoneText: { fontSize: 15, color: COLORS.primary, fontWeight: "600" },
});
