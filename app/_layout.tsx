import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AppState, AppStateStatus, View, Pressable } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as LocalAuthentication from "expo-local-authentication";
import * as SplashScreen from "expo-splash-screen";
import { COLORS } from "../theme/colors";

// Keep the native splash screen (the Exxsend logo configured in app.json)
// visible until the app is actually ready to render real content — by
// default it auto-hides on the very first JS frame, which is often before
// fonts/auth/lock-state are ready, and RootLayoutContent below intentionally
// renders null until then. Without this call, that gap between "splash
// auto-hid" and "first real frame" is exactly the blank white screen users
// were seeing. Must run at module scope, before anything else, since the
// native side checks for this call immediately on launch.
SplashScreen.preventAutoHideAsync().catch(() => {});
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NotificationProvider } from "../context/NotificationContext";
import { ThemeProvider, useAppTheme } from "../theme/ThemeProvider";
import usePushNotifications from "@/hooks/usePushNotification";
import { registerPushTokenWithBackend } from "@/services/pushNotifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AppLockScreen from "../components/AppLockScreen";
import { CustomAlertProvider } from "../components/CustomAlert";
import AppText from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useOtherStyles } from "../theme/otherstyles";

// ─────────────────────────────────────────────────────────────────────────────
// Screens that are part of the SIGNUP flow — no auth token needed
// ─────────────────────────────────────────────────────────────────────────────
const SIGNUP_FLOW_SCREENS = new Set([
  "getstarted",
  "verifynumber",
  "verifyphonenumber",
  "pin",
  "verifypin",
  "basicinfo",
  "homeaddress",
  "checkemail",
  "protectpassword",
  "userdetails",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Screens that are public but NOT part of signup (e.g. onboarding, login)
// ─────────────────────────────────────────────────────────────────────────────
const PUBLIC_SCREENS = new Set([
  "login",
  "onboarding",
  "networkerrorstate",
  "reset-password",
  "resetpassword",
  "globalaccount",
  // /result is a generic success/error screen reused across both authenticated
  // flows (e.g. "PIN Changed") AND the tail end of signup (e.g. "Account
  // Created" right after password creation, before the user has logged in and
  // therefore before any auth_token exists). Without this, the auth gate would
  // force-redirect away from /result to /login before a just-signed-up user
  // ever got to see the success screen.
  "result",
  ...SIGNUP_FLOW_SCREENS,
]);

function GlobalOfflineOverlay() {
  const { colors } = useAppTheme();
  const otherstyles = useOtherStyles();
  return (
    <View
      style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        elevation: 999,
      }}
    >
      <View style={otherstyles.netErrWrap}>
        <View style={otherstyles.netErrIconCircle}>
          <Ionicons name="wifi-outline" size={22} color={colors.primary} />
        </View>
        <AppText style={otherstyles.netErrTitle}>No internet connection</AppText>
        <AppText style={otherstyles.netErrMessage}>
          We'll bring you right back once your connection is restored.
        </AppText>
      </View>
    </View>
  );
}

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const [authChecked, setAuthChecked] = useState(false);
  const isNavigatingRef = useRef(false);
  const pushTokenRegisteredRef = useRef(false);

  // ── Global no-network overlay ──────────────────────────────────────────
  // Watches connectivity directly via NetInfo rather than navigating to a
  // dedicated screen, so it can appear as an overlay above whatever screen
  // is currently showing (the lock screen included) without losing that
  // screen's state, and disappear automatically the instant the network
  // genuinely comes back — no manual dismissal needed.
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    const evaluate = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      const ok = Boolean(state.isConnected && state.isInternetReachable !== false);
      const reachable = ok || (Boolean(state.isConnected) && state.isInternetReachable == null);
      setIsOffline(!reachable);
    };
    NetInfo.fetch().then(evaluate);
    const unsub = NetInfo.addEventListener(evaluate);
    return () => unsub();
  }, []);

  // ── App lock (biometric re-entry) ──────────────────────────────────────
  // Locks on cold start and every time the app returns to the foreground
  // (e.g. switching apps and back), as long as biometric is enabled and a
  // session token exists. This intentionally lives here, gating the whole
  // app at the layout level — putting it inside LoginScreen alone doesn't
  // work, because once a valid token exists the auth-check below routes
  // straight into (tabs) and LoginScreen is never rendered at all.
  const [locked, setLocked] = useState(false);
  const [lockCheckDone, setLockCheckDone] = useState(false);
  const appState = useRef(AppState.currentState);

  const maybeLock = async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const bioEnabledSetting = await AsyncStorage.getItem("biometric_enabled");
      if (token && bioEnabledSetting === "true") {
        setLocked(true);
      }
    } catch {}
    finally { setLockCheckDone(true); }
  };

  useEffect(() => {
    // Initial check on cold start
    maybeLock();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      // Any transition into the foreground re-triggers the lock check —
      // covers both "was backgrounded" and "was inactive" (e.g. the iOS
      // app-switcher card view or an incoming call screen).
      if (next === "active" && prev !== "active") {
        maybeLock();
      }
    });

    return () => sub.remove();
  }, []);

  usePushNotifications();

  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });

  useEffect(() => {
    if (!fontsLoaded) return;

    const checkAuth = async () => {
      // Prevent multiple concurrent navigations
      if (isNavigatingRef.current) return;

      try {
        const token = await AsyncStorage.getItem("auth_token");
        const leaf = String(segments?.[segments.length - 1] ?? "");

        // The push token is fetched once at app cold-start (see
        // usePushNotifications), but at that moment the user is very often
        // not logged in yet, so it never reaches the backend. Re-attempt
        // here, the first time we confirm a real auth token exists in this
        // session — checkAuth re-runs on every navigation, so this reliably
        // fires right after login completes, not just at cold start.
        if (token && !pushTokenRegisteredRef.current) {
          pushTokenRegisteredRef.current = true;
          AsyncStorage.getItem("user_phone").then((phone) => {
            if (phone) registerPushTokenWithBackend(phone);
          });
        }

        // Already in a public/signup screen — never redirect
        if (PUBLIC_SCREENS.has(leaf)) {
          setAuthChecked(true);
          return;
        }

        // In a tab group — fine if token exists
        if (leaf === "(tabs)" || (Array.isArray(segments) && (segments as unknown as string[]).includes("(tabs)"))) {
          if (!token) {
            isNavigatingRef.current = true;
            router.replace("/login");
            setTimeout(() => { isNavigatingRef.current = false; }, 500);
          } else {
            setAuthChecked(true);
          }
          return;
        }

        // Private screen without token
        if (!token) {
          isNavigatingRef.current = true;
          router.replace("/login");
          setTimeout(() => { isNavigatingRef.current = false; }, 500);
          return;
        }

        setAuthChecked(true);
      } catch {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, [fontsLoaded, segments]);

  // The instant all three conditions below flip true is exactly the instant
  // this component starts rendering real content instead of null — hide
  // the splash right then, so it bridges that gap seamlessly instead of
  // hiding early and leaving a blank frame in between.
  useEffect(() => {
    if (fontsLoaded && authChecked && lockCheckDone) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, authChecked, lockCheckDone]);

  if (!fontsLoaded || !authChecked || !lockCheckDone) return null;

  return (
    <View style={{ flex: 1 }}>
    <Stack
      initialRouteName="onboarding"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: COLORS.bg },
        contentStyle: { backgroundColor: COLORS.bg },
        headerTitleStyle: { fontWeight: "700" },
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      {/* ── Onboarding & Auth ── */}
      <Stack.Screen name="onboarding"        options={{ headerShown: false, animation: "none" }} />
      <Stack.Screen name="getstarted"        options={{ headerShown: false }} />
      <Stack.Screen name="login"             options={{ headerShown: false }} />
      <Stack.Screen name="reset-password"    options={{ headerShown: false }} />
      <Stack.Screen name="networkerrorstate" options={{ headerShown: false }} />

      {/* ── Signup flow ── */}
      <Stack.Screen name="verifynumber"      options={{ headerShown: false }} />
      <Stack.Screen name="pin"               options={{ headerShown: false }} />
      <Stack.Screen name="verifypin"         options={{ headerShown: false }} />
      <Stack.Screen name="basicinfo"         options={{ headerShown: false }} />
      <Stack.Screen name="homeaddress"       options={{ headerShown: false }} />
      <Stack.Screen name="checkemail"        options={{ headerShown: false }} />
      <Stack.Screen name="protectpassword"   options={{ headerShown: false }} />

      {/* ── Main app ── */}
      <Stack.Screen name="(tabs)"            options={{ headerShown: false, animation: "none" }} />

      {/* ── Authenticated screens ── */}
      <Stack.Screen name="profile"           options={{ headerShown: false }} />
      <Stack.Screen name="setusername"       options={{ headerShown: false }} />
      <Stack.Screen name="accountInfo"       options={{ headerShown: false }} />
      <Stack.Screen name="userdetails"       options={{ headerShown: false }} />
      <Stack.Screen name="accountlimit"      options={{ headerShown: false }} />
      <Stack.Screen name="securityprivacy"   options={{ headerShown: false }} />
      <Stack.Screen name="changepin"         options={{ headerShown: false }} />
      <Stack.Screen name="forgotpin"         options={{ headerShown: false }} />
      <Stack.Screen name="privacysettings"   options={{ headerShown: false }} />
      <Stack.Screen name="support"           options={{ headerShown: false }} />
      <Stack.Screen name="chatsupport"       options={{ headerShown: false }} />
      <Stack.Screen name="notificationpref"  options={{ headerShown: false }} />
      <Stack.Screen name="globalaccount"     options={{ headerShown: false }} />
      <Stack.Screen name="sumsub-verification" options={{ headerShown: false }} />
      <Stack.Screen name="requestmoney"       options={{ headerShown: false }} />
      <Stack.Screen name="moneyrequests"      options={{ headerShown: false }} />
      <Stack.Screen name="cryptotrade"        options={{ headerShown: false }} />
      <Stack.Screen name="optionstrade"       options={{ headerShown: false }} />
      <Stack.Screen name="orderdetail"        options={{ headerShown: false }} />
      <Stack.Screen name="referralleaderboard" options={{ headerShown: false }} />
      <Stack.Screen name="addaccount"        options={{ headerShown: false }} />
      <Stack.Screen name="bank-details"      options={{ headerShown: false }} />
      <Stack.Screen name="wallet"            options={{ headerShown: false }} />
      <Stack.Screen name="ngnwallet"         options={{ headerShown: false }} />
      <Stack.Screen name="sendmoney"         options={{ headerShown: false }} />
      <Stack.Screen name="sendmoneyngn"      options={{ headerShown: false }} />
      <Stack.Screen name="recipients"        options={{ headerShown: false }} />
      <Stack.Screen name="recipientselect"   options={{ headerShown: false }} />
      <Stack.Screen name="recipientnew"      options={{ headerShown: false }} />
      <Stack.Screen name="recipientdetails"  options={{ headerShown: false }} />
      <Stack.Screen name="recipientconfirm"  options={{ headerShown: false }} />
      <Stack.Screen name="recipientactivity" options={{ headerShown: false }} />
      <Stack.Screen name="offerdetail"       options={{ headerShown: false }} />
      <Stack.Screen name="tradeticket"       options={{ headerShown: false }} />
      <Stack.Screen name="pendingorders"     options={{ headerShown: false }} />
      <Stack.Screen name="reviewdetails"     options={{ headerShown: false }} />
      <Stack.Screen name="fraudaware"        options={{ headerShown: false }} />
      <Stack.Screen name="transferconfirm"   options={{ headerShown: false }} />
      <Stack.Screen name="result"            options={{ headerShown: false }} />
      <Stack.Screen name="add-money/local" options={{ headerShown: false }} />
      <Stack.Screen name="addmoneymethods"   options={{ headerShown: false }} />
      <Stack.Screen name="addmoneycard"      options={{ headerShown: false }} />
      <Stack.Screen name="addmoneyeft"       options={{ headerShown: false }} />
      <Stack.Screen name="addmoneyinterac"   options={{ headerShown: false }} />
      <Stack.Screen name="convert"           options={{ headerShown: false }} />
      <Stack.Screen name="withdraw"          options={{ headerShown: false }} />
      <Stack.Screen name="withdrawmoney"     options={{ headerShown: false }} />
      <Stack.Screen name="exchangerates"     options={{ headerShown: false }} />
      <Stack.Screen name="scantopay"         options={{ headerShown: false }} />
      <Stack.Screen name="investpaywall"     options={{ headerShown: false }} />
      <Stack.Screen name="investconnectbroker" options={{ headerShown: false }} />
      <Stack.Screen name="investoverview"    options={{ headerShown: false }} />
      <Stack.Screen name="investholdings"    options={{ headerShown: false }} />
      <Stack.Screen name="investtransactions" options={{ headerShown: false }} />
      <Stack.Screen name="investsettings"    options={{ headerShown: false }} />
      <Stack.Screen name="investtaxreport"   options={{ headerShown: false }} />
      <Stack.Screen name="recipientsmanagement" options={{ headerShown: false }} />
      <Stack.Screen name="exxsendmembers" options={{ headerShown: false }} />
      <Stack.Screen name="ratealerts"        options={{ headerShown: false }} />
      <Stack.Screen name="transactiondetail/[reference]" options={{ headerShown: false }} />
      <Stack.Screen name="regiondropdown"    options={{ headerShown: false }} />
      <Stack.Screen name="help"              options={{ headerShown: false }} />
    </Stack>
    {isOffline && <GlobalOfflineOverlay />}
    {locked && (
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <AppLockScreen onUnlock={() => setLocked(false)} />
      </View>
    )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <CustomAlertProvider>
            <NotificationProvider>
              <RootLayoutContent />
            </NotificationProvider>
          </CustomAlertProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
