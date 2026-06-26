import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppText from "@/components/AppText";
import AppTextInput from "@/components/AppTextInput";
import BackButton from "@/components/BackButton";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { lookupExxsendMember, setUsername as setUsernameApi } from "@/api/config";

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function ChooseUsernameScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const p = (await AsyncStorage.getItem("user_phone")) || "";
      setPhone(p);
      const existing = await AsyncStorage.getItem("user_username");
      if (existing) { setCurrentUsername(existing); setValue(existing); }
    })();
  }, []);

  const checkAvailability = useCallback(async (candidate: string) => {
    if (!USERNAME_RE.test(candidate)) { setStatus("invalid"); return; }
    // Re-entering your own current username is always "fine" — there's no
    // point telling someone their own handle is taken.
    if (currentUsername && candidate === currentUsername) { setStatus("available"); return; }
    setStatus("checking");
    try {
      const res = await lookupExxsendMember(candidate, phone || undefined);
      setStatus(res?.success && res.member ? "taken" : "available");
    } catch {
      // Network hiccup during the live check shouldn't block submission —
      // the actual PATCH call below will be the authoritative check either way.
      setStatus("idle");
    }
  }, [phone, currentUsername]);

  const handleChangeText = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    setValue(cleaned);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!cleaned) { setStatus("idle"); return; }
    debounceRef.current = setTimeout(() => checkAvailability(cleaned), 450);
  };

  const canSubmit = status === "available" && value.length >= 3 && !saving;

  const handleSave = async () => {
    if (!phone) { Alert.alert("Not signed in", "Please sign in again and retry."); return; }
    if (!USERNAME_RE.test(value)) { setStatus("invalid"); return; }
    setSaving(true);
    try {
      const res = await setUsernameApi(phone, value);
      if (res.success) {
        await AsyncStorage.setItem("user_username", res.username || value);
        Alert.alert("Username set!", `You're now @${res.username || value} on Exxsend.`, [
          { text: "Done", onPress: () => router.back() },
        ]);
      } else {
        // The PATCH call is the real source of truth — if it rejects after
        // the live check said "available" (e.g. someone else claimed it in
        // the meantime), surface that rather than the stale local status.
        Alert.alert("Couldn't set username", res.message || "That username may already be taken. Try another.");
        setStatus("taken");
      }
    } catch (e: any) {
      Alert.alert("Something went wrong", e?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const statusLine = () => {
    switch (status) {
      case "checking": return { text: "Checking availability…", color: COLORS.muted };
      case "available": return { text: "Available", color: COLORS.green };
      case "taken": return { text: "Already taken — try another", color: COLORS.red };
      case "invalid": return { text: "3–20 characters: lowercase letters, numbers, underscores only", color: COLORS.red };
      default: return null;
    }
  };
  const line = statusLine();

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.header}>
          {router.canGoBack() && <BackButton onPress={() => router.back()} />}
        </View>

        <View style={s.body}>
          <View style={s.iconWrap}>
            <Ionicons name="at" size={28} color={COLORS.primary} />
          </View>
          <AppText style={s.title}>Choose your @username</AppText>
          <AppText style={s.subtitle}>
            Other Exxsend users can send you money instantly with this — no bank details needed.
          </AppText>

          <View style={[s.inputWrap, status === "invalid" || status === "taken" ? { borderColor: COLORS.red } : status === "available" ? { borderColor: COLORS.green } : null]}>
            <AppText style={s.atSign}>@</AppText>
            <AppTextInput
              value={value}
              onChangeText={handleChangeText}
              placeholder="yourname"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.input}
              maxLength={20}
            />
            {status === "checking" && <ActivityIndicator size="small" color={COLORS.muted} />}
            {status === "available" && <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />}
            {(status === "taken" || status === "invalid") && <Ionicons name="close-circle" size={20} color={COLORS.red} />}
          </View>
          {!!line && <AppText style={[s.statusText, { color: line.color }]}>{line.text}</AppText>}
        </View>

        <View style={s.footer}>
          <Pressable onPress={handleSave} disabled={!canSubmit} style={[s.saveBtn, !canSubmit && { opacity: 0.45 }]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <AppText style={s.saveBtnText}>Save username</AppText>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.sm },
  body: { flex: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.xl },
  iconWrap: { width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: SPACE.lg },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.muted, fontWeight: "500", marginTop: SPACE.sm, lineHeight: 20, marginBottom: SPACE.xxl },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg, height: 56,
    ...GLASS_BORDER, ...CARD_SHADOW,
  },
  atSign: { fontSize: 17, fontWeight: "700", color: COLORS.muted, marginRight: 2 },
  input: { flex: 1, fontSize: 17, fontWeight: "700", color: COLORS.text, paddingVertical: 0 },
  statusText: { fontSize: 12, fontWeight: "600", marginTop: SPACE.sm, marginLeft: 2 },
  footer: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.xl },
  saveBtn: { height: 54, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
