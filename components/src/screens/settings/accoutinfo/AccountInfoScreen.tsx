import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import ScreenShell from "../../../../../components/ScreenShell";
import { COLORS } from "../../../../../theme/colors";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "../../../../../theme/designSystem";
import AppText from "../../../../AppText";
import BackButton from "../../../../BackButton";

function Item({
  icon,
  title,
  rightText,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  rightText?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[s.item, !isLast && s.divider]}>
      <View style={s.itemLeft}>
        <View style={s.iconCircle}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <AppText style={s.itemTitle}>{title}</AppText>
      </View>

      <View style={s.itemRight}>
        {!!rightText && <AppText style={s.rightText}>{rightText}</AppText>}
        <Ionicons name="chevron-forward" size={18} color={COLORS.border} />
      </View>
    </Pressable>
  );
}

export default function AccountInformationScreen() {
  const router = useRouter();

  return (
    <ScreenShell padded={false}>
      <View style={s.header}>
        <BackButton onPress={() => router.back()} />
        <AppText style={s.headerTitle}>Account Information</AppText>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.card}>
        <Item
          icon="person-outline"
          title="Profile"
          onPress={() => router.push("/userdetails" as any)}
        />
        <Item
          icon="speedometer-outline"
          title="Account limits"
          onPress={() => router.push("/accountlimit" as any)}
        />
        {/* <Item
            icon="document-text-outline"
            title="Account statement"
            onPress={() => router.push("/accountstatement" as any)}
          />
          <Item
            icon="globe-outline"
            title="Language"
            rightText="English"
            onPress={() => router.push("/language" as any)}
            isLast
          /> */}
      </View>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.sm + 2,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },

  card: {
    marginTop: SPACE.md,
    marginHorizontal: SCREEN_PADDING,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  item: {
    paddingHorizontal: SPACE.md + 2,
    paddingVertical: SPACE.lg - 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE.sm + 2,
  },
  itemTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  itemRight: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  rightText: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
});
