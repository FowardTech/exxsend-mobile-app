import React from "react";
import { Pressable, ActivityIndicator, StyleSheet, View } from "react-native";
import AppText from "./AppText";
import { COLORS } from "../theme/colors";

interface Props {
  title: string;
  onPress: () => void;
  style?: object;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "accent" | "danger";
}

export default function PrimaryButton({ title, onPress, style, disabled, loading, variant = "primary" }: Props) {
  const bg =
    disabled || loading
      ? "#C4BFD8"
      : variant === "accent"
      ? COLORS.accent
      : variant === "danger"
      ? COLORS.red
      : COLORS.primary;

  return (
    <Pressable
      onPress={!disabled && !loading ? onPress : undefined}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: pressed ? 0.88 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <AppText style={[s.text, variant === "accent" && { color: COLORS.accentDark }]}>{title}</AppText>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: "100%",
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
