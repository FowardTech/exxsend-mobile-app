/**
 * Shared screen header — used by several authenticated screens.
 * Gives consistent back button, title size, and SafeAreaView top padding.
 */
import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import AppText from "./AppText";
import BackButton from "./BackButton";
import { COLORS } from "../theme/colors";

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export default function ScreenHeader({ title, onBack, right }: Props) {
  return (
    <View style={s.header}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      {onBack ? (
        <BackButton onPress={onBack} showLabel={false} />
      ) : (
        <View style={s.placeholder} />
      )}
      <AppText style={s.title} numberOfLines={1}>{title}</AppText>
      {right ? right : <View style={s.placeholder} />}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 50,
    backgroundColor: COLORS.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  placeholder: { width: 34 },
  title: {
    flex: 1, textAlign: "center",
    fontSize: 17, fontWeight: "700",
    color: COLORS.text,
    marginHorizontal: 8,
  },
});
