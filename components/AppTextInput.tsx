import React from "react";
import { TextInput as RNTextInput, TextInputProps } from "react-native";

/**
 * Drop-in replacement for React Native's <TextInput> that applies
 * Manrope as the default font. See AppText.tsx for the full rationale —
 * same reasoning applies here.
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

function findFontWeight(style: TextInputProps["style"]): unknown {
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

const AppTextInput = React.forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  const weight = findFontWeight(props.style);
  const family = familyForWeight(weight);
  return <RNTextInput ref={ref} {...props} style={[{ fontFamily: family }, props.style]} />;
});

export default AppTextInput;
