/**
 * ConversionStatusBanner - Shows explicit debit/credit status for pending conversions
 * Auto-hides when settlement completes
 */
import React from "react";
import { View, Pressable, Animated, StyleSheet } from "react-native";
import AppText from "./AppText";
import { Ionicons } from "@expo/vector-icons";
import { PendingSettlement } from "../hooks/usePendingSettlements";

interface ConversionStatusBannerProps {
  settlements: PendingSettlement[];
  onDismiss?: (id: string) => void;
  flagsByCurrency?: Record<string, string>;
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
};

const formatAmount = (amount: number, currency: string) => {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
};

// Fallback flag emojis for currencies not in the API response
const FALLBACK_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  AUD: "🇦🇺",
  GBP: "🇬🇧",
  EUR: "🇪🇺",
  CAD: "🇨🇦",
  NGN: "🇳🇬",
  GHS: "🇬🇭",
  KES: "🇰🇪",
  ZAR: "🇿🇦",
  RWF: "🇷🇼",
  UGX: "🇺🇬",
  TZS: "🇹🇿",
  ZMW: "🇿🇲",
};

const getFlag = (currency: string, flagsByCurrency: Record<string, string>) => {
  const key = (currency || "").toUpperCase().trim();
  return flagsByCurrency[key] || FALLBACK_FLAGS[key] || "🏳️";
};

export default function ConversionStatusBanner({
  settlements,
  onDismiss,
  flagsByCurrency = {},
}: ConversionStatusBannerProps) {
  if (settlements.length === 0) return null;

  return (
    <View style={styles.container}>
      {settlements.map((settlement) => {
        const sellFlag = getFlag(settlement.sellCurrency, flagsByCurrency);
        const buyFlag = getFlag(settlement.buyCurrency, flagsByCurrency);
        const hasSellPending = Number(settlement.sellAmount || 0) > 0;
        const hasBuyPending = Number(settlement.buyAmount || 0) > 0;

        return (
          <View key={settlement.id} style={styles.bannerCard}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.pulsingDot} />
                <AppText style={styles.headerTitle}>Conversion Settling</AppText>
              </View>
              <AppText style={styles.timestamp}>{formatTime(settlement.createdAt)}</AppText>
            </View>

            {/* Status rows */}
            <View style={styles.statusContainer}>
              {/* Debited row */}
              {hasSellPending && (
                <View style={styles.statusRow}>
                  <View style={styles.statusIconContainer}>
                    <Ionicons name="arrow-up-circle" size={20} color="#EF4444" />
                  </View>
                  <View style={styles.statusContent}>
                    <AppText style={styles.statusLabel}>Debited from</AppText>
                    <AppText style={styles.statusAmount}>
                      {sellFlag} -{formatAmount(settlement.sellAmount, settlement.sellCurrency)}
                    </AppText>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                </View>
              )}

              {/* Arrow separator */}
              {hasSellPending && hasBuyPending && (
                <View style={styles.arrowContainer}>
                  <View style={styles.arrowLine} />
                  <Ionicons name="arrow-down" size={14} color="#9CA3AF" />
                  <View style={styles.arrowLine} />
                </View>
              )}

              {/* Credited row */}
              {hasBuyPending && (
                <View style={styles.statusRow}>
                  <View style={[styles.statusIconContainer, styles.creditIcon]}>
                    <Ionicons name="arrow-down-circle" size={20} color="#22C55E" />
                  </View>
                  <View style={styles.statusContent}>
                    <AppText style={styles.statusLabel}>Credited to</AppText>
                    <AppText style={[styles.statusAmount, styles.creditAmount]}>
                      {buyFlag} +{formatAmount(settlement.buyAmount, settlement.buyCurrency)}
                    </AppText>
                  </View>
                  <View style={styles.pendingBadge}>
                    <AppText style={styles.pendingText}>Settling</AppText>
                  </View>
                </View>
              )}
            </View>

            {/* Footer note */}
            <View style={styles.footer}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <AppText style={styles.footerText}>
                Balance will update once settlement completes
              </AppText>
            </View>

            {/* Dismiss button */}
            {onDismiss && (
              <Pressable
                style={styles.dismissButton}
                onPress={() => onDismiss(settlement.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={16} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  bannerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    position: "relative",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  timestamp: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  statusContainer: {
    gap: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  creditIcon: {
    backgroundColor: "#DCFCE7",
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 2,
  },
  statusAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },
  creditAmount: {
    color: "#22C55E",
  },
  arrowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  arrowLine: {
    width: 20,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  footerText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  dismissButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
});
