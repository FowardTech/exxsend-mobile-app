import React, { useCallback, useMemo, useState } from "react";
import { View, Pressable, Alert, ActivityIndicator, Modal, ScrollView, Platform, StyleSheet } from "react-native";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Checkbox from "expo-checkbox";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import CountryDropdown from "../../../components/CountryDropdown";
import { api, checkPhoneExists } from "../../../api/config";
import { COLORS } from "../../../theme/colors";

const API_BASE_URL = Platform.OS === "android"
  ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID
  : process.env.EXPO_PUBLIC_API_BASE_URL_IOS;

interface Country { code: string; name: string; symbol?: string; flag?: string; dialCode?: string; }
interface LegalSection { id: string; title: string; content: string; }

export default function GetStartedScreen() {
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalTitle, setLegalTitle] = useState("");
  const [legalSections, setLegalSections] = useState<LegalSection[]>([]);
  const [legalMeta, setLegalMeta] = useState<any>({});
  const [legalLoading, setLegalLoading] = useState(false);

  const digitsOnly = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const fullPhone = useMemo(() => !country ? "" : `${country.dialCode}${digitsOnly}`, [country, digitsOnly]);
  const isValidPhone = digitsOnly.length >= 7;
  const canContinue = !!country && isValidPhone && termsAccepted && !loading;

  const replacePlaceholders = (text: string, meta: any) =>
    text.replace(/\{\{COMPANY\}\}/g, meta.companyName || "")
        .replace(/\{\{EMAIL\}\}/g, meta.supportEmail || "")
        .replace(/\{\{WEBSITE\}\}/g, meta.website || "")
        .replace(/\{\{DATE\}\}/g, meta.effectiveDate || "")
        .replace(/\{\{JURISDICTION\}\}/g, meta.jurisdiction || "");

  const showLegalDocument = useCallback(async (docType: "terms" | "privacy") => {
    setLegalTitle(docType === "terms" ? "Terms & Conditions" : "Privacy Policy");
    setLegalSections([]); setLegalMeta({}); setLegalModalVisible(true); setLegalLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/legal/${docType}`);
      const data = await res.json();
      if (data.success && data.document) { setLegalSections(data.document.sections || []); setLegalMeta(data.document.meta || {}); setLegalTitle(data.document.title || legalTitle); }
    } catch { setLegalSections([{ id: "error", title: "Error", content: "Could not load document. Please try again later." }]); }
    finally { setLegalLoading(false); }
  }, []);

  const handleContinue = async () => {
    if (!canContinue) return;
    setLoading(true);
    try {
      const checkResult = await checkPhoneExists(fullPhone);
      if (checkResult?.exists) { Alert.alert("Account Exists", checkResult?.message || "This phone number is already registered. Please sign in instead."); return; }
      const result = await api.sendOtp(fullPhone);
      if (result?.success) {
        await AsyncStorage.setItem("user_phone", fullPhone);
        await AsyncStorage.setItem("user_country_code", country!.code);
        await AsyncStorage.setItem("user_country_name", country!.name);
        await AsyncStorage.setItem("user_country_flag", country!.flag ?? "");
        router.push({ pathname: "/verifynumber", params: { phone: fullPhone, requestId: result.request_id || result.requestId || "" } });
      } else { Alert.alert("Error", result?.message || "Failed to send OTP"); }
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Modal animationType="slide" transparent={false} visible={legalModalVisible} onRequestClose={() => setLegalModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View style={s.modalHeader}>
            <Pressable onPress={() => setLegalModalVisible(false)} style={s.modalClose}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </Pressable>
            <AppText style={s.modalTitle}>{legalTitle}</AppText>
            <View style={{ width: 36 }} />
          </View>
          {legalLoading ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color={COLORS.primary} /></View> : (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {legalMeta.effectiveDate && <AppText style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>Effective: {legalMeta.effectiveDate}</AppText>}
              {legalSections.map((sec) => (
                <View key={sec.id} style={{ marginBottom: 20 }}>
                  <AppText style={{ fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 6 }}>{sec.title}</AppText>
                  <AppText style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 }}>{replacePlaceholders(sec.content, legalMeta)}</AppText>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Brand bar */}
        <View style={s.brandBar}>
          <AppText style={s.brandBarText}>ExxSend</AppText>
        </View>
        {/* Header */}
        <View style={s.plainSignupHeader}>
          <View style={s.plainLogoWrap}>
            <Ionicons name="arrow-forward-circle-outline" size={24} color={COLORS.primary} />
          </View>
          <Pressable onPress={() => router.push("/login")}>
            <AppText style={s.plainSignInLink}>Sign in</AppText>
          </Pressable>
        </View>
        {/* <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}>
          <AppText style={s.plainHeroTitle}>Send money globally</AppText>
          <AppText style={s.plainHeroSub}>Fast, secure transfers to over 100 countries</AppText>
        </View> */}

        {/* Form */}
        <View style={s.form}>
          <AppText style={s.formHeading}>Create your account</AppText>
          <AppText style={s.formSub}>Enter your phone number to get started</AppText>

          <View style={[s.phoneRow, { marginTop: 22 }]}>
            <CountryDropdown value={country} onChange={setCountry} />
            <View style={s.phoneBox}>
              <AppText style={s.dialCode}>{country?.dialCode || ""}</AppText>
              <AppTextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={s.phoneInput}
                placeholder="Phone number"
                placeholderTextColor={COLORS.muted}
              />
            </View>
          </View>

          {/* Terms */}
          <Pressable onPress={() => setTermsAccepted(p => !p)} style={s.termsRow}>
            <Checkbox value={termsAccepted} onValueChange={setTermsAccepted} color={termsAccepted ? COLORS.primary : undefined} style={{ borderRadius: 6 }} />
            <AppText style={s.termsText}>
              I agree to the{" "}
              <AppText style={s.termsLink} onPress={() => showLegalDocument("terms")}>Terms of Service</AppText>
              {" "}and{" "}
              <AppText style={s.termsLink} onPress={() => showLegalDocument("privacy")}>Privacy Policy</AppText>
            </AppText>
          </Pressable>

          {/* CTA */}
          <Pressable onPress={handleContinue} disabled={!canContinue} style={({ pressed }) => [s.ctaBtn, !canContinue && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
            <View style={s.ctaBtnInner}>
              {loading ? <ActivityIndicator color={COLORS.actionText} /> : <AppText style={s.ctaBtnText}>Continue</AppText>}
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
            <AppText style={{ fontSize: 14, color: COLORS.muted, fontWeight: "600" }}>Already have an account? </AppText>
            <Pressable onPress={() => router.push("/login")}>
              <AppText style={{ fontSize: 14, color: COLORS.primary, fontWeight: "700" }}>Sign in</AppText>
            </Pressable>
          </View>

          {/* Trust badges */}
          <View style={s.trustRow}>
            {[{ icon: "shield-checkmark-outline", label: "Bank-level security" }, { icon: "globe-outline", label: "100+ countries" }, { icon: "flash-outline", label: "Instant transfers" }].map((b) => (
              <View key={b.label} style={s.trustBadge}>
                <Ionicons name={b.icon as any} size={16} color={COLORS.primary} />
                <AppText style={s.trustLabel}>{b.label}</AppText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  plainSignupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16 },
  plainLogoWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  plainSignInLink: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  plainHeroTitle: { fontSize: 24, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  plainHeroSub:   { fontSize: 14, color: COLORS.muted, fontWeight: "500" },
  form: { padding: 24, paddingTop: 28 },
  formHeading: { fontSize: 22, fontWeight: "700", color: COLORS.text },
  brandBar: { paddingTop: 14, paddingBottom: 18, alignItems: "center" },
  brandBarText: { color: COLORS.primary, fontSize: 20, fontWeight: "700" },
  formSub: { fontSize: 14, color: COLORS.muted, fontWeight: "500", marginTop: 4 },
  phoneRow: { flexDirection: "row", gap: 10 },
  phoneBox: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 54 },
  dialCode: { fontWeight: "700", color: COLORS.text, marginRight: 8 },
  phoneInput: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  termsRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, gap: 12 },
  termsText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontWeight: "500", lineHeight: 20 },
  termsLink: { color: COLORS.primary, fontWeight: "700" },
  ctaBtn: { marginTop: 22, borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.actionBg },
  ctaBtnInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  ctaBtnText: { color: COLORS.actionText, fontSize: 16, fontWeight: "700" },
  trustRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  trustBadge: { alignItems: "center", gap: 6, flex: 1 },
  trustLabel: { fontSize: 11, fontWeight: "600", color: COLORS.muted, textAlign: "center" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  modalClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  modalTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: COLORS.text },
});
