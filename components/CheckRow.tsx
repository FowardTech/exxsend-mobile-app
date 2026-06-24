import React, { useState } from "react";
import { View, Pressable } from "react-native";
import AppText from "./AppText";
import { styles } from "../theme/styles";

interface Props {
  text: string;
  links?: boolean;
}

export default function CheckRow({ text, links }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <View style={styles.checkRow}>
      <Pressable
        onPress={() => setChecked(!checked)}
        style={[
          styles.checkbox,
          checked && { backgroundColor: "#0EA5E9", borderColor: "#0EA5E9" },
        ]}
      />
      <AppText style={styles.checkText}>
        {links ? (
          <>
            By clicking this box, you agree to our{" "}
            <AppText style={styles.link}>Terms &{"\n"}Conditions of Service</AppText> and{" "}
            <AppText style={styles.link}>Privacy Notice</AppText> including verification of your identity
            through a third party and your mobile services provider.
          </>
        ) : (
          text
        )}
      </AppText>
    </View>
  );
}
