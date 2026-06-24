import React, { useRef, useState } from "react";
import { View, Pressable, ScrollView, Image, StyleSheet, Dimensions, Linking, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useRouter } from "expo-router";
import AppText from "@/components/AppText";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { PromotionalBanner } from "@/api/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - SCREEN_PADDING * 2;
const CARD_SPACING = SPACE.md;

interface Props {
  banners: PromotionalBanner[];
}

export default function PromoBannerCarousel({ banners }: Props) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePress = (banner: PromotionalBanner) => {
    const target = banner.ctaUrl || banner.deeplink || banner.url;
    if (!target) return;
    if (/^https?:\/\//i.test(target)) {
      Linking.openURL(target).catch(() => {});
    } else {
      // Treat anything else as an in-app route (e.g. "/referral", "/investoverview").
      router.push(target.startsWith("/") ? (target as any) : (`/${target}` as any));
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_SPACING));
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  if (banners.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, gap: CARD_SPACING }}
        onMomentumScrollEnd={handleScroll}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner.id}
            onPress={() => handlePress(banner)}
            style={[
              s.card,
              { width: CARD_WIDTH, backgroundColor: banner.imageUrl ? "transparent" : (banner.backgroundColor || COLORS.primaryLight) },
            ]}
          >
            {banner.imageUrl ? (
              <Image source={{ uri: banner.imageUrl }} style={s.image} resizeMode="cover" />
            ) : (
              <View style={s.textContent}>
                {!!banner.title && (
                  <AppText style={[s.title, banner.textColor ? { color: banner.textColor } : null]} numberOfLines={1}>
                    {banner.title}
                  </AppText>
                )}
                {!!banner.subtitle && (
                  <AppText style={[s.subtitle, banner.textColor ? { color: banner.textColor } : null]} numberOfLines={2}>
                    {banner.subtitle}
                  </AppText>
                )}
                {!!banner.ctaText && (
                  <View style={s.ctaPill}>
                    <AppText style={s.ctaPillText}>{banner.ctaText}</AppText>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {banners.length > 1 && (
        <View style={s.dotsRow}>
          {banners.map((_, i) => (
            <View key={i} style={[s.dot, i === activeIndex && s.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    height: 120,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  image: { width: "100%", height: "100%" },
  textContent: { flex: 1, padding: SPACE.lg, justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: COLORS.primaryDark },
  subtitle: { fontSize: 12, fontWeight: "600", color: COLORS.muted, marginTop: 4 },
  ctaPill: { alignSelf: "flex-start", backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACE.md, paddingVertical: 6, marginTop: SPACE.sm },
  ctaPillText: { fontSize: 12, fontWeight: "700", color: COLORS.white },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: SPACE.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.borderLight },
  dotActive: { backgroundColor: COLORS.primary, width: 16 },
});
