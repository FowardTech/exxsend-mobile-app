import React, { useState } from "react";
import { View, Pressable, StyleSheet, Alert } from "react-native";
import AppText from "./AppText";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { COLORS } from "../theme/colors";

interface Props {
  k: string;
  v: string;
  copyable?: boolean;
}

export default function DetailRow({ k, v, copyable = true }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(v);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={s.row}>
      <AppText style={s.key}>{k}</AppText>
      <View style={s.right}>
        <AppText style={s.val} selectable>{v}</AppText>
        {copyable && v && v !== "—" && (
          <Pressable onPress={handleCopy} style={s.copyBtn} hitSlop={8}>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={14}
              color={copied ? COLORS.green : COLORS.primary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  key: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "500",
    flex: 0.4,
    marginRight: 12,
  },
  right: {
    flex: 0.6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  val: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "right",
    flex: 1,
  },
  copyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
});
