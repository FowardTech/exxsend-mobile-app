import React from "react";
import { Text as RNText, TextProps } from "react-native";

/**
 * Drop-in replacement for React Native's <Text> that applies Manrope as
 * the default font.
 *
 * Why this exists: React Native doesn't support global text style
 * inheritance (no CSS-like `body { font-family }`), and patching
 * Text.defaultProps or Text's internal render function is unreliable across
 * React Native versions — Text is a forwardRef component, and write access
 * to its internals doesn't reliably affect what JSX call sites actually
 * render. The React Native docs' own recommendation is a wrapper component
 * used in place of <Text> everywhere. This is that wrapper.
 *
 * Maps whatever fontWeight a screen already specifies (most of this app's
 * screens set fontWeight via inline/local styles rather than a shared
 * typography scale) to the matching Manrope static font file — Manrope
 * ships one font file per weight here, not a single variable font, so a flat
 * fontFamily override would silently force everything to one weight
 * regardless of the fontWeight already set.
 */

const WEIGHT_TO_FAMILY: Record<string, string> = {
  "100": "Manrope_400Regular",
  "200": "Manrope_400Regular",
  "300": "Manrope_400Regular",
  "400": "Manrope_400Regular",
  normal: "Manrope_400Regular",
  "500": "Manrope_500Medium",
  "600": "Manrope_600SemiBold",
  "700": "Manrope_700Bold",
  bold: "Manrope_700Bold",
  "800": "Manrope_800ExtraBold",
  "900": "Manrope_800ExtraBold",
};

function familyForWeight(weight: unknown): string {
  if (weight == null) return WEIGHT_TO_FAMILY["400"];
  const key = String(weight);
  return WEIGHT_TO_FAMILY[key] || WEIGHT_TO_FAMILY["400"];
}

/** Pulls the effective fontWeight out of a (possibly nested/array) RN style prop. */
function findFontWeight(style: TextProps["style"]): unknown {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i--) {
      const found = findFontWeight(style[i] as any);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof style === "object") return (style as any).fontWeight;
  return undefined;
}

export default function AppText(props: TextProps) {
  const weight = findFontWeight(props.style);
  const family = familyForWeight(weight);
  return <RNText {...props} style={[{ fontFamily: family }, props.style]} />;
}
