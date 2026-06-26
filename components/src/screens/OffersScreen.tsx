import React, { useEffect, useState } from "react";
import { View, Pressable, Image, ScrollView, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppText from "@/components/AppText";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, SCREEN_PADDING } from "@/theme/designSystem";
import { getActivePromotionalBanners, getUserProfile, PromotionalBanner } from "@/api/config";

function getAccentColor(banner: PromotionalBanner): string {
  return banner.backgroundColor || COLORS.primaryLight;
}

export default function OffersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState<PromotionalBanner[]>([]);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const phone = (await AsyncStorage.getItem("user_phone")) || "";
      let country: string | undefined;
      let verified = false;
      if (phone) {
        const profile = await getUserProfile(phone);
        if (profile.success && profile.user) {
          country = profile.user.countryCode || undefined;
          verified = profile.user.kycStatus === "verified";
        }
      }
      const res = await getActivePromotionalBanners({ country, verified });
      if (res.success) setOffers(res.banners);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <AppText style={s.headerTitle}>Offers</AppText>
        <AppText style={s.headerSubtitle}>Deals and promotions picked for you</AppText>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : offers.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="pricetags-outline" size={32} color={COLORS.muted} style={{ marginBottom: 10 }} />
          <AppText style={s.emptyText}>No offers right now</AppText>
          <AppText style={s.emptySub}>Check back soon for new deals and promotions.</AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
        >
          {offers.map((offer, i) => (
            <View key={offer.id || i}>
              <Pressable
                onPress={() => router.push({ pathname: "/offerdetail" as any, params: { offer: JSON.stringify(offer) } as any })}
                style={s.row}
              >
                {offer.imageUrl ? (
                  <Image source={{ uri: offer.imageUrl }} style={s.thumb} resizeMode="cover" />
                ) : (
                  <View style={[s.thumb, s.thumbFallback, { backgroundColor: getAccentColor(offer) }]}>
                    <Ionicons name="pricetag" size={20} color={offer.textColor || COLORS.primary} />
                  </View>
                )}

                <View style={s.rowInfo}>
                  {!!offer.title && <AppText style={s.rowTitle} numberOfLines={1}>{offer.title}</AppText>}
                  {!!(offer.subtitle || (offer as any).detailsBody) && <AppText style={s.rowSubtitle} numberOfLines={2}>{offer.subtitle || (offer as any).detailsBody}</AppText>}
                </View>

                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
              </Pressable>
              {i < offers.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.sm, paddingBottom: SPACE.lg },
  headerTitle: { fontSize: 26, fontWeight: "700", color: COLORS.text },
  headerSubtitle: { fontSize: 13, color: COLORS.muted, fontWeight: "500", marginTop: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  emptyText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.muted, fontWeight: "500", marginTop: 4, textAlign: "center" },
  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: SPACE.lg, gap: SPACE.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.borderLight },
  thumb: { width: 52, height: 52, borderRadius: RADIUS.md },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  rowSubtitle: { fontSize: 13, color: COLORS.muted, fontWeight: "500", marginTop: 2, lineHeight: 18 },
});
