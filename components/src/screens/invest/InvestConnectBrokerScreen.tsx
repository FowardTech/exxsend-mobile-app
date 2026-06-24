import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Pressable, StyleSheet, Alert } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppText from "@/components/AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS } from "@/theme/designSystem";
import { syncSnapTrade } from "@/api/investments";

export default function InvestConnectBrokerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ webViewUrl?: string; mode?: string }>();
  const [phone, setPhone] = useState("");
  const [syncing, setSyncing] = useState(false);
  const completedRef = useRef(false);

  const isCheckoutMode = params.mode === "checkout";

  useEffect(() => {
    AsyncStorage.getItem("user_phone").then((p) => setPhone(p || ""));
  }, []);

  const finishWithSync = async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setSyncing(true);
    try {
      const res = await syncSnapTrade(phone);
      setSyncing(false);
      if (res.success) {
        router.replace("/investoverview" as any);
      } else if (res.subscriptionRequired) {
        Alert.alert("Subscription required", "Please complete your Invest subscription first.");
        router.replace("/investpaywall" as any);
      } else {
        Alert.alert("Sync failed", res.message || "Could not sync your brokerage accounts. You can retry from the Invest tab.");
        router.replace("/investoverview" as any);
      }
    } catch {
      setSyncing(false);
      router.replace("/investoverview" as any);
    }
  };

  // Our own redirect URL, passed as redirectUrl to getSnapTradePortalUrl —
  // this is what SnapTrade's "Done" button actually navigates to once the
  // user finishes connecting a brokerage.
  //
  // IMPORTANT: this same string also appears as a query parameter *inside*
  // SnapTrade's initial portal URL itself (SnapTrade needs to know where to
  // send the user once they're done), so a plain url.includes(...) check
  // matched on the very first page load — before the user ever saw the
  // actual connection UI — which is exactly the "immediately shows syncing,
  // then bounces back" bug. Parsing the URL and checking the *current*
  // hostname/path only matches once the WebView has actually navigated
  // away to our domain, not just referenced it in passing.
  const isOurRedirect = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === "exxsend.com" && parsed.pathname.startsWith("/snaptrade/connected");
    } catch {
      return false;
    }
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    const { url } = navState;

    if (isCheckoutMode) {
      if (url.includes("success") || url.includes("checkout-complete")) {
        finishWithSync();
      } else if (url.includes("cancel") && !completedRef.current) {
        completedRef.current = true;
        router.back();
      }
      return;
    }

    if (isOurRedirect(url)) {
      finishWithSync();
    } else if ((url.includes("close") || url.includes("error") || url.includes("cancel")) && !completedRef.current) {
      completedRef.current = true;
      router.back();
    }
  };

  // Backstop for the same check: react-native-webview's onNavigationStateChange
  // doesn't fire consistently for every navigation attempt on every platform
  // (this is a known WebView quirk, more common on iOS), whereas
  // onShouldStartLoadWithRequest fires for every attempted navigation before
  // it happens. Returning true lets the WebView continue loading normally —
  // we're not blocking anything here, just getting an extra, earlier chance
  // to catch the redirect in case the other listener misses it.
  const handleShouldStartLoad = (request: { url: string }) => {
    if (!isCheckoutMode && !completedRef.current && isOurRedirect(request.url)) {
      finishWithSync();
    }
    return true;
  };

  if (!params.webViewUrl) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centered}>
          <AppText style={s.errorText}>No broker connection link was provided.</AppText>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <AppText style={s.backBtnText}>Go back</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (syncing) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <AppText style={s.syncingText}>Syncing your accounts…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <AppText style={s.topTitle}>{isCheckoutMode ? "Checkout" : "Connect Broker"}</AppText>
        <View style={{ width: 36 }} />
      </View>
      <WebView
        source={{ uri: params.webViewUrl }}
        onNavigationStateChange={handleNavigationChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        startInLoadingState
        renderLoading={() => (
          <View style={s.webviewLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.lg, height: 54 },
  iconBtn: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.bgTertiary, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.xxxl },
  errorText: { fontSize: 14, color: COLORS.muted, textAlign: "center", marginBottom: SPACE.lg },
  syncingText: { fontSize: 14, color: COLORS.muted, fontWeight: "600", marginTop: SPACE.lg },
  backBtn: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xxl },
  backBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  webviewLoading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
});
