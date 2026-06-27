/**
 * components/LiquidityBanner.tsx
 *
 * Reusable inline banner shown above a Confirm/Continue button when a
 * pre-flight liquidity check (or a late LIQUIDITY_LOW from an execute
 * call) blocks the action. Shows a live "Retry in mm:ss" countdown and
 * automatically fires onRetry once it reaches zero.
 *
 * Orange for severity "low", red for severity "critical".
 */
import type { LiquidityResult } from "@/api/liquidity";
import { COLORS } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import AppText from "./AppText";

interface Props {
  /** The blocked result — pass null/undefined to render nothing */
  result: LiquidityResult | null | undefined;
  /** Called once the countdown reaches zero, so the caller can re-run the pre-flight check */
  onRetry: () => void;
  /** Show a small spinner in place of the countdown while the retry call is in flight */
  retrying?: boolean;
}

function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function LiquidityBanner({ result, onRetry, retrying = false }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number>(result?.retryAfterSeconds ?? 0);
  const hasFiredRetry = useRef(false);

  // Reset the countdown whenever a new blocked result comes in
  useEffect(() => {
    if (result && !result.ok) {
      setSecondsLeft(result.retryAfterSeconds ?? 600);
      hasFiredRetry.current = false;
    }
  }, [result]);

  useEffect(() => {
    if (!result || result.ok) return;
    if (secondsLeft <= 0) {
      if (!hasFiredRetry.current) {
        hasFiredRetry.current = true;
        onRetry();
      }
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result]);

  if (!result || result.ok) return null;

  const isCritical = result.severity === "critical";
  const palette = isCritical
    ? { bg: COLORS.errorLight, border: "#FCA5A5", icon: COLORS.red, text: "#7F1D1D", timer: COLORS.red }
    : { bg: COLORS.accentLight, border: "#FDE68A", icon: COLORS.accentDark, text: COLORS.accentDark, timer: COLORS.accentDark };

  return (
    <View style={[s.wrap, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons
        name={isCritical ? "alert-circle" : "time-outline"}
        size={18}
        color={palette.icon}
        style={{ marginRight: 10, marginTop: 1 }}
      />
      <View style={{ flex: 1 }}>
        <AppText style={[s.message, { color: palette.text }]}>{result.message}</AppText>
        <View style={s.retryRow}>
          {retrying ? (
            <>
              <ActivityIndicator size="small" color={palette.icon} />
              <AppText style={[s.retryText, { color: palette.timer, marginLeft: 8 }]}>Checking…</AppText>
            </>
          ) : (
            <>
              <Ionicons name="refresh-outline" size={12} color={palette.timer} />
              <AppText style={[s.retryText, { color: palette.timer }]}>
                {"  "}Retry in {formatMMSS(secondsLeft)}
              </AppText>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  message: { fontSize: 13, fontWeight: "600", lineHeight: 19 },
  retryRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  retryText: { fontSize: 12, fontWeight: "600" },
});
