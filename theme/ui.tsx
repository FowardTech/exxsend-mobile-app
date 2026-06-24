/**
 * Shared UI primitives used across all screens.
 * Import these instead of writing inline styles.
 */
import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./colors";

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[ui.card, style]}>{children}</View>;
}

// ── Section Header ────────────────────────────────────────────
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={ui.sectionHeader}>
      <Text style={ui.sectionTitle}>{title}</Text>
      {!!action && (
        <Pressable onPress={onAction}>
          <Text style={ui.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Screen Header ─────────────────────────────────────────────
export function ScreenHeader({ title, onBack, rightEl }: { title: string; onBack?: () => void; rightEl?: React.ReactNode }) {
  return (
    <View style={ui.screenHeader}>
      {onBack ? (
        <Pressable onPress={onBack} style={ui.backBtn}>
          <Ionicons name="arrow-back" size={18} color={COLORS.text} />
        </Pressable>
      ) : <View style={{ width: 36 }} />}
      <Text style={ui.screenHeaderTitle}>{title}</Text>
      {rightEl ? rightEl : <View style={{ width: 36 }} />}
    </View>
  );
}

// ── Primary Button ────────────────────────────────────────────
export function PrimaryBtn({ label, onPress, loading, disabled, style }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [ui.primaryBtn, inactive && ui.primaryBtnDisabled, pressed && !inactive && { opacity: 0.85 }, style]}
    >
      {loading
        ? <ActivityIndicator color={COLORS.actionText} size="small" />
        : <Text style={ui.primaryBtnText}>{label}</Text>
      }
    </Pressable>
  );
}

// ── Tag / Badge ───────────────────────────────────────────────
export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[ui.badge, { backgroundColor: bg }]}>
      <Text style={[ui.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ indent }: { indent?: number }) {
  return <View style={[ui.divider, indent ? { marginLeft: indent } : {}]} />;
}

// ── Styles ───────────────────────────────────────────────────

const ui = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  sectionAction: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 52,
  },
  screenHeaderTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, flex: 1, textAlign: "center" },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.border,
    justifyContent: "center", alignItems: "center",
  },
  primaryBtn: {
    height: 50, borderRadius: 16,
    backgroundColor: COLORS.actionBg,
    alignItems: "center", justifyContent: "center",
  },
  primaryBtnDisabled: { backgroundColor: COLORS.border },
  primaryBtnText: { color: COLORS.actionText, fontSize: 14, fontWeight: "700", letterSpacing: 0.1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.borderLight },
});

export { ui };
