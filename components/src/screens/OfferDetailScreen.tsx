import React from "react";
import { View, Pressable, Image, ScrollView, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, SCREEN_PADDING } from "@/theme/designSystem";
import { PromotionalBanner } from "@/api/config";

export default function OfferDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ offer?: string }>();

  const offer: PromotionalBanner | null = React.useMemo(() => {
    if (!params.offer) return null;
    try { return JSON.parse(String(params.offer)); } catch { return null; }
  }, [params.offer]);

  const handleCta = () => {
    if (!offer) return;
    const target = offer.ctaUrl || offer.deeplink || offer.url;
    if (!target) return;
    if (/^https?:\/\//i.test(target)) {
      Linking.openURL(target).catch(() => {});
    } else {
      router.push(target.startsWith("/") ? (target as any) : (`/${target}` as any));
    }
  };

  if (!offer) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          {router.canGoBack() && <BackButton onPress={() => router.back()} />}
        </View>
        <View style={s.centered}>
          <AppText style={{ color: COLORS.muted }}>This offer isn't available anymore.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  // Some banners use ctaLabel/detailsBody instead of ctaText/subtitle —
  // confirmed from an actual backend response — so fall back across both
  // rather than assuming one naming convention.
  const ctaLabel = offer.ctaText || (offer as any).ctaLabel;
  const description = offer.subtitle || (offer as any).detailsBody;

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <View style={s.header}>
        {router.canGoBack() && <BackButton onPress={() => router.back()} />}
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {!!offer.imageUrl && (
          <Image source={{ uri: offer.imageUrl }} style={s.heroImage} resizeMode="cover" />
        )}

        <View style={s.content}>
          {!offer.imageUrl && (
            <View style={[s.iconWrap, { backgroundColor: offer.backgroundColor || COLORS.primaryLight }]}>
              <Ionicons name="pricetag" size={26} color={offer.textColor || COLORS.primary} />
            </View>
          )}

          {!!offer.title && <AppText style={s.title}>{offer.title}</AppText>}
          {!!description && <AppText style={s.subtitle}>{description}</AppText>}
        </View>
      </ScrollView>

      {!!(ctaLabel && (offer.ctaUrl || offer.deeplink || offer.url)) && (
        <View style={s.footer}>
          <Pressable onPress={handleCta} style={s.ctaBtn}>
            <AppText style={s.ctaBtnText}>{ctaLabel}</AppText>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.sm, paddingBottom: SPACE.xs },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  body: { paddingBottom: SPACE.huge },
  heroImage: { width: "100%", height: 220 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.lg },
  iconWrap: { width: 56, height: 56, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", marginBottom: SPACE.lg },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  subtitle: { fontSize: 15, color: COLORS.muted, fontWeight: "500", marginTop: SPACE.sm, lineHeight: 22 },
  footer: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.xl, paddingTop: SPACE.sm },
  ctaBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center" },
  ctaBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
