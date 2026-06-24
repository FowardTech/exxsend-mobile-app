import React from "react";
import { Pressable, View } from "react-native";
import AppText from "./AppText";
import { useStyles } from "../theme/styles";
import { useAppTheme } from "@/theme/ThemeProvider";

interface Props {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

export default function WalletAction({ icon, label, onPress }: Props) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  return (
    <Pressable style={{ alignItems: "center", width: 72 }} onPress={onPress}>
      <View style={styles.walletActionCircle}>
        <AppText style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{icon}</AppText>
      </View>
      <AppText style={{ marginTop: 8, fontWeight: "700", color: colors.text }}>{label}</AppText>
    </Pressable>
  );
}
