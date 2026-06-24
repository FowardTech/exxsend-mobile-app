import React from "react";
import { View } from "react-native";
import AppText from "../../AppText";
import ScreenShell from "./../../ScreenShell";
import { useStyles } from "../../../theme/styles";

interface Props {
  title: string;
}

export default function PlaceholderScreen({ title }: Props) {
  const styles = useStyles();
  return (
    <ScreenShell>
      <AppText style={styles.bigTitle}>{title}</AppText>
      <AppText style={styles.muted}>Placeholder screen</AppText>
    </ScreenShell>
  );
}
