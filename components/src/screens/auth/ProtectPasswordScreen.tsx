import React, { useMemo, useState } from "react";
import { View, Pressable, Alert, StyleSheet, StatusBar, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";
import AppTextInput from "../../../AppTextInput";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../../../theme/colors";
import { setPassword } from "../../../../api/config";
import { clearLegacyCaches } from "../../../../utils/cacheUtils";

function Rule({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={s.ruleRow}>
      <View style={[s.ruleDot, met && s.ruleDotMet]}>
        {met && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
      </View>
      <AppText style={[s.ruleText, met && s.ruleTextMet]}>{text}</AppText>
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

export default function ProtectPasswordScreen() {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [loading, setLoading] = useState(false);

  const ruleLen = p1.length >= 8 && p1.length <= 20;
  const ruleNum = /[0-9]/.test(p1);
  const ruleSymbol = /[^A-Za-z0-9]/.test(p1);
  const ruleMatch = p1.length > 0 && p1 === p2;

  const canCreate = useMemo(() => ruleLen && (ruleNum || ruleSymbol) && ruleMatch, [ruleLen, ruleNum, ruleSymbol, ruleMatch]);

  const handleCreate = async () => {
    if (!canCreate || loading) return;
    setLoading(true);
    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) { Alert.alert("Error", "Phone number not found"); return; }
      const result = await setPassword(phone, p1.trim());
      if (result?.success) {
        await clearLegacyCaches();
        await AsyncStorage.setItem("last_seen_user_phone", phone);
        await AsyncStorage.setItem("signup_stage", "password_set");
        router.replace({
          pathname: "/result",
          params: {
            type: "success",
            title: "Account Created!",
            message: "Your ExxSend account has been created. Log in to begin sending money.",
            primaryText: "Log In",
            primaryRoute: "/login",
          },
        });
      } else {
        Alert.alert("Error", result?.message || "Failed to set password");
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

      <View style={s.header}>
        <BackButton onPress={() => router.back()} disabled={loading} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <AppText style={s.headerTitle}>Secure your account</AppText>
          <ProgressBar step={4} total={4} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.iconRing}>
          <Ionicons name="lock-closed-outline" size={30} color={COLORS.primary} />
        </View>

        <AppText style={s.title}>Create your password</AppText>
        <AppText style={s.subtitle}>Choose a strong password to protect your account. You'll use this to log in.</AppText>

        <AppText style={s.fieldLabel}>New password</AppText>
        <View style={s.inputBox}>
          <AppTextInput
            value={p1}
            onChangeText={setP1}
            secureTextEntry={!show1}
            editable={!loading}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            placeholder="Create a password"
            placeholderTextColor={COLORS.muted}
            style={s.input}
          />
          <Pressable onPress={() => setShow1(v => !v)} style={s.eyeBtn}>
            <Ionicons name={show1 ? "eye-outline" : "eye-off-outline"} size={18} color={COLORS.muted} />
          </Pressable>
        </View>

        <AppText style={[s.fieldLabel, { marginTop: 14 }]}>Confirm password</AppText>
        <View style={[s.inputBox, p2.length > 0 && (ruleMatch ? s.inputValid : s.inputError)]}>
          <AppTextInput
            value={p2}
            onChangeText={setP2}
            secureTextEntry={!show2}
            editable={!loading}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            placeholder="Repeat your password"
            placeholderTextColor={COLORS.muted}
            style={s.input}
          />
          <Pressable onPress={() => setShow2(v => !v)} style={s.eyeBtn}>
            <Ionicons name={show2 ? "eye-outline" : "eye-off-outline"} size={18} color={COLORS.muted} />
          </Pressable>
        </View>

        {/* Password rules */}
        <View style={s.rulesBox}>
          <Rule met={ruleLen} text="8 to 20 characters" />
          <Rule met={ruleNum} text="At least one number" />
          <Rule met={ruleSymbol} text="At least one special character (e.g. !@#$%)" />
          <Rule met={ruleMatch} text="Passwords match" />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={s.footer}>
        <Pressable
          onPress={handleCreate}
          disabled={!canCreate || loading}
          style={({ pressed }) => [s.ctaBtn, (!canCreate || loading) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
        >
          <View style={s.ctaInner}>
            {loading ? <ActivityIndicator color={COLORS.actionText} /> : <AppText style={s.ctaText}>Create Account</AppText>}
          </View>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
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
  body: { paddingHorizontal: 20, paddingTop: 8 },
  iconRing: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 18 },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.muted, fontWeight: "500", lineHeight: 22, marginBottom: 24 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52 },
  inputValid: { borderColor: COLORS.green },
  inputError: { borderColor: COLORS.red },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text, padding: 0 },
  eyeBtn: { paddingLeft: 10, paddingVertical: 10 },
  rulesBox: { marginTop: 16, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.borderLight },
  ruleRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  ruleDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, marginRight: 10, justifyContent: "center", alignItems: "center" },
  ruleDotMet: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  ruleText: { fontSize: 13, color: COLORS.muted, fontWeight: "600" },
  ruleTextMet: { color: COLORS.green },
  footer: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  ctaBtn: { borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.actionBg },
  ctaInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.actionText, fontSize: 16, fontWeight: "700" },
});
