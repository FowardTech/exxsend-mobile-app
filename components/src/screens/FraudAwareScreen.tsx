import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../../AppText";
import { useRouter } from "expo-router";
import { COLORS } from "../../../theme/colors";
import { styles } from "../../../theme/styles";

export default function FraudAwareScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.flowHeader}>
        <Pressable style={styles.iconBtn}>
          <AppText style={styles.iconBtnText}>←</AppText>
        </Pressable>

        <AppText style={styles.flowHeaderTitle}>Stay fraud aware</AppText>

        <View style={{ width: 38 }} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <View style={styles.warnTriangle}>
          <Ionicons name="warning" size={22} color={COLORS.error} />
        </View>

        <AppText style={styles.warnTitle}>Could someone be trying{"\n"}to scam you?</AppText>

        <View style={styles.warnCard}>
          <AppText style={styles.warnStop}>Stop if:</AppText>

          {[
            "You're told your account is at risk and asked to send money quickly.",
            "The recipient has offered you a deal which sounds too good to be true",
            "You haven't confirmed who you're sending money to. If you met them online or were given new account details, call to verify. Fraudsters often pose as loved ones.",
            "You found an investment online and haven't confirmed who's behind it. Investment scams are on the rise.",
          ].map((t, i) => (
            <View key={i} style={styles.warnRow}>
              <AppText style={styles.warnX}>✕</AppText>
              <AppText style={styles.warnText}>{t}</AppText>
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <AppText style={{ fontWeight: "700", color: COLORS.muted }}>
            ⓘ Only continue if you understand this and are sure you are acting of your own free will.
          </AppText>
        </View>

        <Pressable style={[styles.primaryBtn, { marginTop: 14 }]} onPress={() => router.push("/pin")}>
          <AppText style={styles.primaryBtnText}>Continue</AppText>
        </Pressable>

        <Pressable style={[styles.outlineBtn, { marginTop: 12 }]}>
          <AppText style={styles.outlineBtnText}>Cancel</AppText>
        </Pressable>
      </View>
    </View>
  );
}
