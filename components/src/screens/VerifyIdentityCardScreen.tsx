import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import AppText from "../../AppText";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/theme/colors";

interface Props {
  onPress: () => void;
  userPhone: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  disabled?: boolean;
  /** Controls icon/accent color — "warning" (default, amber) for
   * start/resume/retry, "info" (blue) while under review, "danger" (red)
   * for a final rejection that needs support. */
  tone?: "warning" | "info" | "danger";
}

const TONE_COLORS: Record<string, string> = {
  warning: "#D97706",
  info: COLORS.primary,
  danger: COLORS.red,
};

export default function VerifyIdentityCardScreen({
  onPress,
  userPhone,
  title = "Verify your identity",
  subtitle = "Unlock full features & sending limits",
  buttonText = "Start",
  disabled = false,
  tone = "warning",
}: Props) {
  const accent = TONE_COLORS[tone] || TONE_COLORS.warning;
  return (
    <View style={s.wrap}>
      <LinearGradient colors={["transparent", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        <View style={s.left}>
          <View style={s.iconCircle}>
            <Ionicons name={tone === "danger" ? "alert-circle-outline" : tone === "info" ? "time-outline" : "shield-checkmark-outline"} size={25} color={accent} />
          </View>
          <View style={s.textCol}>
            <View style={s.labelRow}>
              <View style={[s.dot, { backgroundColor: accent }]} />
              <AppText style={[s.label, { color: accent }]}>{tone === "info" ? "In review" : tone === "danger" ? "Action needed" : "Required"}</AppText>
            </View>
            <AppText style={s.title}>{title}</AppText>
            <AppText style={s.sub} numberOfLines={2}>{subtitle}</AppText>
          </View>
        </View>
        <Pressable onPress={onPress} disabled={disabled} style={[s.btn, disabled && s.btnDisabled]}>
          <AppText style={[s.btnText, { color: disabled ? COLORS.muted : COLORS.primary }]}>{buttonText}</AppText>
          {!disabled && <Ionicons name="arrow-forward" size={13} color={COLORS.primary} />}
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 10 },
  card: { borderRadius: 18, padding: 7, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  left: { flex: 1, flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 30, height: 30, borderRadius: 14, backgroundColor: "transparent", justifyContent: "center", alignItems: "center", marginRight: 12,},
  textCol: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.text, fontWeight: "500", marginTop: 2 },
  btn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "transparent", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 12, fontWeight: "700" },
});
