import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import AppText from "./AppText";

interface NumericKeypadProps {
  value: string;
  onChangeValue: (next: string) => void;
  onDone?: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  /** Max number of digits after the decimal point. Defaults to 2. */
  maxDecimals?: number;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "del"],
];

/**
 * On-screen numeric keypad — a drop-in replacement for a text input's
 * value/onChangeText pair. Mimics exactly what a real keyboard's
 * onChangeText would produce on each press, so any screen using this only
 * needs to swap its <AppTextInput> for this component; every downstream
 * consumer of the amount string (quotes, fees, validation) keeps working
 * unchanged since they only ever cared about the string value, not how it
 * was produced.
 */
export default function NumericKeypad({
  value,
  onChangeValue,
  onDone,
  doneLabel = "Done",
  doneDisabled = false,
  maxDecimals = 2,
}: NumericKeypadProps) {
  const { colors } = useAppTheme();

  const press = (key: string) => {
    if (key === "del") {
      onChangeValue(value.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (value.includes(".")) return; // only one decimal point allowed
      onChangeValue(value + ".");
      return;
    }
    // digit
    const decimalIndex = value.indexOf(".");
    if (decimalIndex !== -1 && value.length - decimalIndex - 1 >= maxDecimals) {
      return; // already at max decimal precision
    }
    if (value === "0") {
      onChangeValue(key); // replace leading zero rather than "0" + "5" = "05"
      return;
    }
    onChangeValue(value + key);
  };

  return (
    <View style={s.wrap}>
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={s.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => press(key)}
              style={({ pressed }) => [
                s.key,
                pressed && { backgroundColor: colors.bgTertiary },
              ]}
            >
              {key === "del" ? (
                <Ionicons name="backspace-outline" size={22} color={colors.text} />
              ) : (
                <AppText style={[s.keyText, { color: colors.text }]}>{key}</AppText>
              )}
            </Pressable>
          ))}
        </View>
      ))}
      {onDone && (
        <Pressable
          onPress={onDone}
          disabled={doneDisabled}
          style={[s.doneBtn, { backgroundColor: colors.actionBg, opacity: doneDisabled ? 0.5 : 1 }]}
        >
          <AppText style={[s.doneText, { color: colors.actionText }]}>{doneLabel}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  key: {
    width: 72,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 24, fontWeight: "600" },
  doneBtn: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneText: { fontSize: 16, fontWeight: "600" },
});
