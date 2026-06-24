import React from "react";
import { View } from "react-native";
import AppText from "./AppText";
import { styles } from "../theme/styles";

interface Props {
  title: string;
  active: boolean;
}

export default function Pill({ title, active }: Props) {
  return (
    <View style={[styles.filterPill, active && styles.filterPillActive]}>
      <AppText style={[styles.filterText, active && styles.filterTextActive]}>{title}</AppText>
    </View>
  );
}
