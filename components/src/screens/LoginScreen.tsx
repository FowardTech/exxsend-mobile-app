import React, { useMemo, useState, useCallback, useEffect } from "react";
import { View, Pressable, Alert, Modal, ScrollView, ActivityIndicator, Platform, StyleSheet } from "react-native";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import CountryDropdown, { Country } from "../../../components/CountryDropdown";
import { COLORS } from "../../../theme/colors";
import { api, checkPhoneExists, login } from "../../../api/config";

const API_BASE_URL = Platform.OS === "android"
  ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID
  : process.env.EXPO_PUBLIC_API_BASE_URL_IOS;

export default function LoginScreen() {
  const router = useRouter();
  const [country, setCountry] = useState<Country | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioType, setBioType] = useState<string | null>(null);
  const [savedUserName, setSavedUserName] = useState<string | null>(null);
  const [screenMode, setScreenMode] = useState<"biometric" | "password">("password");
  const [suspendedModalVisible, setSuspendedModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalTitle, setLegalModalTitle] = useState("");
  const [legalSections, setLegalSections] = useState<any[]>([]);
  const [legalMeta, setLegalMeta] = useState<any>({});
  const [legalLoading, setLegalLoading] = useState(false);

  const canLogin = useMemo(() => phone.trim().length >= 6 && password.trim().length >= 4 && !loading, [phone, password, loading]);

  useEffect(() => {
    (async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        // Biometric re-login only makes sense if we actually have a saved
        // session to resume, AND the user has explicitly turned this on via
        // Security & Privacy (biometric_enabled). Without the saved-session
        // check, the button showed up purely based on OS-level Face ID/Touch
        // ID enrollment — so a user who had never logged in on this device
        // (no auth_token saved yet) would still see "Continue with Face ID",
        // pass the OS prompt successfully, and then immediately hit "Session
        // expired" since there was never a session to resume in the first
        // place. Without the biometric_enabled check, the button would show
        // regardless of whether the user ever opted in via the in-app
        // toggle, and toggling that setting would have no visible effect.
        const savedToken = await AsyncStorage.getItem("auth_token");
        const savedPhone = await AsyncStorage.getItem("user_phone");
        const bioEnabledSetting = await AsyncStorage.getItem("biometric_enabled");

        const storedUser = await AsyncStorage.getItem("user_info");
        if (storedUser) {
          try {
            const u = JSON.parse(storedUser);
            const name = u.firstName || u.first_name || u.name || null;
            setSavedUserName(name);
          } catch {}
        }

        if (compatible && enrolled && savedToken && savedPhone && bioEnabledSetting === "true") {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          setBioAvailable(true);
          setBioType(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? "Face ID" : "Touch ID");
          // NOTE: screenMode is intentionally never set to "biometric" here
          // anymore. The real, reachable biometric lock now happens at the
          // app layout level (see app/_layout.tsx + components/AppLockScreen)
          // — it gates the whole app on cold start and every foreground
          // transition, before this screen could ever be reached with a
          // still-valid token. This screen is now only ever reached once
          // there's truly no session to resume (expired/logged out), where
          // showing a biometric *re-entry* prompt wouldn't make sense.
          // setScreenMode("biometric");
        }
      } catch {}
    })();
  }, []);

  const showLegalDocument = useCallback(async (docType: "terms" | "privacy") => {
    setLegalLoading(true);
    setLegalModalVisible(true);
    setLegalModalTitle(docType === "terms" ? "Terms and Conditions" : "Privacy Policy");
    setLegalSections([]);
    try {
      const res = await fetch(`${API_BASE_URL}/legal/${docType}`);
      const data = await res.json();
      if (data.success && data.document) { setLegalSections(data.document.sections); setLegalMeta(data.document.meta || {}); setLegalModalTitle(data.document.title || legalModalTitle); }
    } catch { Alert.alert("Error", "Could not load document."); setLegalModalVisible(false); }
    finally { setLegalLoading(false); }
  }, []);

  const replacePlaceholders = (text: string) =>
    text.replace(/\{\{COMPANY\}\}/g, legalMeta.companyName || "Exxsend")
        .replace(/\{\{WEBSITE\}\}/g, legalMeta.website || "www.exxsend.com")
        .replace(/\{\{EMAIL\}\}/g, legalMeta.supportEmail || "support@exxsend.com");

  const handleLogin = async () => {
    if (!canLogin) return;
    const fullPhone = `${country?.dialCode ?? ""}${phone.trim()}`;
    setLoading(true);
    try {
      const checkResult = await checkPhoneExists(fullPhone);
      if (!checkResult.exists) {
        Alert.alert("Account Not Found", "This phone number is not registered. Would you like to sign up?", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Up", onPress: () => router.push("/getstarted") },
        ]);
        return;
      }
      const loginResult = await login(fullPhone, password);
      if (loginResult.user?.status === "suspended" || loginResult.suspended) { setSuspendedModalVisible(true); return; }
      if (!loginResult.success) { Alert.alert("Login Failed", loginResult.message || "Invalid credentials"); return; }
      await AsyncStorage.setItem("user_phone", fullPhone);
      await AsyncStorage.setItem("auth_token", loginResult.auth_token || loginResult.accessToken || loginResult.token);
      await AsyncStorage.removeItem("signup_stage");
      if (loginResult.user) await AsyncStorage.setItem("user_info", JSON.stringify(loginResult.user));
      router.replace("/(tabs)");
    } catch (error: any) {
      if (error.message?.toLowerCase().includes("suspended")) setSuspendedModalVisible(true);
      else Alert.alert("Error", error.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: `Login with ${bioType}`, fallbackLabel: "Use password" });
      if (!result.success) return;
      const savedPhone = await AsyncStorage.getItem("user_phone");
      const savedToken = await AsyncStorage.getItem("auth_token");
      if (!savedPhone || !savedToken) {
        Alert.alert("Session expired", "Please log in with your password.");
        setScreenMode("password");
        return;
      }
      router.replace("/(tabs)");
    } catch { Alert.alert("Biometric authentication failed"); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Legal Modal */}
      <Modal animationType="slide" transparent={false} visible={legalModalVisible} onRequestClose={() => setLegalModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View style={s.modalHeader}>
            <Pressable onPress={() => setLegalModalVisible(false)} style={s.modalClose}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </Pressable>
            <AppText style={s.modalTitle}>{legalModalTitle}</AppText>
            <View style={{ width: 36 }} />
          </View>
          {legalLoading ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color={COLORS.primary} /></View> : (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {legalMeta.effectiveDate && <AppText style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>Effective: {legalMeta.effectiveDate}</AppText>}
              {legalSections.map((sec: any, i: number) => (
                <View key={sec.id || i} style={{ marginBottom: 20 }}>
                  <AppText style={{ fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 6 }}>{sec.title}</AppText>
                  <AppText style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 }}>{replacePlaceholders(sec.content)}</AppText>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Suspended Modal */}
      <Modal animationType="fade" transparent visible={suspendedModalVisible} onRequestClose={() => setSuspendedModalVisible(false)}>
        <View style={s.suspendedOverlay}>
          <View style={s.suspendedCard}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(239,68,68,0.10)", justifyContent: "center", alignItems: "center", marginBottom: 14 }}>
              <Ionicons name="close-circle-outline" size={28} color={COLORS.red} />
            </View>
            <AppText style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, textAlign: "center", marginBottom: 10 }}>Account Suspended</AppText>
            <AppText style={{ fontSize: 14, color: COLORS.muted, textAlign: "center", lineHeight: 22, marginBottom: 22 }}>Your account has been suspended. Please contact support for assistance.</AppText>
            <Pressable onPress={() => setSuspendedModalVisible(false)} style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, width: "100%", alignItems: "center" }}>
              <AppText style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>OK</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {screenMode === "biometric" && bioAvailable ? (
        <View style={{ flex: 1 }}>
          {/* Brand header bar */}
          <View style={s.brandBar}>
            <AppText style={s.brandBarText}>ExxSend</AppText>
          </View>

          <View style={s.bioScreen}>
            <AppText style={s.welcomeTitle}>
              Welcome Back{savedUserName ? `,\n${savedUserName}` : ""}
            </AppText>

            <View style={s.bioCard}>
              <AppText style={s.bioCardLabel}>{bioType} Unlock</AppText>
              <View style={s.bioIconCircle}>
                <Ionicons name={bioType === "Face ID" ? "scan-outline" : "finger-print-outline"} size={40} color={COLORS.primary} />
              </View>
            </View>

            <Pressable onPress={handleBiometricLogin} style={s.bioPrimaryBtn}>
              <AppText style={s.bioPrimaryBtnText}>Unlock with {bioType}</AppText>
            </Pressable>

            <Pressable onPress={() => setScreenMode("password")} style={s.usePasswordBtn}>
              <AppText style={s.usePasswordBtnText}>Use Password Instead</AppText>
            </Pressable>
          </View>
        </View>
      ) : (
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Brand bar */}
        <View style={s.brandBar}>
          <AppText style={s.brandBarText}>Exxsend</AppText>
        </View>

        {/* Title */}
        <View style={s.titleBlock}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <AppText style={s.loginTitle}>Login</AppText>
              <AppText style={s.loginSub}>Please enter your registered phone and password</AppText>
            </View>
            <Pressable onPress={() => router.push("/getstarted")}>
              <AppText style={{ fontSize: 14, fontWeight: "700", color: COLORS.primary }}>Sign up</AppText>
            </Pressable>
          </View>
        </View>

        {/* Form */}
        <View style={s.form}>
          <AppText style={s.fieldLabel}>Phone number</AppText>
          <View style={s.phoneRow}>
            <CountryDropdown value={country} onChange={setCountry} />
            <View style={s.phoneBox}>
              <AppText style={s.dialCode}>{country?.dialCode ?? ""}</AppText>
              <AppTextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={s.phoneInput} placeholder="Phone number" placeholderTextColor={COLORS.muted} />
            </View>
          </View>

          <AppText style={[s.fieldLabel, { marginTop: 18 }]}>Password</AppText>
          <View style={s.passwordBox}>
            <AppTextInput value={password} onChangeText={setPassword} secureTextEntry={!showPass} style={s.passwordInput} placeholder="Enter your password" placeholderTextColor={COLORS.muted} />
            <Pressable onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
              <Ionicons name={showPass ? "eye-outline" : "eye-off-outline"} size={20} color={COLORS.muted} />
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/reset-password")} style={{ alignSelf: "flex-end", marginTop: 10 }}>
            <AppText style={{ fontSize: 13, fontWeight: "700", color: COLORS.primary }}>Forgot password?</AppText>
          </Pressable>

          {/* Terms */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
            <AppText style={{ fontSize: 12, color: COLORS.muted }}>By logging in you agree to our </AppText>
            <Pressable onPress={() => showLegalDocument("terms")}><AppText style={{ fontSize: 12, color: COLORS.primary, fontWeight: "700" }}>Terms</AppText></Pressable>
            <AppText style={{ fontSize: 12, color: COLORS.muted }}> and </AppText>
            <Pressable onPress={() => showLegalDocument("privacy")}><AppText style={{ fontSize: 12, color: COLORS.primary, fontWeight: "700" }}>Privacy Policy</AppText></Pressable>
          </View>

          {/* Login CTA */}
          <Pressable
            onPress={handleLogin}
            disabled={!canLogin}
            style={({ pressed }) => [s.loginBtn, !canLogin && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
          >
            <View style={s.loginBtnInner}>
              {loading ? <ActivityIndicator color={COLORS.actionText} /> : <AppText style={s.loginBtnText}>Log in</AppText>}
            </View>
          </Pressable>

          {/* Biometric */}
          {bioAvailable && (
            <Pressable onPress={handleBiometricLogin} style={s.bioBtn}>
              <Ionicons name="finger-print-outline" size={20} color={COLORS.primary} />
              <AppText style={s.bioBtnText}>Continue with {bioType}</AppText>
            </Pressable>
          )}
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  titleBlock: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  loginTitle: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  loginSub: { fontSize: 13, color: COLORS.muted, fontWeight: "500", marginTop: 4, maxWidth: 220 },
  form: { padding: 24, paddingTop: 28 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  phoneRow: { flexDirection: "row", gap: 10 },
  phoneBox: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 54 },
  dialCode: { fontWeight: "700", color: COLORS.text, marginRight: 8 },
  phoneInput: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  passwordBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 54 },
  passwordInput: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  eyeBtn: { paddingLeft: 10, paddingVertical: 10 },
  loginBtn: { marginTop: 20, borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.actionBg },
  loginBtnInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  loginBtnText: { color: COLORS.actionText, fontSize: 16, fontWeight: "700" },
  bioBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.primaryLight },
  bioBtnText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  modalClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  modalTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: COLORS.text },
  suspendedOverlay: { flex: 1, backgroundColor: "rgba(12,26,46,0.50)", justifyContent: "center", alignItems: "center", padding: 32 },
  suspendedCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 28, alignItems: "center", width: "100%" },
  brandBar: { paddingTop: 14, paddingBottom: 18, alignItems: "center", marginTop: 15 },
  brandBarText: { color: COLORS.text, fontSize: 20, fontWeight: "600" },
  bioScreen: { flex: 1, paddingHorizontal: 24, paddingTop: 36 },
  welcomeTitle: { fontSize: 24, fontWeight: "700", color: COLORS.text, lineHeight: 32, marginBottom: 32 },
  bioCard: { backgroundColor: COLORS.bgTertiary, borderRadius: 18, paddingVertical: 36, alignItems: "center", marginBottom: 28 },
  bioCardLabel: { fontSize: 14, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 20 },
  bioIconCircle: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: COLORS.primary, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  bioPrimaryBtn: { backgroundColor: COLORS.actionBg, borderRadius: 16, paddingVertical: 17, alignItems: "center", marginBottom: 14 },
  bioPrimaryBtnText: { color: COLORS.actionText, fontSize: 16, fontWeight: "700" },
  usePasswordBtn: { alignItems: "center", paddingVertical: 10 },
  usePasswordBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: "700" },
});
