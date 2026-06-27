import { COLORS } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { submitInteracDeposit } from "../../../../api/paysafe";
import ScreenHeader from "../../../../components/ScreenHeader";
import AppText from "../../../AppText";
import AppTextInput from "../../../AppTextInput";

function StepRow({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepNum}><AppText style={s.stepNumText}>{num}</AppText></View>
      <View style={{ flex: 1 }}>
        <AppText style={s.stepTitle}>{title}</AppText>
        <AppText style={s.stepDesc}>{desc}</AppText>
      </View>
    </View>
  );
}

export default function AddMoneyInteracScreen() {
  const [amount, setAmount] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [phone, storedUser] = await Promise.all([
        AsyncStorage.getItem("user_phone"),
        AsyncStorage.getItem("user_info"),
      ]);
      if (phone) setUserPhone(phone);
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          if (u.email) setUserEmail(u.email);
          const name = [u.firstName || u.first_name, u.lastName || u.last_name].filter(Boolean).join(" ").trim();
          if (name) setUserName(name);
        } catch { }
      }
    })();
  }, []);

  const canDeposit = !!amount && parseFloat(amount) > 0 && !!userEmail.trim();

  const handleDeposit = async () => {
    if (!canDeposit) return;
    if (!userPhone) { Alert.alert("Error", "Session not found. Please log in again."); return; }

    setLoading(true);
    try {
      const result = await submitInteracDeposit({
        amount: parseFloat(amount),
        phone: userPhone,
        email: userEmail.trim(),
        name: userName.trim() || "Customer",
      });

      if (result.success) {
        if (result.redirectUrl) {
          Alert.alert(
            "Complete Transfer",
            "You'll be taken to your banking app to authorize the Interac transfer.",
            [{ text: "Continue", onPress: () => { Linking.openURL(result.redirectUrl!).catch(() => { }); router.back(); } }]
          );
        } else {
          Alert.alert("Deposit Initiated", result.message || `Your $${amount} CAD Interac deposit is initiated.`, [{ text: "Done", onPress: () => router.back() }]);
        }
      } else {
        Alert.alert("Error", result.message || "Failed to initiate deposit");
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScreenHeader title="INTERAC e-Transfer®" onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

          {/* Hero info banner */}
          <LinearGradient colors={["#315CFD", "#1E3FBF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <View style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.06)" }} />
            <View style={s.heroIcon}><AppText style={{ fontSize: 28 }}>🇨🇦</AppText></View>
            <View style={{ flex: 1 }}>
              <AppText style={s.heroTitle}>INTERAC e-Transfer®</AppText>
              <AppText style={s.heroSub}>Instant deposits from your Canadian bank account</AppText>
            </View>
          </LinearGradient>

          {/* How it works */}
          <View style={s.card}>
            <AppText style={s.cardLabel}>HOW IT WORKS</AppText>
            <StepRow num="1" title="Enter amount & confirm" desc="Specify how much CAD you want to deposit" />
            <View style={s.divider} />
            <StepRow num="2" title="Complete in your bank" desc="You'll be redirected to authorize the transfer" />
            <View style={s.divider} />
            <StepRow num="3" title="Funds credited instantly" desc="Your wallet is updated once transfer completes" />
          </View>

          {/* Amount */}
          <View style={s.card}>
            <AppText style={s.cardLabel}>AMOUNT TO DEPOSIT (CAD)</AppText>
            <View style={s.amtRow}>
              <AppText style={s.ccy}>$</AppText>
              <AppTextInput
                value={amount} onChangeText={setAmount}
                keyboardType="decimal-pad" placeholder="0.00"
                placeholderTextColor={COLORS.muted}
                style={s.amtInput}
              />
              <AppText style={s.ccyCode}>CAD</AppText>
            </View>
          </View>

          {/* Email */}
          <View style={s.card}>
            <AppText style={s.cardLabel}>YOUR EMAIL</AppText>
            <View style={s.inputBox}>
              <Ionicons name="mail-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
              <AppTextInput
                value={userEmail} onChangeText={setUserEmail}
                placeholder="email@example.com"
                placeholderTextColor={COLORS.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={s.input}
              />
            </View>
            <AppText style={s.hint}>This email receives the Interac transfer request</AppText>
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleDeposit}
            disabled={!canDeposit || loading}
            style={({ pressed }) => [s.cta, (!canDeposit || loading) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
          >
            <View style={s.ctaInner}>
              {loading ? <ActivityIndicator color={COLORS.actionText} /> : (
                <>
                  <Ionicons name="arrow-forward-outline" size={16} color={COLORS.actionText} style={{ marginRight: 6 }} />
                  <AppText style={s.ctaText}>Deposit via Interac</AppText>
                </>
              )}
            </View>
          </Pressable>

          <View style={s.secureRow}>
            <Ionicons name="lock-closed" size={12} color={COLORS.green} />
            <AppText style={s.secureText}> Secured by Paysafe · Interac e-Transfer®</AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16, overflow: "hidden" },
  heroIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  heroTitle: { fontSize: 14, fontWeight: "600", color: "#FFF", marginBottom: 3 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.80)", fontWeight: "500", lineHeight: 18 },
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  cardLabel: { fontSize: 11, fontWeight: "600", color: COLORS.muted, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 14 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 999, backgroundColor: COLORS.accent, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  stepNumText: { color: "#FFF", fontWeight: "600", fontSize: 12 },
  stepTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  stepDesc: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2, lineHeight: 17 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 12 },
  amtRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ccy: { fontSize: 28, fontWeight: "600", color: COLORS.muted },
  amtInput: { flex: 1, fontSize: 36, fontWeight: "600", color: COLORS.text, padding: 0 },
  ccyCode: { fontSize: 14, fontWeight: "600", color: COLORS.muted },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 48 },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  hint: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 8 },
  cta: { borderRadius: 16, overflow: "hidden", marginTop: 4, backgroundColor: COLORS.actionBg },
  ctaInner: { paddingVertical: 17, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.actionText, fontSize: 15, fontWeight: "600" },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 14 },
  secureText: { fontSize: 12, color: COLORS.muted, fontWeight: "600" },
});
