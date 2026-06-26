import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "./AppText";
import { COLORS } from "../theme/colors";
import { SPACE, RADIUS } from "../theme/designSystem";
import { FeeWaiversResponse, getSmallestQualifyingAmount } from "../api/feeWaivers";

interface Props {
  waivers: FeeWaiversResponse | null;
}

export default function FeeWaiverBanner({ waivers }: Props) {
  if (!waivers || !waivers.success) return null;

  if (waivers.totalFreeTransactions > 0) {
    return (
      <View style={[s.card, s.cardEarned]}>
        <AppText style={s.emoji}>🎁</AppText>
        <AppText style={s.textEarned}>
          You have {waivers.totalFreeTransactions} free transaction{waivers.totalFreeTransactions > 1 ? "s" : ""} available
        </AppText>
      </View>
    );
  }

  // Otherwise, show progress toward the promo closest to being earned (the
  // one with the lowest remainingToEarn, so the most achievable goal leads).
  const inProgress = waivers.promos
    .filter((p) => p.progress > 0 && p.remainingToEarn > 0)
    .sort((a, b) => a.remainingToEarn - b.remainingToEarn)[0];

  if (!inProgress) return null;

  const smallest = getSmallestQualifyingAmount(inProgress);
  const amountPhrase = smallest
    ? `${smallest.currency} ${smallest.min_amount.toLocaleString("en-US")}+`
    : "a qualifying";

  return (
    <View style={[s.card, s.cardProgress]}>
      <Ionicons name="trending-up" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
      <AppText style={s.textProgress}>
        Send {inProgress.remainingToEarn} more {amountPhrase} transfer{inProgress.remainingToEarn > 1 ? "s" : ""} to earn a free transaction
      </AppText>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    marginHorizontal: 0,
  },
  cardEarned: { backgroundColor: "#D1FAE5" },
  cardProgress: { backgroundColor: COLORS.primaryLight },
  emoji: { fontSize: 16, marginRight: 8 },
  textEarned: { flex: 1, fontSize: 13, fontWeight: "700", color: "#065F46" },
  textProgress: { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.primary },
});
