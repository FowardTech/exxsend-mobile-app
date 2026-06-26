import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, Image, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { getReferralLeaderboard, ReferralLeaderboardEntry, ReferralLeaderboardMe } from "@/api/config";

type Period = "all" | "month" | "week";

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

const RANK_COLORS: Record<number, string> = { 1: "#D4AF37", 2: "#9CA3AF", 3: "#B08D57" };

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function LeaderboardAvatar({ name, photo, size = 40 }: { name: string; photo: string | null; size?: number }) {
  if (photo) {
    return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText style={[s.avatarFallbackText, { fontSize: size * 0.36 }]}>{initials(name)}</AppText>
    </View>
  );
}

export default function ReferralLeaderboardScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("all");
  const [leaders, setLeaders] = useState<ReferralLeaderboardEntry[]>([]);
  const [me, setMe] = useState<ReferralLeaderboardMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: Period) => {
    const phone = (await AsyncStorage.getItem("user_phone")) || undefined;
    const res = await getReferralLeaderboard({ period: p, limit: 50, phone });
    if (res.success) {
      setLeaders(res.leaders);
      setMe(res.me);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { setLoading(true); load(period); }, [period, load]);

  const onRefresh = () => { setRefreshing(true); load(period); };

  // If "me" is already visible in the rendered list, don't show a second,
  // redundant pinned row for the exact same person.
  const meVisibleInList = !!me && leaders.some((l) => l.userId === me.userId);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <AppText style={s.headerTitle}>Referral Leaderboard</AppText>
        <View style={{ width: 34 }} />
      </View>

      <View style={s.tabsRow}>
        {PERIODS.map((p) => (
          <Pressable key={p.value} onPress={() => setPeriod(p.value)} style={[s.tab, period === p.value && s.tabActive]}>
            <AppText style={[s.tabText, period === p.value && s.tabTextActive]}>{p.label}</AppText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="small" color={COLORS.primary} /></View>
      ) : leaders.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="trophy-outline" size={28} color={COLORS.muted} style={{ marginBottom: 10 }} />
          <AppText style={s.emptyText}>No referrals on the board yet for this period.</AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {leaders.map((entry) => (
            <View key={entry.userId} style={[s.row, entry.isMe && s.rowMe]}>
              <View style={s.rankWrap}>
                {entry.rank <= 3 ? (
                  <Ionicons name="trophy" size={18} color={RANK_COLORS[entry.rank]} />
                ) : (
                  <AppText style={s.rankText}>{entry.rank}</AppText>
                )}
              </View>
              <LeaderboardAvatar name={entry.name} photo={entry.profilePhoto} />
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <AppText style={s.rowName} numberOfLines={1}>
                  {entry.firstName || entry.name}{entry.isMe ? " (You)" : ""}
                </AppText>
                {!!entry.username && <AppText style={s.rowUsername}>@{entry.username}</AppText>}
              </View>
              <AppText style={s.rowCount}>{entry.referrals}</AppText>
            </View>
          ))}
        </ScrollView>
      )}

      {!!me && !meVisibleInList && (
        <View style={s.meFooter}>
          <View style={s.rankWrap}>
            <AppText style={s.rankText}>{me.rank ?? "—"}</AppText>
          </View>
          <LeaderboardAvatar name={me.name} photo={me.profilePhoto} size={36} />
          <View style={{ flex: 1, marginLeft: SPACE.md }}>
            <AppText style={s.rowName} numberOfLines={1}>{me.firstName || me.name} (You)</AppText>
            <AppText style={s.rowUsername}>
              {me.rank == null ? "Refer a friend to get on the board" : `@${me.username}`}
            </AppText>
          </View>
          <AppText style={s.rowCount}>{me.referrals}</AppText>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  emptyText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },

  tabsRow: { flexDirection: "row", paddingHorizontal: SCREEN_PADDING, gap: SPACE.sm, marginBottom: SPACE.md },
  tab: { flex: 1, alignItems: "center", paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.full, backgroundColor: COLORS.white, ...GLASS_BORDER },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 12.5, fontWeight: "700", color: COLORS.muted },
  tabTextActive: { color: "#FFFFFF" },

  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: SPACE.md, paddingHorizontal: SPACE.md, borderRadius: RADIUS.md, marginBottom: SPACE.xs },
  rowMe: { backgroundColor: COLORS.primaryLight },
  rankWrap: { width: 28, alignItems: "center" },
  rankText: { fontSize: 14, fontWeight: "700", color: COLORS.muted },
  rowName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  rowUsername: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 1 },
  rowCount: { fontSize: 15, fontWeight: "700", color: COLORS.primary },

  avatarFallback: { backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontWeight: "700", color: COLORS.primary },

  meFooter: { flexDirection: "row", alignItems: "center", paddingVertical: SPACE.md, paddingHorizontal: SCREEN_PADDING, backgroundColor: COLORS.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
});
