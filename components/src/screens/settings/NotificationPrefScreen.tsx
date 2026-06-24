import React, { useState, useEffect, useCallback } from "react";
import { View, Pressable, ScrollView, Switch, StyleSheet, StatusBar, Alert, ActivityIndicator, Platform } from "react-native";
import AppText from "../../../AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { COLORS } from "../../../../theme/colors";
import ScreenHeader from "../../../../components/ScreenHeader";
import { RADIUS, CARD_SHADOW, GLASS_BORDER } from "../../../../theme/designSystem";

const PREFS_KEY = "notification_preferences_v1";

interface Prefs {
  pushEnabled: boolean;
  emailEnabled: boolean;
  transfers: boolean;
  rates: boolean;
  security: boolean;
  promotions: boolean;
  news: boolean;
  account: boolean;
}

const DEFAULT_PREFS: Prefs = {
  pushEnabled: true,
  emailEnabled: true,
  transfers: true,
  rates: true,
  security: true,
  promotions: false,
  news: false,
  account: true,
};

interface PrefItem {
  key: keyof Prefs;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor?: string;
  title: string;
  subtitle: string;
}

const ITEMS: PrefItem[] = [
  { key: "transfers", icon: "arrow-forward-circle-outline", iconBg: COLORS.primaryLight, title: "Transfer updates", subtitle: "Sent, received and pending transfers" },
  { key: "rates",     icon: "trending-up-outline",          iconBg: "#FEF3C7", iconColor: COLORS.accentDark, title: "Rate alerts", subtitle: "When your target exchange rate is reached" },
  { key: "security",  icon: "shield-checkmark-outline",     iconBg: "#FEE2E2", iconColor: COLORS.red,  title: "Security alerts", subtitle: "Login attempts and unusual activity" },
  { key: "promotions",icon: "gift-outline",                 iconBg: COLORS.greenSoft, iconColor: COLORS.green, title: "Promotions & offers", subtitle: "Referral bonuses and special deals" },
  { key: "news",      icon: "newspaper-outline",            iconBg: "rgba(99,102,241,0.10)", iconColor: "#6366F1", title: "Product news", subtitle: "New features and improvements" },
  { key: "account",   icon: "person-circle-outline",        iconBg: COLORS.primaryLight, title: "Account updates", subtitle: "Profile and verification changes" },
];

async function requestPushPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export default function NotificationPrefScreen() {
  const router = useRouter();
  const [prefs, setPrefs]     = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Load saved prefs on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFS_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Prefs>;
          setPrefs({ ...DEFAULT_PREFS, ...saved });
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const savePrefs = useCallback(async (next: Prefs) => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      Alert.alert("Error", "Could not save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  const toggle = useCallback((key: keyof Prefs) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      savePrefs(next);
      return next;
    });
  }, [savePrefs]);

  const handlePushToggle = useCallback(async (val: boolean) => {
    if (val) {
      const granted = await requestPushPermission();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Push notifications are disabled. Please enable them in your device Settings.",
          [{ text: "OK" }]
        );
        return;
      }
    }
    setPrefs(prev => {
      const next = { ...prev, pushEnabled: val };
      savePrefs(next);
      return next;
    });
  }, [savePrefs]);

  const handleEmailToggle = useCallback((val: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, emailEnabled: val };
      savePrefs(next);
      return next;
    });
  }, [savePrefs]);

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
        title="Notifications"
        onBack={() => router.back()}
        right={
          saving
            ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 16 }} />
            : <View style={{ width: 34 }} />
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

        {/* Channel toggles */}
        <AppText style={s.sectionLabel}>CHANNELS</AppText>
        <View style={s.card}>
          <View style={s.row}>
            <View style={[s.iconWrap, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="phone-portrait-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowTitle}>Push notifications</AppText>
              <AppText style={s.rowSub}>Alerts sent directly to your device</AppText>
            </View>
            <Switch
              value={prefs.pushEnabled}
              onValueChange={handlePushToggle}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <View style={[s.iconWrap, { backgroundColor: "rgba(59,130,246,0.10)" }]}>
              <Ionicons name="mail-outline" size={18} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowTitle}>Email notifications</AppText>
              <AppText style={s.rowSub}>Alerts sent to your registered email</AppText>
            </View>
            <Switch
              value={prefs.emailEnabled}
              onValueChange={handleEmailToggle}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Per-type prefs */}
        <AppText style={s.sectionLabel}>NOTIFICATION TYPES</AppText>
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
                  value={prefs[item.key] as boolean}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                  disabled={!prefs.pushEnabled && !prefs.emailEnabled}
                />
              </View>
              {idx < ITEMS.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>

        {/* Info box */}
        <View style={s.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} style={{ marginRight: 8, marginTop: 1 }} />
          <AppText style={s.infoText}>
            Preferences are saved automatically. You can also manage system-level notification permissions in your device Settings.
          </AppText>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.borderLight, marginLeft: 66 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14, marginTop: 16 },
  infoText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: "600", lineHeight: 18 },
});
