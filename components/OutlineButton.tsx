import React from "react";
import { Pressable, StyleSheet } from "react-native";
import AppText from "./AppText";
import { COLORS } from "../theme/colors";

interface Props {
  title: string;
  onPress: () => void;
  style?: object;
  color?: string;
}

export default function OutlineButton({ title, onPress, style, color = COLORS.primary }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { borderColor: color, opacity: pressed ? 0.80 : 1 },
        style,
      ]}
    >
      <AppText style={[s.text, { color }]}>{title}</AppText>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: "100%",
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    marginTop: 12,
  },
  text: { fontWeight: "700", fontSize: 16 },
});
