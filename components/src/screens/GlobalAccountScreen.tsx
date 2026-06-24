import React, { useState } from "react";
import { View, Pressable, ScrollView, Alert } from "react-native";
import AppText from "../../AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStyles } from "../../../theme/styles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { completeOnboarding } from "../../../api/config";

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  {
    icon: "earth-outline",
    title: "Collect Payments Globally",
    sub: "Receive salaries or payments in USD, CAD, GBP, or EUR—fast and hassle-free",
  },
  {
    icon: "swap-horizontal-outline",
    title: "Swap Currencies Instantly",
    sub: "Convert between foreign and local currencies with great rates.",
  },
  {
    icon: "wallet-outline",
    title: "Hold & Manage Multiple Currencies:",
    sub: "Keep your money in USD, CAD, GBP, or EUR and spend when you're ready.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Safe & Effortless:",
    sub: "Bank-level security with a smooth, easy-to-use experience.",
  },
];

export default function GlobalAccountScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) {
        Alert.alert("Error", "Phone number not found");
        return;
      }
      const result = await completeOnboarding(phone);
      if (result.success) {
        // Save auth token for future API calls
        if (result.token) {
          await AsyncStorage.setItem("auth_token", result.token);
        }
        // Navigate to home screen
        router.replace("/");
      } else {
        Alert.alert("Error", result.message || "Failed to complete onboarding");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} bounces={false}>
        {/* Top hero image */}
        <View style={styles.globalHeroWrap}>
          {/* <Image
            source={require("../../../assets/images/global-account-hero.png")}
            style={styles.globalHero}
            resizeMode="cover"
          /> */}
        </View>

        {/* Content area */}
        <View style={styles.globalCard}>
          <AppText style={styles.globalTitle}>Get Paid from Anywhere!</AppText>

          {FEATURES.map((f) => (
            <View key={f.title} style={styles.globalRow}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: colors.primaryLight,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name={f.icon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.globalRowTitle}>{f.title}</AppText>
                <AppText style={styles.globalRowSub}>{f.sub}</AppText>
              </View>
            </View>
          ))}

          <Pressable
            style={[styles.primaryBtn, { marginTop: 18, opacity: loading ? 0.6 : 1 }]}
            onPress={handleVerify}
            disabled={loading}
          >
            <AppText style={styles.primaryBtnText}>
              {loading ? "Completing..." : "Verify your account"}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
