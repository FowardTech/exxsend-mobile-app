import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "./AppText";
import { COLORS } from "../theme/colors";
import { SPACE, RADIUS } from "../theme/designSystem";

interface Props {
  bioType: string;
  onPress: () => void;
  onDismiss: () => void;
}

export default function BiometricPromptBanner({ bioType, onPress, onDismiss }: Props) {
  const iconName = bioType === "Face ID" ? "scan-outline" : bioType === "Touch ID" ? "finger-print-outline" : "lock-closed-outline";

  return (
    <Pressable onPress={onPress} style={s.wrap}>
      <View style={s.iconCircle}>
        <Ionicons name={iconName} size={16} color={COLORS.primary} />
      </View>
      <AppText style={s.text} numberOfLines={2}>
        Turn on {bioType} for faster, more secure sign-in
      </AppText>
      <Pressable onPress={onDismiss} hitSlop={10} style={s.closeBtn}>
        <Ionicons name="close" size={15} color={COLORS.muted} />
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.sm + 2,
    paddingHorizontal: SPACE.md,
    marginBottom: SPACE.md,
    gap: SPACE.sm,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, fontSize: 12.5, fontWeight: "600", color: COLORS.primary, lineHeight: 17 },
  closeBtn: { padding: 2 },
});
