import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { API_BASE_URL } from "../../../../../api/config";
import CountryFlag from "../../../../../components/CountryFlag";
import ScreenShell from "../../../../../components/ScreenShell";
import { COLORS } from "../../../../../theme/colors";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "../../../../../theme/designSystem";
import AppText from "../../../../AppText";
import BackButton from "../../../../BackButton";

type UserAccount = {
  id: string;
  currencyCode: string;
  iban?: string;
  accountNumber?: string;
};

// Matches the actual backend response structure from get_user_limits_summary
type PeriodLimit = {
  used: number;
  limit: number;
  remaining: number;
};

type LimitInfo = {
  isActive?: boolean;
  daily?: PeriodLimit;
  weekly?: PeriodLimit;
  monthly?: PeriodLimit;
};

type LimitsData = {
  send?: LimitInfo;
  receive?: LimitInfo;
  currency?: string;
};

function normalizeCurrency(code: any) {
  return String(code || "").toUpperCase().trim();
}

function formatAmount(val: number | undefined | null, currency: string) {
  const num = Number(val);
  if (isNaN(num) || val === undefined || val === null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${num}`;
  }
}

function LimitRow({
  label,
  limit,
  used,
  remaining,
  currency,
}: {
  label: string;
  limit: number;
  used: number;
  remaining: number;
  currency: string;
}) {
  const safeLimit = Number(limit) || 0;
  const safeUsed = Number(used) || 0;
  const safeRemaining = Number(remaining) || 0;
  const percent = safeLimit > 0 ? Math.min((safeUsed / safeLimit) * 100, 100) : 0;
  return (
    <View style={m.limitRow}>
      <AppText style={m.limitLabel}>{label}</AppText>
      <View style={m.limitValues}>
        <AppText style={m.limitUsed}>
          {formatAmount(safeUsed, currency)} / {formatAmount(safeLimit, currency)}
        </AppText>
        <AppText style={m.limitRemaining}>
          {formatAmount(safeRemaining, currency)} left
        </AppText>
      </View>
      <View style={m.progressBg}>
        <View style={[m.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function LimitSection({
  title,
  icon,
  data,
  currency,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  data?: LimitInfo;
  currency: string;
}) {
  if (!data) {
    return (
      <View style={m.section}>
        <View style={m.sectionHeader}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
          <AppText style={m.sectionTitle}>{title}</AppText>
        </View>
        <AppText style={m.noData}>No limit configured</AppText>
      </View>
    );
  }

  return (
    <View style={m.section}>
      <View style={m.sectionHeader}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
        <AppText style={m.sectionTitle}>{title}</AppText>
      </View>
      {data.daily && (
        <LimitRow
          label="Daily"
          limit={data.daily.limit}
          used={data.daily.used}
          remaining={data.daily.remaining}
          currency={currency}
        />
      )}
      {data.weekly && (
        <LimitRow
          label="Weekly"
          limit={data.weekly.limit}
          used={data.weekly.used}
          remaining={data.weekly.remaining}
          currency={currency}
        />
      )}
      {data.monthly && (
        <LimitRow
          label="Monthly"
          limit={data.monthly.limit}
          used={data.monthly.used}
          remaining={data.monthly.remaining}
          currency={currency}
        />
      )}
    </View>
  );
}

export default function AccountLimitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ currency?: string }>();
  const [accounts, setAccounts] = useState<UserAccount[]>([]);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsData, setLimitsData] = useState<LimitsData | null>(null);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const phone = (await AsyncStorage.getItem("user_phone")) || "";

        // Try multiple cache key patterns (v2 is current, v1 is legacy fallback)
        let raw: string | null = null;

        if (phone) {
          // Try v2 first (current HomeScreen pattern)
          raw = await AsyncStorage.getItem(`cached_accounts_v2_${phone}`);
          // Fallback to v1 pattern
          if (!raw) {
            raw = await AsyncStorage.getItem(`cached_accounts_v1_${phone}`);
          }
        }
        // Fallback to non-scoped legacy keys
        if (!raw) {
          raw = await AsyncStorage.getItem("cached_accounts_v2");
        }
        if (!raw) {
          raw = await AsyncStorage.getItem("cached_accounts_v1");
        }

        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          setAccounts(
            parsed.map((a: any) => ({
              id: String(a.id || `${Date.now()}-${Math.random()}`),
              currencyCode: normalizeCurrency(a.currencyCode),
              iban: a.iban,
              accountNumber: a.accountNumber,
            }))
          );
        }
      } catch {
        setAccounts([]);
      }
    })();
  }, []);

  const visible = useMemo(
    () => accounts.filter((a) => normalizeCurrency(a.currencyCode)),
    [accounts]
  );

  const fetchLimits = async (currency: string) => {
    setLimitsLoading(true);
    setLimitsData(null);
    try {
      const phone = (await AsyncStorage.getItem("user_phone")) || "";
      if (!phone) {
        setLimitsData({ currency });
        return;
      }

      const url = `${API_BASE_URL}/limits/my-limits?phone=${encodeURIComponent(
        phone
      )}&currency=${encodeURIComponent(currency)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json();
      if (json.success && json.limits) {
        setLimitsData({
          send: json.limits.send,
          receive: json.limits.receive,
          currency,
        });
      } else {
        setLimitsData({ currency });
      }
    } catch (e) {
      console.log("Error fetching limits:", e);
      setLimitsData({ currency });
    } finally {
      setLimitsLoading(false);
    }
  };

  const handleAccountPress = (currency: string) => {
    setSelectedCurrency(currency);
    setModalVisible(true);
    fetchLimits(currency);
  };

  // Deep-link support: if we arrived here with a ?currency= param (e.g. from
  // the wallet screen's "View account limits" button), jump straight to that
  // currency's limits instead of making the user pick it from the list again.
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const target = normalizeCurrency(params.currency || "");
    if (!target || accounts.length === 0) return;

    const match = accounts.find((a) => normalizeCurrency(a.currencyCode) === target);
    if (match) {
      autoOpenedRef.current = true;
      handleAccountPress(match.currencyCode);
    }
  }, [params.currency, accounts]);

  const closeModal = () => {
    setModalVisible(false);
    setSelectedCurrency("");
    setLimitsData(null);
  };

  return (
    <>
      <ScreenShell padded={false} scrollable={false}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={s.header}>
            <BackButton onPress={() => router.back()} />
            <AppText style={s.headerTitle}>Account limits</AppText>
            <View style={{ width: 40 }} />
          </View>

          <AppText style={s.subtitle}>
            Choose account to see send and receive limit
          </AppText>

          <View style={s.card}>
            {visible.length === 0 ? (
              <View style={{ padding: 16, alignItems: "center" }}>
                <Ionicons name="wallet-outline" size={28} color="#9CA3AF" />
                <AppText
                  style={{
                    marginTop: 10,
                    color: "#6B7280",
                    fontWeight: "600",
                  }}
                >
                  No wallets found yet
                </AppText>
              </View>
            ) : (
              visible.map((a, idx) => {
                const isLast = idx === visible.length - 1;
                return (
                  <Pressable
                    key={a.id}
                    style={[s.row, !isLast && s.divider]}
                    onPress={() => handleAccountPress(a.currencyCode)}
                  >
                    <View style={s.left}>
                      <CountryFlag currencyCode={a.currencyCode} size="md" />
                      <View style={{ marginLeft: 10 }}>
                        <AppText style={s.title}>{a.currencyCode}</AppText>
                        <AppText style={s.sub}>
                          {a.iban
                            ? "IBAN, SWIFT/BIC"
                            : a.accountNumber
                              ? "Account number"
                              : "Account"}
                        </AppText>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      </ScreenShell>

      {/* Limits Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={m.overlay}>
          <View style={m.modalContainer}>
            {/* Modal Header */}
            <View style={m.modalHeader}>
              <View style={m.headerLeft}>
                <CountryFlag currencyCode={selectedCurrency} size="md" />
                <AppText style={m.modalTitle}>{selectedCurrency} Limits</AppText>
              </View>
              <Pressable onPress={closeModal} style={m.closeBtn}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={m.modalBody}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {limitsLoading ? (
                <View style={m.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <AppText style={m.loadingText}>Loading limits...</AppText>
                </View>
              ) : limitsData ? (
                <>
                  <LimitSection
                    title="Send Limits"
                    icon="arrow-up-circle-outline"
                    data={limitsData.send}
                    currency={selectedCurrency}
                  />
                  <LimitSection
                    title="Receive Limits"
                    icon="arrow-down-circle-outline"
                    data={limitsData.receive}
                    currency={selectedCurrency}
                  />

                  {/* Info Notice */}
                  <View style={m.notice}>
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color="#92400E"
                    />
                    <AppText style={m.noticeText}>
                      Limits reset at midnight (daily), every Sunday (weekly), and
                      the 1st of each month (monthly).
                    </AppText>
                  </View>
                </>
              ) : (
                <View style={m.errorContainer}>
                  <Ionicons name="warning-outline" size={32} color="#9CA3AF" />
                  <AppText style={m.errorText}>Could not load limits</AppText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.sm + 2,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  subtitle: {
    paddingHorizontal: SCREEN_PADDING,
    marginTop: SPACE.xs + 2,
    color: COLORS.muted,
    fontWeight: "600",
    fontSize: 12,
  },
  card: {
    marginTop: SPACE.lg - 2,
    marginHorizontal: SCREEN_PADDING,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  row: {
    paddingHorizontal: SPACE.md + 2,
    paddingVertical: SPACE.lg - 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  left: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  sub: { marginTop: 2, fontSize: 12, fontWeight: "600", color: COLORS.muted },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: "80%",
    paddingTop: SPACE.xs + 2,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACE.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACE.lg,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: SPACE.md,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  errorText: {
    marginTop: SPACE.sm + 2,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
  },
  section: {
    marginBottom: SPACE.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  noData: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
    fontStyle: "italic",
  },
  limitRow: {
    marginBottom: SPACE.lg - 2,
  },
  limitLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  limitValues: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACE.sm,
  },
  limitUsed: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
  },
  limitRemaining: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  progressBg: {
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  notice: {
    marginTop: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: "#FDE68A",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.accentDark,
    lineHeight: 16,
  },
});
