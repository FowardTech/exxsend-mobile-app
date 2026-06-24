import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import AppText from "./AppText";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import { useStyles } from "../theme/styles";
import { useOtherStyles } from "../theme/otherstyles";
import { useAppTheme } from "../theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title?: string;
  message?: string;
  onRetry: () => Promise<void> | void;
  retrying?: boolean;
  compact?: boolean;
  autoBack?: boolean;
  autoBackDelayMs?: number;
};

export default function NetworkErrorState({
  title = "No internet connection",
  message = "Check your network and we’ll take you back automatically once it’s back.",
  onRetry,
  retrying: retryingProp,
  compact = false,
  autoBack = true,
  autoBackDelayMs = 200,
}: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const otherstyles = useOtherStyles();

  const [retrying, setRetrying] = useState<boolean>(retryingProp ?? true);

  const backTimerRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const hasAutoBackTriggeredRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    };
  }, []);

  const safeGoBack = useCallback(() => {
    // ✅ GO BACK to the previous page (exactly what you asked)
    // @ts-ignore
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
    // fallback if there is no history (rare)
    router.replace("/" as any);
  }, [router]);

  const checkReachable = useCallback(async () => {
    const latest = await NetInfo.fetch();

    const ok = Boolean(latest.isConnected && latest.isInternetReachable !== false);

    // Some phones report isInternetReachable as null/unknown.
    // If connected, treat it as reachable.
    const reachable = ok || (Boolean(latest.isConnected) && latest.isInternetReachable == null);

    return reachable;
  }, []);

  const runRetryThenBack = useCallback(async () => {
    if (hasAutoBackTriggeredRef.current) return;
    hasAutoBackTriggeredRef.current = true;

    try {
      if (isMountedRef.current) setRetrying(true);

      // ✅ call retry so the previous screen can refresh data
      await onRetry?.();

      // ✅ go back after successful retry
      router.back();
      safeGoBack();
    } catch {
      // If retry fails, allow future auto attempts again
      hasAutoBackTriggeredRef.current = false;
      if (isMountedRef.current) setRetrying(false);
    }
  }, [onRetry, safeGoBack]);

  // ✅ Auto back when network comes back
  useEffect(() => {
    if (!autoBack) return;

    const unsub = NetInfo.addEventListener((state) => {
      const ok = Boolean(state.isConnected && state.isInternetReachable !== false);
      const reachable = ok || (Boolean(state.isConnected) && state.isInternetReachable == null);

      if (reachable) {
        // debounce to avoid flapping
        if (backTimerRef.current) clearTimeout(backTimerRef.current);

        backTimerRef.current = setTimeout(async () => {
          const stillReachable = await checkReachable();
          if (stillReachable) {
            await runRetryThenBack();
          }
        }, autoBackDelayMs);
      } else {
        // if we lose network again, allow auto back to trigger later
        hasAutoBackTriggeredRef.current = false;
        if (isMountedRef.current) setRetrying(false);
      }
    });

    // Also do an immediate check on mount (in case network is already back)
    (async () => {
      const reachable = await checkReachable();
      if (reachable) {
        router.back();
        await runRetryThenBack();
      }
    })();

    return () => {
      unsub();
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    };
  }, [autoBack, autoBackDelayMs, checkReachable, runRetryThenBack]);

  const handleManualRetry = useCallback(async () => {
    if (retrying) return;

    setRetrying(true);
    try {
      // await onRetry?.();

      // If retry worked and network is ok, go back
      const reachable = await checkReachable();
      if (reachable) {
        router.back(); 
        safeGoBack();
      } else setRetrying(false);
    } catch {
      setRetrying(false);
    }
  }, [retrying, onRetry, checkReachable, safeGoBack]);

  return (
    <View style={[otherstyles.netErrWrap, compact && otherstyles.netErrWrapCompact]}>
      <View style={otherstyles.netErrIconCircle}>
        {/* ✅ Icon instead of emoji */}
        <Ionicons name="wifi-outline" size={22} color={colors.primary} />
      </View>

      <AppText style={otherstyles.netErrTitle}>{title}</AppText>
      <AppText style={otherstyles.netErrMessage}>{message}</AppText>

      <Pressable
        onPress={handleManualRetry}
        style={[
          styles.primaryBtn,
          otherstyles.netErrBtn,
          { opacity: retrying ? 0.7 : 1 },
        ]}
        disabled={retrying}
      >
        {retrying ? (
          <View style={otherstyles.netErrBtnRow}>
            <ActivityIndicator color="#fff" />
            <AppText style={otherstyles.netErrBtnText}>Refreshing…</AppText>
          </View>
        ) : (
          <AppText style={otherstyles.netErrBtnText}>Refresh</AppText>
        )}
      </Pressable>

      <AppText style={otherstyles.netErrHint}>
        Tip: If you’re on VPN or weak Wi-Fi, switch to mobile data.
      </AppText>
    </View>
  );
}
