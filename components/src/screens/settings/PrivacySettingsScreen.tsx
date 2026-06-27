import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../../../../components/ScreenHeader";
import { COLORS } from "../../../../theme/colors";
import { CARD_SHADOW, GLASS_BORDER, RADIUS } from "../../../../theme/designSystem";
import AppText from "../../../AppText";

const PREFS_KEY = "privacy_preferences_v1";

interface PrivacyPrefs {
  personalizedOffers: boolean;
  analyticsSharing: boolean;
  thirdPartyMarketing: boolean;
}

const DEFAULT_PREFS: PrivacyPrefs = {
  personalizedOffers: true,
  analyticsSharing: true,
  thirdPartyMarketing: false,
};

interface PrefItem {
  key: keyof PrivacyPrefs;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor?: string;
  title: string;
  subtitle: string;
}

const ITEMS: PrefItem[] = [
  {
    key: "personalizedOffers",
    icon: "pricetag-outline",
    iconBg: COLORS.greenSoft,
    iconColor: COLORS.green,
    title: "Personalized offers",
    subtitle: "Use my activity to show relevant rates and promotions",
  },
  {
    key: "analyticsSharing",
    icon: "stats-chart-outline",
    iconBg: COLORS.primaryLight,
    title: "Usage analytics",
    subtitle: "Help us improve the app by sharing anonymized usage data",
  },
  {
    key: "thirdPartyMarketing",
    icon: "megaphone-outline",
    iconBg: "#FEF3C7",
    iconColor: COLORS.accentDark,
    title: "Third-party marketing",
    subtitle: "Allow trusted partners to send you offers",
  },
];

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFS_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<PrivacyPrefs>;
          setPrefs({ ...DEFAULT_PREFS, ...saved });
        }
      } catch { }
      setLoading(false);
    })();
  }, []);

  const savePrefs = useCallback(async (next: PrivacyPrefs) => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      Alert.alert("Error", "Could not save your preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  const toggle = useCallback((key: keyof PrivacyPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savePrefs(next);
      return next;
    });
  }, [savePrefs]);

  const handleRequestData = () => {
    Alert.alert(
      "Request my data",
      "We'll email a copy of your account data to your registered email address within a few business days.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Request", onPress: () => Alert.alert("Request received", "We'll be in touch by email.") },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete my account",
      "This permanently deletes your ExxSend account and data. This can't be undone. Contact support to proceed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Contact Support", style: "destructive", onPress: () => router.push("/support") },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScreenHeader
        title="Privacy Settings"
        onBack={() => router.back()}
        right={
          saving
            ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 16 }} />
            : <View style={{ width: 34 }} />
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
        <AppText style={s.sectionLabel}>DATA & PERSONALIZATION</AppText>
        <View style={s.card}>
          {ITEMS.map((item, idx) => (
            <View key={item.key}>
              <View style={s.row}>
                <View style={[s.iconWrap, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon} size={18} color={item.iconColor || COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={s.rowTitle}>{item.title}</AppText>
                  <AppText style={s.rowSub}>{item.subtitle}</AppText>
                </View>
                <Switch
                  value={prefs[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {idx < ITEMS.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>

        <AppText style={s.sectionLabel}>YOUR DATA</AppText>
        <View style={s.card}>
          <Pressable style={s.row} onPress={handleRequestData}>
            <View style={[s.iconWrap, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="download-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowTitle}>Request a copy of my data</AppText>
              <AppText style={s.rowSub}>Get an export of your account information</AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
          <View style={s.divider} />
          <Pressable
            style={s.row}
            onPress={() => Linking.openURL("https://exxsend.com/privacy-policy").catch(() => { })}
          >
            <View style={[s.iconWrap, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowTitle}>Privacy Policy</AppText>
              <AppText style={s.rowSub}>Read how we collect and use your data</AppText>
            </View>
            <Ionicons name="open-outline" size={16} color={COLORS.muted} />
          </Pressable>
          <View style={s.divider} />
          <Pressable style={s.row} onPress={handleDeleteAccount}>
            <View style={[s.iconWrap, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="trash-outline" size={18} color={COLORS.red} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[s.rowTitle, { color: COLORS.red }]}>Delete my account</AppText>
              <AppText style={s.rowSub}>Permanently remove your account and data</AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
        </View>

        <View style={s.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} style={{ marginRight: 8, marginTop: 1 }} />
          <AppText style={s.infoText}>
            Preferences are saved automatically. Turning these off won't affect transaction
            notifications or information we're required to keep for regulatory purposes.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: COLORS.muted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.borderLight, marginLeft: 66 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14, marginTop: 16 },
  infoText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: "600", lineHeight: 18 },
});
