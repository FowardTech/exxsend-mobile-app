import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View, Pressable } from "react-native";
import AppText from "../../AppText";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS } from "../../../theme/colors";
import { styles } from "../../../theme/styles";

function Header() {
  return (
    <View style={styles.flowHeader}>
      <Pressable style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={18} color={COLORS.text} />
      </Pressable>

      <AppText style={styles.flowHeaderTitle}>Review details</AppText>

      <Pressable style={styles.iconBtn}>
        <AppText style={styles.iconBtnText}>?</AppText>
      </Pressable>
    </View>
  );
}

export default function ReviewDetailsScreen() {
  const router = useRouter();
  const { name, bank, account } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Header />

      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <View style={styles.reviewTopIcons}>
          <View style={styles.reviewFlagCircle}>
            <AppText>🇳🇬</AppText>
          </View>
          <AppText style={{ fontWeight: "700", marginHorizontal: 10 }}>→</AppText>
          <View style={styles.reviewAvatarSmall}>
            <AppText style={{ color: "#fff", fontWeight: "700" }}>AB</AppText>
          </View>
        </View>

        <AppText style={styles.reviewSmall}>You're sending</AppText>
        <AppText style={styles.reviewBig}>1,000.00 NGN</AppText>
        <AppText style={styles.reviewTo}>
          to <AppText style={{ fontWeight: "700" }}>{name || "Ayotunde Kehinde Balogun"}</AppText>
        </AppText>

        <View style={styles.hr} />

        <AppText style={styles.reviewSection}>Paying with</AppText>
        <View style={styles.payWithCard}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AppText style={styles.flag}>🇳🇬</AppText>
            <View style={{ marginLeft: 10 }}>
              <AppText style={{ fontWeight: "700" }}>NGN balance</AppText>
              <AppText style={styles.muted}>11,795.00 NGN available</AppText>
            </View>
          </View>

          <View style={styles.changeBtn}>
            <AppText style={{ color: "#fff", fontWeight: "700" }}>Change</AppText>
          </View>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <AppText style={styles.reviewKey}>Bank name</AppText>
            <AppText style={styles.reviewVal}>{bank || "Access Bank Nigeria"}</AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText style={styles.reviewKey}>Account number</AppText>
            <AppText style={styles.reviewVal}>{account || "0761010148"}</AppText>
          </View>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <AppText style={styles.reviewKey}>Saved with points</AppText>
            <AppText style={styles.reviewVal}>0.00 pts</AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText style={styles.reviewKey}>You'll pay</AppText>
            <AppText style={styles.reviewVal}>1,000.00 NGN</AppText>
          </View>

          <View style={styles.reviewDivider} />

          <View style={styles.reviewRow}>
            <AppText style={styles.reviewKey}>Transfer fees</AppText>
            <AppText style={styles.reviewVal}>0.00 NGN</AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText style={styles.reviewKey}>We'll convert</AppText>
            <AppText style={styles.reviewVal}>1,000.00 NGN</AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText style={styles.reviewKey}>Exchange rate</AppText>
            <AppText style={styles.reviewVal}>1 NGN = 1 NGN</AppText>
          </View>
          <View style={styles.reviewRow}>
            <AppText style={styles.reviewKey}>Recipient gets</AppText>
            <AppText style={styles.reviewVal}>1,000.00 NGN</AppText>
          </View>
        </View>

        <View style={styles.deliveryPill}>
          <AppText style={{ color: "#2A2A2A", fontWeight: "700" }}>
            ⚡ Typically delivered within 1 minute
          </AppText>
        </View>

        <Pressable style={[styles.primaryBtn, { marginTop: 12 }]} onPress={() => router.push("/fraudaware")}>
          <AppText style={styles.primaryBtnText}>Continue</AppText>
        </Pressable>
      </View>
    </View>
  );
}
