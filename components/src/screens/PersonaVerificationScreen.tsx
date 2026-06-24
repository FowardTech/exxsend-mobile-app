import React, { useState, useRef, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Platform, Linking } from "react-native";
import AppText from "../../AppText";
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPersonaInquiryStatus } from "@/api/config";
// Injected JS to listen for Persona hosted flow events
const PERSONA_BRIDGE_JS = `
  (function() {
    // Listen for Persona postMessage events
    window.addEventListener('message', function(event) {
      try {
        var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // Persona emits events like { type: 'persona', event: 'complete', ... }
        if (data && (data.type === 'persona' || data.source === 'persona')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'persona_event',
            event: data.event || data.name || data.type,
            status: data.status,
            inquiryId: data.inquiryId
          }));
        }
        
        // Alternative format: { name: 'inquiry-complete', ... }
        if (data && data.name && data.name.includes('complete')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'persona_event',
            event: 'complete',
            status: 'completed'
          }));
        }
      } catch(e) {}
    });
    
    // Also watch for URL hash changes (some flows use this)
    var lastHash = window.location.hash;
    setInterval(function() {
      if (window.location.hash !== lastHash) {
        lastHash = window.location.hash;
        if (lastHash.includes('complete') || lastHash.includes('success')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'persona_event',
            event: 'complete',
            status: 'completed'
          }));
        }
      }
    }, 500);
    
    true;
  })();
`;
export default function PersonaVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    url: string;
    inquiryId: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const rawVerificationUrl = params.url;
  // Conditionally include Android-only permission handler for camera in WebView
  // We cast to `any` to avoid TypeScript errors because `onPermissionRequest`
  // is not present on the WebView types in some versions of react-native-webview.
  const androidPermissionProp = Platform.OS === "android"
    ? ({ onPermissionRequest: (event: any) => {
        // Required on Android for getUserMedia() camera access to work
        // inside the WebView. Without this, some Android versions silently
        // deny camera access, which can degrade capture quality and
        // contribute to upload rejections from Persona.
        event.grant && event.grant(event.resources);
      } } as any)
    : ({} as any);
  // Per Persona's WebView Flow docs, the hosted flow URL must include
  // is-webview=true when loaded inside a WebView (rather than a real browser)
  // so Persona's frontend adjusts its camera-access handling accordingly.
  // Missing this is a documented cause of capture/upload failures during the
  // selfie/ID step (e.g. "Failed to upload... (Error 422)").
  const verificationUrl = useMemo(() => {
    if (!rawVerificationUrl) return rawVerificationUrl;
    try {
      const u = new URL(rawVerificationUrl);
      if (!u.searchParams.has("is-webview")) {
        u.searchParams.set("is-webview", "true");
      }
      return u.toString();
    } catch {
      // Not a parseable absolute URL — fall back to a simple string append.
      const sep = rawVerificationUrl.includes("?") ? "&" : "?";
      return rawVerificationUrl.includes("is-webview=")
        ? rawVerificationUrl
        : `${rawVerificationUrl}${sep}is-webview=true`;
    }
  }, [rawVerificationUrl]);
//   const inquiryId = "inq_vJ4TdTrgPYJxG5chpqsURsNrQaRt"; // Sample inquiry ID
  const inquiryId = params.inquiryId;
  const handleWebViewMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("[Persona] WebView message:", data);

      if (data.type === "persona_event") {
        if (
          data.event === "complete" ||
          data.event === "completed" ||
          data.status === "completed"
        ) {
          if (!completed) {
            setCompleted(true);
            await handleVerificationComplete();
          }
        } else if (
          data.event === "cancel" ||
          data.event === "cancelled" ||
          data.event === "fail" ||
          data.event === "failed"
        ) {
          Alert.alert(
            "Verification Cancelled",
            "You can try again later from the home screen.",
            [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
          );
        }
      }
    } catch (e) {
      // Not JSON, ignore
    }
  };
  // Persona redirects to https://personacallback/?... (a sentinel marker, not a
  // real domain) when no custom redirect-uri was configured server-side. The
  // WebView must NOT be allowed to actually navigate there — "personacallback"
  // doesn't resolve via DNS, which surfaces as a net::ERR_NAME_NOT_RESOLVED
  // WebView error. Parse the query string here and route based on `status`
  // instead of letting the WebView try to load it as a real page.
  const handlePersonaRedirect = async (url: string) => {
    let status = "";
    try {
      const qs = url.split("?")[1] || "";
      const queryParams = Object.fromEntries(
        qs.split("&").filter(Boolean).map((pair) => {
          const [k, v] = pair.split("=");
          return [decodeURIComponent(k || ""), decodeURIComponent(v || "")];
        })
      );
      status = (queryParams["status"] || "").toLowerCase();
    } catch (e) {
      console.log("[Persona] Could not parse personacallback query string:", e);
    }

    if (status === "completed" || status === "") {
      // Treat a missing status as success too — Persona's docs show the
      // success case always includes status=completed, but fail safe toward
      // "submitted for review" rather than leaving the user stuck if the
      // query string shape ever changes.
      if (!completed) {
        setCompleted(true);
        await handleVerificationComplete();
      }
    } else {
      // "failed" / "expired" / "canceled" / anything else Persona might send
      Alert.alert(
        "Verification Cancelled",
        "You can try again later from the home screen.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
      );
    }
  };

  // Detect when Persona verification is complete by monitoring URL changes
  const handleNavigationChange = async (navState: WebViewNavigation) => {
    const { url } = navState;

    // Belt-and-suspenders: onShouldStartLoadWithRequest should already have
    // intercepted this before the WebView attempted to navigate there, but
    // catch it here too in case some platform/version fires this first.
    if (url.includes("personacallback")) {
      await handlePersonaRedirect(url);
      return;
    }

    // Persona redirects to these patterns when verification is complete
    if (
      !completed &&
      (url.includes("/complete") ||
        url.includes("persona-complete") ||
        url.includes("status=completed") ||
        url.includes("inquiry-complete") ||
        url.includes("/done") ||
        url.includes("verification-complete"))
    ) {
      setCompleted(true);
      await handleVerificationComplete();
    }

    // Persona may also redirect on failure/cancel
    if (
      url.includes("/cancel") ||
      url.includes("status=failed") ||
      url.includes("status=expired")
    ) {
      Alert.alert(
        "Verification Cancelled",
        "You can try again later from the home screen.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
      );
    }
  };

  const handleVerificationComplete = async () => {
    try {
      // Poll the backend to get the latest inquiry status
      if (inquiryId) {
        const statusResult = await getPersonaInquiryStatus(inquiryId);
        console.log("[Persona] Inquiry status after completion:", statusResult);

        // Update local storage to reflect pending KYC (admin will approve)
        const userInfoStr = await AsyncStorage.getItem("user_info");
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          userInfo.kycStatus = "pending"; // Now waiting for admin approval
          await AsyncStorage.setItem("user_info", JSON.stringify(userInfo));
        }
      }

      Alert.alert(
        "Verification Submitted",
        "Your identity verification has been submitted for review. You'll be notified once approved.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("[Persona] Error checking completion status:", error);
      router.back();
      Alert.alert(
        "Verification Submitted",
        "Your verification has been submitted. You'll be notified of the result.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
      );
    }
  };

  // Escape hatch: open the same Persona link in the system browser instead of
  // the in-app WebView. Note this loses our in-app completion detection (no
  // onNavigationStateChange/postMessage bridge outside the WebView) — Persona
  // will redirect to whatever redirect_uri the backend configured when the
  // inquiry was created, or "personacallback" if none was set, rather than
  // back into this screen. Offered as a fallback for devices where the
  // in-app capture keeps failing, not as the primary flow.
  const handleOpenInBrowser = () => {
    if (!rawVerificationUrl) return;
    Alert.alert(
      "Open in browser?",
      "This opens identity verification in your phone's browser instead of this app. Come back here once you're done.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Browser",
          onPress: () => {
            Linking.openURL(rawVerificationUrl).catch(() => {
              Alert.alert("Error", "Could not open the browser. Please try again.");
            });
          },
        },
      ]
    );
  };

  const handleClose = () => {
    Alert.alert(
      "Cancel Verification?",
      "Are you sure you want to cancel? You can resume verification later.",
      [
        { text: "Continue Verification", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => router.replace("/(tabs)"),
        },
      ]
    );
  };

  if (!verificationUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
          <AppText style={styles.errorText}>Verification URL not available</AppText>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(tabs)")}>
            <AppText style={styles.backButtonText}>Go Back</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Identity Verification</AppText>
        <View style={{ width: 40 }} />
      </View>

      {!loading && (
        <TouchableOpacity onPress={handleOpenInBrowser} style={styles.browserFallbackRow}>
          <Ionicons name="open-outline" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
          <AppText style={styles.browserFallbackText}>Trouble with the camera? Open in browser instead</AppText>
        </TouchableOpacity>
      )}

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <AppText style={styles.loadingText}>Loading verification...</AppText>
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: verificationUrl }}
        javaScriptEnabled={true}
        injectedJavaScript={PERSONA_BRIDGE_JS}
        // Enable camera access for selfie/ID scanning (Android will request permissions automatically)
        mediaCapturePermissionGrantType="grant"
        {...androidPermissionProp}
        allowsFullscreenVideo={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={handleNavigationChange}
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url || "";
          if (url.includes("personacallback")) {
            console.log("[Persona] Intercepted personacallback redirect before navigation:", url);
            void handlePersonaRedirect(url);
            return false; // block the WebView from trying to actually navigate there
          }
          return true;
        }}
        onLoadEnd={() => setLoading(false)}
        // Handle errors
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          // personacallback is a sentinel marker, not a real domain — it's
          // expected to fail DNS resolution (net::ERR_NAME_NOT_RESOLVED) if
          // it ever slips past onShouldStartLoadWithRequest on some platform
          // version. That failure is our success/completion signal, not a
          // real error, so don't alert the user over it.
          if ((nativeEvent.url || "").includes("personacallback")) {
            console.log("[Persona] Ignoring expected personacallback DNS error:", nativeEvent);
            return;
          }
          console.error("[Persona WebView] Error:", nativeEvent);
          Alert.alert(
            "Error",
            "Failed to load verification. Please try again.",
            [{ text: "OK", onPress: () => router.back() }]
          );
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("[Persona WebView] HTTP Error:", nativeEvent.statusCode);
        }}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  browserFallbackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  browserFallbackText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});