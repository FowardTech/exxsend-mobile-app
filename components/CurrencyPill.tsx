/**
 * CurrencyPill - Pressable currency selector pill
 * Shows flag and currency code with dropdown indicator
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "./AppText";
import CountryFlag from "./CountryFlag";

interface CurrencyPillProps {
  countryCode: string;
  flag: string;
  code: string;
  onPress: () => void;
}

export default function CurrencyPill({ flag, code, countryCode, onPress }: CurrencyPillProps) {
  return (
    <Pressable style={styles.pill} onPress={onPress}>
      <CountryFlag 
        countryCode={countryCode} 
        currencyCode={code} 
        fallbackEmoji={flag} 
        size="sm" 
      />
      <AppText style={styles.code}>{code}</AppText>
      <AppText style={styles.arrow}>▼</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  flag: {
    fontSize: 18,
  },
  code: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  arrow: {
    fontSize: 10,
    color: "#9CA3AF",
    marginLeft: 2,
  },
});
