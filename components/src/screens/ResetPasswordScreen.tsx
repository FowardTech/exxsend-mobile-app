import React, { useState } from "react";
import { View, Pressable, Alert, ActivityIndicator, StyleSheet, StatusBar, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import AppTextInput from "../../AppTextInput";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../../theme/colors";
import { resetPassword } from "../../../api/config";

type Step = "email" | "sent";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async () => {
    if (!isValidEmail || loading) return;
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setStep("sent");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not send reset email. Please try again.");
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
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.body}>
          {step === "email" ? (
            <>
              {/* Icon */}
              <View style={s.iconRing}>
                <Ionicons name="lock-closed-outline" size={30} color={COLORS.primary} />
              </View>

              <AppText style={s.title}>Reset your password</AppText>
              <AppText style={s.subtitle}>
                Enter your registered email address and we'll send you a link to reset your password.
              </AppText>

              <AppText style={s.fieldLabel}>Email address</AppText>
              <View style={[s.inputBox, email.length > 0 && isValidEmail && s.inputBoxValid]}>
                <Ionicons name="mail-outline" size={18} color={COLORS.muted} style={{ marginRight: 10 }} />
                <AppTextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={s.input}
                />
                {email.length > 0 && isValidEmail && (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                )}
              </View>
            </>
          ) : (
            <>
              {/* Success state */}
              <View style={[s.iconRing, { backgroundColor: COLORS.greenSoft }]}>
                <Ionicons name="mail-unread-outline" size={30} color={COLORS.green} />
              </View>

              <AppText style={s.title}>Check your email</AppText>
              <AppText style={s.subtitle}>
                We've sent a password reset link to{"\n"}
                <AppText style={{ color: COLORS.text, fontWeight: "700" }}>{email}</AppText>
              </AppText>

              <View style={s.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} style={{ marginRight: 10, marginTop: 1 }} />
                <AppText style={{ flex: 1, fontSize: 13, color: COLORS.primary, fontWeight: "600", lineHeight: 20 }}>
                  The link expires in 30 minutes. Check your spam folder if you don't see it.
                </AppText>
              </View>

              <Pressable onPress={() => setStep("email")} style={{ marginTop: 16 }}>
                <AppText style={{ textAlign: "center", color: COLORS.primary, fontWeight: "700", fontSize: 14 }}>
                  Use a different email
                </AppText>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={s.footer}>
        {step === "email" ? (
          <Pressable
            onPress={handleSubmit}
            disabled={!isValidEmail || loading}
            style={({ pressed }) => [s.ctaBtn, (!isValidEmail || loading) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
          >
            <View style={s.ctaInner}>
              {loading ? <ActivityIndicator color={COLORS.actionText} /> : <AppText style={s.ctaText}>Send reset link</AppText>}
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push("/login")}
            style={[s.ctaBtn, { overflow: "hidden" }]}
          >
            <View style={s.ctaInner}>
              <AppText style={s.ctaText}>Back to login</AppText>
            </View>
          </Pressable>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  iconRing: { width: 72, height: 72, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  subtitle: { fontSize: 13, color: COLORS.muted, fontWeight: "500", lineHeight: 22, marginBottom: 28 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 54 },
  inputBoxValid: { borderColor: COLORS.green },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  infoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 14, padding: 14, marginTop: 20 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  ctaBtn: { borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.actionBg },
  ctaInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.actionText, fontSize: 16, fontWeight: "700" },
});
