import { Ionicons } from "@expo/vector-icons";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { View, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScreenShell from "../../../components/ScreenShell";
import Pill from "../../../components/Pill";
import { useStyles } from "../../../theme/styles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { getUserTransactions, WalletTransaction } from "../../../api/transactions";

interface TransactionGroup {
  date: string;
  items: WalletTransaction[];
}

const STATUS_FILTERS = ["All", "Completed", "Pending", "Failed"];

// ✅ Make a safe unique key for each tx (handles duplicate references)
const txKey = (tx: WalletTransaction, idx: number) => {
  const ref = String((tx as any)?.reference ?? (tx as any)?.id ?? "tx");
  const created = String((tx as any)?.createdAt ?? (tx as any)?.created_at ?? "");
  const amt = String((tx as any)?.amount ?? "");
  return `${ref}__${created}__${amt}__${idx}`;
};

export default function AllTransactionsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [currencyFilter, setCurrencyFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadTransactions = useCallback(
    async (refresh = false) => {
      try {
        const phone = await AsyncStorage.getItem("user_phone");
        if (!phone) {
          setTransactions([]);
          return;
        }

        const currentPage = refresh ? 1 : page;
        const res = await getUserTransactions(phone, currentPage, 50, currencyFilter || undefined);

        if (res.success) {
          if (refresh) {
            setTransactions(res.transactions);
            setPage(1);
          } else {
            setTransactions((prev) => [...prev, ...res.transactions]);
          }
          setHasMore(res.hasNext);
        }
      } catch (e) {
        console.error("Failed to load transactions:", e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, currencyFilter]
  );

  useEffect(() => {
    loadTransactions(true);
  }, [currencyFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions(true);
  }, [loadTransactions]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    let filtered = transactions;
    if (statusFilter !== "All") {
      filtered = transactions.filter((tx) => tx.status.toLowerCase() === statusFilter.toLowerCase());
    }

    const groups: Record<string, WalletTransaction[]> = {};

    for (const tx of filtered) {
      const date = new Date(tx.createdAt);
      const dateKey = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    }

    return Object.entries(groups)
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => {
        const dateA = new Date(a.items[0]?.createdAt || 0);
        const dateB = new Date(b.items[0]?.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
  }, [transactions, statusFilter]);

  const getTransactionIcon = (tx: WalletTransaction): keyof typeof Ionicons.glyphMap => {
    switch (tx.transactionType) {
      case "conversion":
        return "swap-horizontal";
      case "payout":
      case "transfer_out":
        return "arrow-up";
      case "deposit":
      case "transfer_in":
        return "arrow-down";
      case "fee":
        return "wallet";
      default:
        return "ellipse";
    }
  };

  const getTransactionTitle = (tx: WalletTransaction): string => {
    if (tx.counterpartyName) {
      if (tx.transactionType === "payout" || tx.transactionType === "transfer_out") {
        return `To ${tx.counterpartyName}`;
      }
      return `From ${tx.counterpartyName}`;
    }

    switch (tx.transactionType) {
      case "conversion":
        return `Convert ${tx.fromCurrency || tx.currency} → ${tx.toCurrency || ""}`;
      case "payout":
        return `Sent ${tx.currency}`;
      case "deposit":
        return `Received ${tx.currency}`;
      case "fee":
        return "Fee";
      default:
        return tx.description || tx.transactionType || "Transaction";
    }
  };

  const formatAmount = (tx: WalletTransaction): string => {
    const isOutgoing =
      tx.transactionType === "payout" || tx.transactionType === "transfer_out" || tx.amount < 0;
    const absAmount = Math.abs(tx.amount);
    const formatted = absAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${isOutgoing ? "-" : "+"}${formatted} ${tx.currency}`;
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case "completed":
        return colors.green;
      case "pending":
      case "processing":
        return colors.accent;
      case "failed":
      case "cancelled":
        return colors.red;
      default:
        return colors.gray;
    }
  };

  return (
    <ScreenShell padded={false} scrollable={false}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header */}
          <View style={styles.headerRow}>
            {router.canGoBack() && <BackButton onPress={() => router.back()} />}
            <View style={{ flex: 1 }}>
              <AppText style={[styles.headerTitle, {paddingHorizontal: 16}]}>Transactions</AppText>
              {/* <AppText style={styles.subtitle}>All your financial activity</AppText> */}
            </View>
          </View>

          {/* Status Filters */}
          <View style={styles.filtersRow}>
            {STATUS_FILTERS.map((filter) => (
              <Pressable key={filter} onPress={() => setStatusFilter(filter)}>
                <Pill title={filter} active={statusFilter === filter} />
              </Pressable>
            ))}
          </View>

          {/* Transactions List */}
          {loading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <AppText style={{ marginTop: 12, color: "#9CA3AF", fontWeight: "600" }}>
                Loading transactions...
              </AppText>
            </View>
          ) : groupedTransactions.length === 0 ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="receipt-outline" size={48} color={colors.muted} style={{ marginBottom: 12 }} />
              <AppText style={{ color: "#6b7280", fontWeight: "600", fontSize: 16 }}>
                No transactions yet
              </AppText>
            </View>
          ) : (
            groupedTransactions.map((group) => (
              // ✅ stable group key (date string is unique per group)
              <View key={group.date} style={{ marginTop: 14, paddingHorizontal: 16 }}>
                <AppText style={styles.groupDate}>{group.date}</AppText>
                <View style={styles.groupLine} />

                {group.items.map((tx, i) => (
                  <Pressable
                    // ✅ FIX: unique key even if reference repeats
                    key={txKey(tx, i)}
                    style={styles.txRow}
                    onPress={() =>
                      router.push({
                        pathname: "/transactiondetail/[reference]",
                        params: { reference: encodeURIComponent(String((tx as any).reference)) },
                      } as any)
                    }
                  >
                    <View style={styles.txLeft}>
                      <View style={styles.txIcon}>
                        <Ionicons name={getTransactionIcon(tx)} size={16} color={colors.text} />
                      </View>
                      <View>
                        <AppText style={styles.txTitle}>{getTransactionTitle(tx)}</AppText>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <AppText style={styles.txTime}>{formatTime(tx.createdAt)}</AppText>
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: getStatusColor(tx.status),
                            }}
                          />
                          <AppText
                            style={{
                              fontSize: 11,
                              color: getStatusColor(tx.status),
                              fontWeight: "600",
                              textTransform: "capitalize",
                            }}
                          >
                            {tx.status}
                          </AppText>
                        </View>
                      </View>
                    </View>

                    <View style={styles.txRight}>
                      <AppText
                        style={[
                          styles.txAmt,
                          {
                            color:
                              tx.transactionType === "payout" || tx.amount < 0
                                ? "#ef4444"
                                : colors.primary,
                          },
                        ]}
                      >
                        {formatAmount(tx)}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))
          )}

          {/* Load More */}
          {hasMore && !loading && (
            <Pressable
              onPress={() => {
                setPage((p) => p + 1);
                loadTransactions(false);
              }}
              style={{
                marginHorizontal: 16,
                marginTop: 16,
                paddingVertical: 12,
                backgroundColor: "#f3f4f6",
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <AppText style={{ fontWeight: "700", color: "#374151" }}>Load More</AppText>
            </Pressable>
          )}
      </ScrollView>
    </ScreenShell>
  );
}
