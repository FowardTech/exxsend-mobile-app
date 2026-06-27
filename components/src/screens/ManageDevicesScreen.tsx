import { DeviceRecord, listDevices, revokeDevice } from "@/api/devices";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import { COLORS } from "@/theme/colors";
import { GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function platformIcon(platform?: string): string {
  return platform === "ios" ? "logo-apple" : platform === "android" ? "logo-android" : "phone-portrait-outline";
}

function formatLastSeen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Active now";
  if (mins < 60) return `Active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Active ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Active ${days}d ago`;
}

export default function ManageDevicesScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async (p: string) => {
    const res = await listDevices(p);
    if (res.success) setDevices(res.devices);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    (async () => {
      const p = (await AsyncStorage.getItem("user_phone")) || "";
      setPhone(p);
      if (p) load(p);
      else setLoading(false);
    })();
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(phone); };

  const handleRevoke = (device: DeviceRecord) => {
    if (device.isCurrent) {
      Alert.alert(
        "This is your current device",
        "Revoking this device will sign you out right now. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: () => doRevoke(device, true) },
        ]
      );
      return;
    }
    Alert.alert(
      "Revoke device",
      `Sign out "${device.deviceName || "this device"}"? It will need to be verified again to sign back in.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Revoke", style: "destructive", onPress: () => doRevoke(device, false) },
      ]
    );
  };

  const doRevoke = async (device: DeviceRecord, isCurrent: boolean) => {
    setRevokingId(device.deviceId);
    try {
      const res = await revokeDevice(phone, device.deviceId);
      if (res.success) {
        if (isCurrent) {
          await AsyncStorage.removeItem("auth_token");
          router.replace("/login" as any);
          return;
        }
        setDevices((prev) => prev.filter((d) => d.deviceId !== device.deviceId));
      } else {
        Alert.alert("Couldn't revoke device", res.message || "Please try again.");
      }
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <AppText style={s.headerTitle}>Manage Devices</AppText>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="small" color={COLORS.primary} /></View>
      ) : devices.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="phone-portrait-outline" size={28} color={COLORS.muted} style={{ marginBottom: 10 }} />
          <AppText style={s.emptyText}>No devices found.</AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {devices.map((d) => (
            <View key={d.deviceId} style={s.card}>
              <View style={s.cardIcon}>
                <Ionicons name={platformIcon(d.platform) as any} size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <View style={s.nameRow}>
                  <AppText style={s.deviceName} numberOfLines={1}>{d.deviceName || "Unknown device"}</AppText>
                  {d.isCurrent && (
                    <View style={s.currentPill}>
                      <AppText style={s.currentPillText}>This device</AppText>
                    </View>
                  )}
                </View>
                <AppText style={s.deviceMeta} numberOfLines={1}>
                  {[d.model, d.osVersion ? `OS ${d.osVersion}` : null].filter(Boolean).join(" · ")}
                </AppText>
                {!!formatLastSeen(d.lastSeenAt) && <AppText style={s.lastSeen}>{formatLastSeen(d.lastSeenAt)}</AppText>}
              </View>
              <Pressable onPress={() => handleRevoke(d)} disabled={revokingId === d.deviceId} style={s.revokeBtn}>
                {revokingId === d.deviceId ? (
                  <ActivityIndicator size="small" color={COLORS.red} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },

  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.lg, marginBottom: SPACE.sm, ...GLASS_BORDER },
  cardIcon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  deviceName: { fontSize: 14, fontWeight: "600", color: COLORS.text, flexShrink: 1 },
  currentPill: { backgroundColor: "#D1FAE5", borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  currentPillText: { fontSize: 10, fontWeight: "600", color: "#059669" },
  deviceMeta: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  lastSeen: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  revokeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
