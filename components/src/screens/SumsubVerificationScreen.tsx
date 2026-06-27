import { getSumsubAccessToken, getSumsubVerificationStatus, SumsubVerificationStatus } from "@/api/config";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../../theme/colors";
import { RADIUS, SCREEN_PADDING, SPACE } from "../../../theme/designSystem";
import AppText from "../../AppText";

// @sumsub/react-native-mobilesdk-module is a native module — it must be
// installed (`npx expo install @sumsub/react-native-mobilesdk-module`) and
// the app rebuilt as a dev build (this does NOT work in Expo Go) before
// this screen will actually function. See the integration notes for the
// full setup.
import SNSMobileSDK from "@sumsub/react-native-mobilesdk-module";

type Stage = "loading" | "launching" | "submitted" | "checking" | "verified" | "rejected" | "retry" | "error";

const APPLICANT_ID_KEY = "sumsub_applicant_id";
// How long to keep actively polling right after the SDK closes, before
// settling into "we'll notify you" — the webhook can take a little while,
// this just gives fast feedback when review happens to finish quickly.
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 15; // ~1 minute

export default function SumsubVerificationScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [moderationComment, setModerationComment] = useState("");
  const pollCount = useRef(0);
  const pollTimer = useRef<any>(null);
  const applicantIdRef = useRef<string>("");

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const applyStatus = useCallback(async (status: SumsubVerificationStatus) => {
    if (!status.kycStatus && !status.action) return false;
    // Cache locally so the rest of the app (Home's verify-identity prompt,
    // feature gates, etc.) reflects this without waiting on a separate
    // profile refetch — but this is still ultimately downstream of the
    // backend's own webhook-driven value, not a locally-invented status.
    try {
      const userInfoStr = await AsyncStorage.getItem("user_info");
      if (userInfoStr && status.kycStatus) {
        const userInfo = JSON.parse(userInfoStr);
        userInfo.kycStatus = status.kycStatus;
        await AsyncStorage.setItem("user_info", JSON.stringify(userInfo));
      }
      if (status.kycStatus) await AsyncStorage.setItem("user_kyc_status", status.kycStatus);
    } catch { }

    if (status.moderationComment) setModerationComment(status.moderationComment);

    // action is more precise than kycStatus alone for deciding what to do
    // next — e.g. "wait" means still under review (keep polling), distinct
    // from "contact_support" which is a final rejection.
    if (status.action === "wait") return false;
    if (status.kycStatus === "verified") { setStage("verified"); return true; }
    if (status.action === "contact_support") { setStage("rejected"); return true; }
    if (status.action === "retry" || status.kycStatus === "retry") { setStage("retry"); return true; }
    if (status.kycStatus === "rejected") { setStage("rejected"); return true; }
    return false; // still pending — keep polling
  }, []);

  const pollStatus = useCallback(() => {
    stopPolling();
    pollTimer.current = setTimeout(async () => {
      pollCount.current += 1;
      try {
        const res = await getSumsubVerificationStatus({ userId: applicantIdRef.current });
        const settled = res.success ? await applyStatus(res) : false;
        if (settled) return;
      } catch { }
      if (pollCount.current < MAX_POLLS) {
        pollStatus();
      } else {
        // Stopped actively polling — the webhook + push notification (or
        // the next time this user opens the app) will carry it the rest
        // of the way. Not an error; just out of patience for this screen.
        setStage("submitted");
      }
    }, POLL_INTERVAL_MS);
  }, [applyStatus, stopPolling]);

  const launchSdk = useCallback(async () => {
    setStage("launching");
    setErrorMessage("");
    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) {
        setErrorMessage("Could not find your phone number. Please sign in again.");
        setStage("error");
        return;
      }

      const tokenRes = await getSumsubAccessToken(phone);
      if (!tokenRes.success || !tokenRes.token) {
        setErrorMessage(tokenRes.message || "Could not start identity verification.");
        setStage("error");
        return;
      }
      if (tokenRes.userId) {
        applicantIdRef.current = tokenRes.userId;
        await AsyncStorage.setItem(APPLICANT_ID_KEY, tokenRes.userId);
      }

      const sdk = SNSMobileSDK
        .init(tokenRes.token, async () => {
          // Token refresh — same endpoint, called again mid-flow whenever
          // the SDK's ~10 min token is about to expire.
          const refreshed = await getSumsubAccessToken(phone);
          return refreshed.token || "";
        })
        .withHandlers({
          onStatusChanged: (event: any) => {
            console.log("[Sumsub] status changed", event);
          },
        })
        .build();

      const result = await sdk.launch();

      // result.success === true only means the user finished submitting
      // (docs/selfie/liveness) — NOT that they're verified. The webhook to
      // the backend is the real source of truth, so either way we move to
      // checking status rather than granting anything here.
      if (result?.success) {
        setStage("submitted");
        pollCount.current = 0;
        pollStatus();
      } else {
        // User backed out of the SDK before finishing.
        setStage("loading");
        if (router.canGoBack()) router.back();
      }
    } catch (e: any) {
      setErrorMessage(e?.message || "Something went wrong starting identity verification.");
      setStage("error");
    }
  }, [pollStatus, router]);

  useEffect(() => {
    launchSdk();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    pollCount.current = 0;
    launchSdk();
  };

  const handleDone = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as any);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.centered}>
        {(stage === "loading" || stage === "launching") && (
          <>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <AppText style={s.statusText}>
              {stage === "launching" ? "Starting verification…" : "Loading…"}
            </AppText>
          </>
        )}

        {stage === "submitted" && (
          <>
            <View style={[s.iconCircle, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="time-outline" size={32} color={COLORS.primary} />
            </View>
            <AppText style={s.title}>Verification submitted</AppText>
            <AppText style={s.body}>We're reviewing your information now. We'll notify you as soon as it's done.</AppText>
            <Pressable onPress={handleDone} style={s.primaryBtn}>
              <AppText style={s.primaryBtnText}>Done</AppText>
            </Pressable>
          </>
        )}

        {stage === "verified" && (
          <>
            <View style={[s.iconCircle, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="checkmark-circle" size={32} color="#059669" />
            </View>
            <AppText style={s.title}>You're verified!</AppText>
            <AppText style={s.body}>Your identity has been confirmed. You now have full access to send and receive money.</AppText>
            <Pressable onPress={handleDone} style={s.primaryBtn}>
              <AppText style={s.primaryBtnText}>Continue</AppText>
            </Pressable>
          </>
        )}

        {stage === "rejected" && (
          <>
            <View style={[s.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="close-circle" size={32} color={COLORS.red} />
            </View>
            <AppText style={s.title}>Verification unsuccessful</AppText>
            <AppText style={s.body}>We weren't able to verify your identity. Please contact support for help with next steps.</AppText>
            <Pressable onPress={handleDone} style={s.primaryBtn}>
              <AppText style={s.primaryBtnText}>Go to Home</AppText>
            </Pressable>
          </>
        )}

        {stage === "retry" && (
          <>
            <View style={[s.iconCircle, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="refresh-circle-outline" size={32} color="#D97706" />
            </View>
            <AppText style={s.title}>Let's try again</AppText>
            <AppText style={s.body}>{moderationComment || "Something about your last submission needs another attempt — usually a clearer photo or document scan."}</AppText>
            <Pressable onPress={handleRetry} style={s.primaryBtn}>
              <AppText style={s.primaryBtnText}>Try again</AppText>
            </Pressable>
          </>
        )}

        {stage === "error" && (
          <>
            <View style={[s.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="alert-circle-outline" size={32} color={COLORS.red} />
            </View>
            <AppText style={s.title}>Couldn't start verification</AppText>
            <AppText style={s.body}>{errorMessage || "Please check your connection and try again."}</AppText>
            <Pressable onPress={handleRetry} style={s.primaryBtn}>
              <AppText style={s.primaryBtnText}>Try again</AppText>
            </Pressable>
            <Pressable onPress={handleDone} style={s.secondaryBtn}>
              <AppText style={s.secondaryBtnText}>Cancel</AppText>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING * 1.5 },
  statusText: { fontSize: 14, color: COLORS.muted, fontWeight: "600", marginTop: SPACE.lg },
  iconCircle: { width: 72, height: 72, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", marginBottom: SPACE.xl },
  title: { fontSize: 20, fontWeight: "600", color: COLORS.text, textAlign: "center" },
  body: { fontSize: 14, color: COLORS.muted, fontWeight: "500", textAlign: "center", marginTop: SPACE.sm, lineHeight: 21 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xxxl, marginTop: SPACE.xxl, alignSelf: "stretch", alignItems: "center" },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  secondaryBtn: { paddingVertical: SPACE.md, marginTop: SPACE.sm },
  secondaryBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: "600" },
});
