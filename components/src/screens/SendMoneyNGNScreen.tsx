import React, { useState } from "react";
import { View } from "react-native";
import { styles } from "../../../theme/styles";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import CurrencyPill from "./../../CurrencyPill";
import PrimaryButton from "./../../PrimaryButton";
import ScreenShell from "./../../ScreenShell";
// import { useRouter } from "@/.expo/types/router";
import { useRouter } from "expo-router";


export default function SendMoneyNGNScreen() {
  const [amount, setAmount] = useState("1,000");
  const router = useRouter();
  return (
    <ScreenShell>
      <View style={styles.sendCard}>
        <AppText style={styles.fieldLabel}>You send</AppText>
        <View style={styles.amountRow}>
          <AppTextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" style={styles.amountInput} />
          <CurrencyPill flag="🇳🇬" code="NGN" onPress={() => { }} />
        </View>

        <View style={styles.ratePill}>
          <AppText style={{ color: "#1E7E52", fontWeight: "600" }}>📈 1 NGN = 1 NGN</AppText>
        </View>

        <AppText style={[styles.fieldLabel, { marginTop: 16 }]}>Recipient gets</AppText>
        <View style={styles.amountRow}>
          <AppTextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" style={styles.amountInput} />
          <CurrencyPill flag="🇳🇬" code="NGN" onPress={() => { }} />
        </View>

        <View style={styles.payWithCard}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AppText style={styles.flag}>🇳🇬</AppText>
            <View style={{ marginLeft: 10 }}>
              <AppText style={{ fontWeight: "600" }}>NGN balance</AppText>
              <AppText style={styles.muted}>11,795.00 NGN available</AppText>
            </View>
          </View>

          <View style={styles.changeBtn}>
            <AppText style={{ color: "#fff", fontWeight: "600" }}>Change</AppText>
          </View>
        </View>

        <View style={styles.feesRow}>
          <AppText style={styles.muted}>Transfer fees</AppText>
          <AppText style={styles.muted}>0.00 NGN</AppText>
        </View>
        <View style={styles.feesRow}>
          <AppText style={styles.muted}>We'll convert</AppText>
          <AppText style={styles.muted}>1,000.00 NGN</AppText>
        </View>
      </View>

      <PrimaryButton title="Continue" onPress={() => router.push("/recipients")} />
    </ScreenShell>
  );
}
