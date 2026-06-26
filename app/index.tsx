import { useEffect } from "react";
import { View, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../theme/colors";

/**
 * Signup stage keys saved at each step:
 *   signup_stage = "phone_submitted"  after OTP sent       → go to /verifynumber
 *   signup_stage = "phone_verified"   after OTP verified  → go to /pin
 *   signup_stage = "pin_set"          after PIN confirmed → go to /basicinfo
 *   signup_stage = "basic_info_saved" after basicinfo    → go to /protectpassword
 *   signup_stage = "password_set"     after password set → go to /(tabs)
 *
 * email_verified / homeaddress are NOT part of this chain — those are
 * post-login profile-completion prompts surfaced from within the
 * authenticated app (see HomeScreen's "Verify your email" card), not steps
 * a not-yet-logged-in user could be mid-way through here.
 */
async function resolveStartRoute(): Promise<string> {
  const [
    token,
    stage,
    phone,
    hasSeenOnboarding,
  ] = await Promise.all([
    AsyncStorage.getItem("auth_token"),
    AsyncStorage.getItem("signup_stage"),
    AsyncStorage.getItem("user_phone"),
    AsyncStorage.getItem("hasSeenOnboarding"),
  ]);

  // ── Fully authenticated ──────────────────────────────────────
  if (token) return "/(tabs)";

  // ── Mid-signup: resume from where they left off ──────────────
  if (phone && stage) {
    switch (stage) {
      // No requestId param here — whatever OTP was sent before has very
      // likely expired by now, so VerifyNumberScreen auto-resends a fresh
      // one on mount when it notices it wasn't handed a requestId, rather
      // than showing an input for a code that can no longer be valid.
      case "phone_submitted":   return `/verifynumber?phone=${encodeURIComponent(phone)}`;
      case "phone_verified":   return "/pin";
      case "pin_set":          return "/basicinfo";
      case "basic_info_saved": return "/protectpassword";
      // password_set means account created but no token yet (shouldn't happen, but handle it)
      case "password_set":     return "/login";
    }
  }

  // ── Partially started: has phone but no stage yet ────────────
  // Phone saved but OTP never even sent — restart from getstarted
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
      <View style={{
        borderRadius: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 10,
        marginBottom: 24,
      }}>
        <Image
          source={require("../assets/images/icons/icon.png")}
          style={{
            width: 96, height: 96, borderRadius: 15,
          }}
          resizeMode="contain"
        />
      </View>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
