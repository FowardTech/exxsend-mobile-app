import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "./AppText";
import { useAppTheme } from "../theme/ThemeProvider";

interface BackButtonProps {
  onPress: () => void;
  label?: string;
  /** Pass false for screens where space is tight and only the chevron should show. */
  showLabel?: boolean;
  /** Override the tint color — needed when this sits on a colored hero/gradient header instead of the plain page background, where the default brand-color tint would be invisible. */
  color?: string;
  /** Disable the button — e.g. while an in-flight request shouldn't be interrupted by navigating away. */
  disabled?: boolean;
}

/**
 * iOS-style back navigation control: a chevron directly followed by a text
 * label, tinted in the brand color, with no circular/boxed background at
 * all — this is the actual native iOS UINavigationBar back button
 * convention, distinct from the circular icon-button pattern used
 * throughout the rest of this app (which reads as more Android/Material).
 *
 * iOS's real back button shows the *previous* screen's title as the label
 * (e.g. "‹ Home"). Since that requires per-screen navigation context this
 * component doesn't have, it defaults to the generic "Back" label — iOS's
 * own fallback behavior when a specific previous title isn't available.
 * Pass `label` explicitly on screens where the previous screen's title is
 * known, for the more authentic effect.
 */
export default function BackButton({ onPress, label = "Back", showLabel = true, color, disabled }: BackButtonProps) {
  const { colors } = useAppTheme();
  const tint = color || colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingRight: 8, opacity: disabled ? 0.5 : 1 }}
    >
      <Ionicons name="chevron-back" size={26} color={tint} style={{ marginRight: showLabel ? 2 : 0 }} />
      {showLabel && (
        <AppText style={{ fontSize: 17, color: tint, fontWeight: "400" }} numberOfLines={1}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}
