import { useEffect } from "react";
import { View, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../theme/colors";

/**
 * Signup stage keys saved at each step:
 *   signup_stage = "phone_verified"   after OTP verified  → go to /pin
 *   signup_stage = "pin_set"          after PIN confirmed → go to /basicinfo
 *   signup_stage = "basic_info_saved" after basicinfo    → go to /protectpassword
 *   signup_stage = "password_set"     after password set → go to /(tabs)
 *   email_verified = "true"           after email OTP    → go to /homeaddress (if needed)
 *   auth_token present                fully signed in    → go to /(tabs)
 */
async function resolveStartRoute(): Promise<string> {
  const [
    token,
    stage,
    phone,
    hasSeenOnboarding,
    emailVerified,
  ] = await Promise.all([
    AsyncStorage.getItem("auth_token"),
    AsyncStorage.getItem("signup_stage"),
    AsyncStorage.getItem("user_phone"),
    AsyncStorage.getItem("hasSeenOnboarding"),
    AsyncStorage.getItem("email_verified"),
  ]);

  // ── Fully authenticated ──────────────────────────────────────
  if (token) return "/(tabs)";

  // ── Mid-signup: resume from where they left off ──────────────
  if (phone && stage) {
    switch (stage) {
      case "phone_verified":   return "/pin";
      case "pin_set":          return "/basicinfo";
      case "basic_info_saved": return "/protectpassword";
      // password_set means account created but no token yet (shouldn't happen, but handle it)
      case "password_set":     return "/login";
    }
  }

  // ── Partially started: has phone but no stage yet ────────────
  // Phone saved but OTP never completed — restart from getstarted
  if (phone && !stage) return "/getstarted";

  // ── First launch ─────────────────────────────────────────────
  if (hasSeenOnboarding === "true") return "/login";

  return "/onboarding";
}

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    resolveStartRoute().then((route) => {
      router.replace(route as any);
    }).catch(() => {
      router.replace("/onboarding");
    });
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
      <Image
        source={require("../assets/images/icons/icon.png")}
        style={{ width: 96, height: 96, marginBottom: 24 }}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
