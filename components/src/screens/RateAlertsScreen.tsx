import {
  RateAlert,
  deleteRateAlert,
  getExchangeRates,
  getPublicCurrencies,
  getRateAlerts,
  updateRateAlert,
} from "@/api/config";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import ScreenShell from "../../../components/ScreenShell";
import { COLORS } from "../../../theme/colors";
import { styles } from "../../../theme/styles";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";
import BottomSheet from "../../BottomSheet";
import CountryFlag from "../../CountryFlag";
import CreateRateAlertSheet from "../../CreateRateAlertSheet";

// Fallback flags for common currencies (used only if backend doesn't provide)
const FALLBACK_FLAGS: Record<string, string> = {
  USD: "🇺🇸", CAD: "🇨🇦", GBP: "🇬🇧", EUR: "🇪🇺", NGN: "🇳🇬", GHS: "🇬🇭",
  KES: "🇰🇪", RWF: "🇷🇼", UGX: "🇺🇬", TZS: "🇹🇿", ZMW: "🇿🇲", XOF: "🇸🇳",
  XAF: "🇨🇲", ZAR: "🇿🇦", AED: "🇦🇪", INR: "🇮🇳", JPY: "🇯🇵", CNY: "🇨🇳",
  AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭", SGD: "🇸🇬", HKD: "🇭🇰", MXN: "🇲🇽", BRL: "🇧🇷",
};

type PublicCurrency = {
  code: string;
  name?: string;
  flag?: string;
  countryCode?: string;
  enabled?: boolean;
};

type CurrencyPair = {
  from: string;
  to: string;
  fromFlag: string;
  toFlag: string;
};

type LiveRate = {
  from: string;
  to: string;
  rate: number;
  change?: string;
};

type TabType = "active" | "history";

export default function RateAlertsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ highlightId?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<RateAlert[]>([]);
  const [liveRates, setLiveRates] = useState<Map<string, LiveRate>>(new Map());
  const [liveRatesFetchAttempted, setLiveRatesFetchAttempted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [highlightedId, setHighlightedId] = useState<string | null>(params.highlightId || null);

  // Clear the highlight a few seconds after landing here from a notification tap
  useEffect(() => {
    if (!highlightedId) return;
    const t = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightedId]);

  // Dynamic currencies from backend
  const [currencies, setCurrencies] = useState<PublicCurrency[]>([]);
  const [currencyFlags, setCurrencyFlags] = useState<Record<string, string>>({});

  // Alert creation sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [selectedPair, setSelectedPair] = useState<{
    from: string;
    to: string;
    fromFlag: string;
    toFlag: string;
    rate: number;
  } | null>(null);

  // Custom pair picker state — lets the user pick ANY two enabled
  // currencies, not just the curated quick-create shortcuts, since those
  // only ever generate pairs starting from USD/GBP/EUR/CAD and cap at 10
  // total pairs regardless of how many currencies are actually enabled.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<"from" | "to">("from");
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  // Get flag for a currency code with fallback
  const getFlagForCurrency = useCallback(
    (code: string) => {
      const key = code.toUpperCase().trim();
      return currencyFlags[key] || FALLBACK_FLAGS[key] || "🏳️";
    },
    [currencyFlags]
  );

  // Load enabled currencies from backend
  const loadCurrencies = useCallback(async () => {
    try {
      const data = await getPublicCurrencies(false); // Only enabled currencies
      setCurrencies(data);

      // Build flags map
      const flagsMap: Record<string, string> = {};
      for (const c of data || []) {
        const code = (c.code || "").toUpperCase().trim();
        const flag = (c.flag || "").trim();
        if (code && flag) {
          flagsMap[code] = flag;
        }
      }
      setCurrencyFlags(flagsMap);
    } catch (e) {
      console.log("Failed to load currencies:", e);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) return;

      const res = await getRateAlerts(phone);
      if (res.success) {
        const normalized = (res.alerts || []).map((a: any) => {
          const rawTarget = a.target_rate ?? a.targetRate;
          const parsedTarget =
            typeof rawTarget === "number"
              ? rawTarget
              : typeof rawTarget === "string" && rawTarget.trim() !== "" && !isNaN(Number(rawTarget))
                ? Number(rawTarget)
                : undefined;

          // is_active sometimes comes back as a string ("true"/"false"/
          // "1"/"0") instead of a real boolean, which a plain truthy check
          // gets wrong for the literal string "false" (truthy in JS) and
          // for numeric 0 wrapped in a string. Normalize explicitly rather
          // than trust whatever shape the field happens to arrive in.
          const rawActive = a.is_active ?? a.isActive;
          const normalizedActive =
            typeof rawActive === "boolean"
              ? rawActive
              : typeof rawActive === "number"
                ? rawActive !== 0
                : typeof rawActive === "string"
                  ? !["false", "0", "", "null", "undefined"].includes(rawActive.trim().toLowerCase())
                  : !!rawActive;

          return {
            ...a,
            from_currency: a.from_currency || a.fromCurrency || "",
            to_currency: a.to_currency || a.toCurrency || "",
            target_rate: parsedTarget,
            is_active: normalizedActive,
          };
        });
        setAlerts(normalized);
      }
    } catch (e) {
      console.log("Failed to load alerts:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadLiveRates = useCallback(async (pairsToFetch?: Array<{ from: string; to: string }>) => {
    try {
      const pairs = pairsToFetch && pairsToFetch.length > 0
        ? pairsToFetch
        : []; // nothing to fetch yet (e.g. currencies haven't loaded)
      if (pairs.length === 0) return;

      const pairsParam = Array.from(
        new Set(pairs.map((p) => `${p.from}-${p.to}`))
      ).join(",");

      const res = await getExchangeRates(pairsParam);
      console.log(`[RateAlerts] Requested pairs: "${pairsParam}" — success: ${res.success}, rates count: ${res.rates?.length ?? 0}`);
      if (res.rates && res.rates.length > 0) {
        console.log(`[RateAlerts] Sample rate object:`, JSON.stringify(res.rates[0]));
      }
      if (res.success && res.rates) {
        const rateMap = new Map<string, LiveRate>();
        res.rates.forEach((r: any) => {
          const key = `${r.from_currency || r.from}-${r.to_currency || r.to}`;
          const rawRate = r.rate;
          const rate = typeof rawRate === "number" ? rawRate : typeof rawRate === "string" && !isNaN(Number(rawRate)) ? Number(rawRate) : undefined;
          if (rate === undefined) return; // skip entries with no usable rate rather than caching a broken one
          rateMap.set(key, {
            from: r.from_currency || r.from,
            to: r.to_currency || r.to,
            rate,
            change: r.change,
          });
        });
        setLiveRates(rateMap);
      }
    } catch (e) {
      console.log("Failed to load live rates:", e);
    } finally {
      // Mark the attempt complete regardless of outcome — success, empty
      // response, or error — so the UI can stop showing an indefinite
      // spinner and instead show "rate unavailable" once it's clear no
      // rate is actually coming for a given pair.
      setLiveRatesFetchAttempted(true);
    }
  }, []);

  useEffect(() => {
    loadCurrencies();
    loadAlerts();
  }, [loadCurrencies, loadAlerts]);

  // Generate popular pairs from enabled currencies dynamically
  const popularPairs: CurrencyPair[] = useMemo(() => {
    if (currencies.length < 2) return [];

    const enabledCodes = currencies.map((c) => c.code.toUpperCase());
    const pairs: CurrencyPair[] = [];

    // Create pairs prioritizing common base currencies (USD, GBP, EUR)
    const priorityBases = ["USD", "GBP", "EUR", "CAD"];
    const targets = enabledCodes.filter((c) => !priorityBases.includes(c));

    // First: Priority base -> Other enabled currencies
    for (const base of priorityBases) {
      if (!enabledCodes.includes(base)) continue;
      for (const target of targets) {
        if (pairs.length >= 8) break;
        pairs.push({
          from: base,
          to: target,
          fromFlag: getFlagForCurrency(base),
          toFlag: getFlagForCurrency(target),
        });
      }
      if (pairs.length >= 8) break;
    }

    // Then: Pairs between priority bases
    for (let i = 0; i < priorityBases.length && pairs.length < 10; i++) {
      for (let j = i + 1; j < priorityBases.length && pairs.length < 10; j++) {
        const from = priorityBases[i];
        const to = priorityBases[j];
        if (enabledCodes.includes(from) && enabledCodes.includes(to)) {
          pairs.push({
            from,
            to,
            fromFlag: getFlagForCurrency(from),
            toFlag: getFlagForCurrency(to),
          });
        }
      }
    }

    return pairs.slice(0, 10); // Limit to 10 pairs
  }, [currencies, getFlagForCurrency]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCurrencies();
    loadAlerts();
    const fromQuickCreate = popularPairs.map((p) => ({ from: p.from, to: p.to }));
    const fromSavedAlerts = alerts.map((a) => ({ from: a.from_currency, to: a.to_currency }));
    const allPairs = [...fromQuickCreate, ...fromSavedAlerts];
    if (allPairs.length > 0) loadLiveRates(allPairs as Array<{ from: string; to: string }>);
  }, [loadCurrencies, loadAlerts, popularPairs, alerts, loadLiveRates]);

  // Fetch live rates once we actually have real pairs to ask for — both the
  // quick-create grid's pairs and whatever the user has already saved as
  // alerts, since AlertCard also looks up a live rate by the same key.
  useEffect(() => {
    const fromQuickCreate = popularPairs.map((p) => ({ from: p.from, to: p.to }));
    const fromSavedAlerts = alerts.map((a) => ({ from: a.from_currency, to: a.to_currency }));
    const allPairs = [...fromQuickCreate, ...fromSavedAlerts];
    if (allPairs.length > 0) {
      loadLiveRates(allPairs as Array<{ from: string; to: string }>);
    }
  }, [popularPairs, alerts, loadLiveRates]);

  const handleToggleAlert = async (alert: RateAlert) => {
    const res = await updateRateAlert(alert.id as any, { is_active: !alert.is_active });
    if (res.success) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, is_active: !a.is_active } : a))
      );
    }
  };

  const handleDeleteAlert = (alert: RateAlert) => {
    Alert.alert("Delete Alert", `Remove alert for ${alert.from_currency}/${alert.to_currency}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await deleteRateAlert(alert.id as any);
          if (res.success) {
            setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
          }
        },
      },
    ]);
  };

  const openCreateSheet = async (pair: CurrencyPair) => {
    const key = `${pair.from}-${pair.to}`;
    const cached = liveRates.get(key);

    if (cached) {
      setSelectedPair({ from: pair.from, to: pair.to, fromFlag: pair.fromFlag, toFlag: pair.toFlag, rate: cached.rate });
      setSheetOpen(true);
      return;
    }

    // Not cached — this is the normal case for a custom pair (the cache is
    // only pre-populated from the quick-create grid + existing alerts), and
    // can also happen if you tap a quick-create card before its own fetch
    // resolves. Either way, fetch this specific pair's rate directly rather
    // than opening the sheet with a made-up rate of 1 — that's exactly what
    // was producing "1 USD = 1 NGN" for any pair that wasn't already cached.
    setFetchingRate(true);
    try {
      const res = await getExchangeRates(key);
      const found = res?.rates?.find((r: any) => (r.from_currency || r.from) === pair.from && (r.to_currency || r.to) === pair.to);
      const rawRate = found?.rate;
      const rate = typeof rawRate === "number" ? rawRate : typeof rawRate === "string" && !isNaN(Number(rawRate)) ? Number(rawRate) : undefined;

      if (rate === undefined) {
        Alert.alert("Rate unavailable", `We couldn't get a live rate for ${pair.from}/${pair.to} right now. Please try again shortly.`);
        return;
      }

      // Cache it so the quick-create grid and any future taps reflect it too.
      setLiveRates((prev) => new Map(prev).set(key, { from: pair.from, to: pair.to, rate }));
      setSelectedPair({ from: pair.from, to: pair.to, fromFlag: pair.fromFlag, toFlag: pair.toFlag, rate });
      setSheetOpen(true);
    } catch {
      Alert.alert("Rate unavailable", `We couldn't get a live rate for ${pair.from}/${pair.to} right now. Please try again shortly.`);
    } finally {
      setFetchingRate(false);
    }
  };

  const openCustomPicker = () => {
    setCustomFrom(null);
    setCustomTo(null);
    setPickerStep("from");
    setPickerOpen(true);
  };

  const handlePickCurrency = (code: string) => {
    if (pickerStep === "from") {
      setCustomFrom(code);
      setPickerStep("to");
      return;
    }
    // picking "to" — finalize and open the create sheet, same path the
    // quick-create cards use, so behavior stays identical either way.
    if (!customFrom) return;
    setPickerOpen(false);
    openCreateSheet({
      from: customFrom,
      to: code,
      fromFlag: getFlagForCurrency(customFrom),
      toFlag: getFlagForCurrency(code),
    });
  };

  const handleAlertCreated = () => {
    loadAlerts();
  };

  // Filter and sort alerts
  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.is_active),
    [alerts]
  );

  const historyAlerts = useMemo(
    () =>
      alerts
        .filter((a) => !a.is_active || (a.trigger_count ?? 0) > 0)
        .sort((a, b) => {
          const dateA = a.triggered_at ? new Date(a.triggered_at).getTime() : 0;
          const dateB = b.triggered_at ? new Date(b.triggered_at).getTime() : 0;
          return dateB - dateA;
        }),
    [alerts]
  );

  const filteredAlerts = useMemo(() => {
    const list = activeTab === "active" ? activeAlerts : historyAlerts;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (a) =>
        (a.from_currency ?? "").toLowerCase().includes(q) ||
        (a.to_currency ?? "").toLowerCase().includes(q)
    );
  }, [activeTab, activeAlerts, historyAlerts, searchQuery]);

  const getLiveRateForAlert = (alert: RateAlert) => {
    const key = `${alert.from_currency}-${alert.to_currency}`;
    return liveRates.get(key);
  };

  return (
    <ScreenShell padded={false} scrollable={false}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <AppText style={styles.headerTitle}>Rate Alerts</AppText>
            {/* <AppText style={styles.subtitle}>
                {alerts.length} alert{alerts.length !== 1 ? "s" : ""} • {activeAlerts.length} active
              </AppText> */}
          </View>
        </View>

        {/* Quick Create Section */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={localStyles.sectionLabel}>Quick Create Alert</AppText>
            <Pressable
              onPress={openCustomPicker}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
            >
              <Ionicons name="add" size={20} color={COLORS.primary} style={{ marginRight: 4 }} />
              <AppText style={{ fontSize: 16, fontWeight: "600", color: COLORS.primary }}>Custom pair</AppText>
            </Pressable>
          </View>
          {popularPairs.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <AppText style={{ color: COLORS.muted, marginTop: 8, fontSize: 12 }}>
                Loading currencies...
              </AppText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
            >
              {popularPairs.map((pair, idx) => {
                const key = `${pair.from}-${pair.to}`;
                const liveRate = liveRates.get(key);
                const isPositive = (liveRate?.change || "").startsWith("+");

                return (
                  <Pressable
                    key={idx}
                    onPress={() => openCreateSheet(pair)}
                    disabled={fetchingRate}
                    style={[localStyles.quickPairCard, fetchingRate && { opacity: 0.6 }]}
                  >
                    <View style={localStyles.quickPairFlags}>
                      <CountryFlag currencyCode={pair.from} fallbackEmoji={pair.fromFlag} size="sm" />
                      <AppText style={{ fontSize: 12, marginHorizontal: 4, color: COLORS.muted }}>→</AppText>
                      <CountryFlag currencyCode={pair.to} fallbackEmoji={pair.toFlag} size="sm" />
                    </View>
                    <AppText style={localStyles.quickPairCode}>
                      {pair.from}/{pair.to}
                    </AppText>
                    {liveRate ? (
                      <AppText style={localStyles.quickPairRate}>
                        {liveRate.rate.toFixed(4)}
                      </AppText>
                    ) : liveRatesFetchAttempted ? (
                      <AppText style={[localStyles.quickPairRate, { color: COLORS.muted, fontSize: 11 }]}>
                        Unavailable
                      </AppText>
                    ) : (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    )}
                    {liveRate?.change && (
                      <View
                        style={[
                          localStyles.changePill,
                          { backgroundColor: isPositive ? COLORS.greenLight : COLORS.errorLight },
                        ]}
                      >
                        <AppText
                          style={[
                            localStyles.changeText,
                            { color: isPositive ? COLORS.primary : COLORS.error },
                          ]}
                        >
                          {liveRate.change}
                        </AppText>
                      </View>
                    )}
                    <View style={localStyles.addBadge}>
                      <AppText style={{ color: COLORS.primary, fontWeight: "600", fontSize: 16 }}>+</AppText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Search & Tabs */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <View style={localStyles.searchContainer}>
            <Ionicons name="search-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
            <AppTextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by currency..."
              placeholderTextColor={COLORS.muted}
              style={localStyles.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <AppText style={{ fontSize: 16, color: COLORS.muted }}>✕</AppText>
              </Pressable>
            )}
          </View>

          {/* Tab Selector */}
          <View style={localStyles.tabContainer}>
            <Pressable
              onPress={() => setActiveTab("active")}
              style={[
                localStyles.tab,
                activeTab === "active" && localStyles.tabActive,
              ]}
            >
              <AppText
                style={[
                  localStyles.tabText,
                  activeTab === "active" && localStyles.tabTextActive,
                ]}
              >
                Active ({activeAlerts.length})
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("history")}
              style={[
                localStyles.tab,
                activeTab === "history" && localStyles.tabActive,
              ]}
            >
              <AppText
                style={[
                  localStyles.tabText,
                  activeTab === "history" && localStyles.tabTextActive,
                ]}
              >
                History ({historyAlerts.length})
              </AppText>
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : filteredAlerts.length === 0 ? (
          <View style={localStyles.emptyState}>
            <View style={localStyles.emptyIcon}>
              <Ionicons name={activeTab === "active" ? "notifications-outline" : "stats-chart-outline"} size={36} color={COLORS.primary} />
            </View>
            <AppText style={localStyles.emptyTitle}>
              {activeTab === "active" ? "No active alerts" : "No alert history"}
            </AppText>
            <AppText style={localStyles.emptySubtitle}>
              {activeTab === "active"
                ? "Tap a currency pair above to create your first alert"
                : "Triggered alerts will appear here"}
            </AppText>
            {activeTab === "active" && (
              <Pressable
                onPress={() => router.push("/exchangerates")}
                style={localStyles.emptyButton}
              >
                <AppText style={{ color: COLORS.actionText, fontWeight: "600" }}>Browse All Rates</AppText>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            {filteredAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                liveRate={getLiveRateForAlert(alert)}
                onToggle={() => handleToggleAlert(alert)}
                onDelete={() => handleDeleteAlert(alert)}
                showHistory={activeTab === "history"}
                fromFlag={getFlagForCurrency(alert.from_currency || "")}
                toFlag={getFlagForCurrency(alert.to_currency || "")}
                isHighlighted={highlightedId === String(alert.id)}
              />
            ))}
          </View>
        )}

        {/* Stats Summary */}
        {/* {alerts.length > 0 && (
            <View style={localStyles.statsContainer}>
              <View style={localStyles.statBox}>
                <AppText style={localStyles.statValue}>{alerts.length}</AppText>
                <AppText style={localStyles.statLabel}>Total Alerts</AppText>
              </View>
              <View style={localStyles.statBox}>
                <AppText style={[localStyles.statValue, { color: COLORS.primary }]}>
                  {activeAlerts.length}
                </AppText>
                <AppText style={localStyles.statLabel}>Active</AppText>
              </View>
              <View style={localStyles.statBox}>
                <AppText style={[localStyles.statValue, { color: COLORS.accent }]}>
                  {alerts.reduce((sum, a) => sum + a.triggerCount, 0)}
                </AppText>
                <AppText style={localStyles.statLabel}>Triggered</AppText>
              </View>
            </View>
          )} */}
      </ScrollView>

      {/* Floating Create Button */}
      <Pressable
        onPress={() => router.push("/exchangerates")}
        style={localStyles.fab}
      >
        <AppText style={{ color: COLORS.actionText, fontSize: 24, fontWeight: "600" }}>+</AppText>
      </Pressable>

      {/* Create Alert Sheet */}
      {selectedPair && (
        <CreateRateAlertSheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            setSelectedPair(null);
          }}
          fromCurrency={selectedPair.from}
          toCurrency={selectedPair.to}
          currentRate={selectedPair.rate}
          fromFlag={selectedPair.fromFlag}
          toFlag={selectedPair.toFlag}
          onSuccess={handleAlertCreated}
        />
      )}

      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={pickerStep === "from" ? "Alert when this currency…" : `…compared to ${customFrom}`}
      >
        {currencies
          .filter((c) => pickerStep === "to" ? c.code.toUpperCase() !== customFrom : true)
          .map((c) => {
            const code = c.code.toUpperCase();
            return (
              <Pressable
                key={code}
                onPress={() => handlePickCurrency(code)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  // borderBottomWidth: 1,
                  // borderBottomColor: COLORS.borderLight,
                }}
              >
                <View style={{ marginRight: 12 }}>
                  <CountryFlag currencyCode={code} fallbackEmoji={getFlagForCurrency(code)} size="ms" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: "600", color: COLORS.text }}>{code}</AppText>
                  {!!c.name && <AppText style={{ fontSize: 12, color: COLORS.muted }}>{c.name}</AppText>}
                </View>
              </Pressable>
            );
          })}
      </BottomSheet>

      {fetchingRate && (
        <View
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.15)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 24, alignItems: "center" }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <AppText style={{ marginTop: 8, fontSize: 13, color: COLORS.muted, fontWeight: "600" }}>Fetching live rate…</AppText>
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

// Enhanced Alert Card Component
function AlertCard({
  alert,
  liveRate,
  onToggle,
  onDelete,
  showHistory,
  fromFlag,
  toFlag,
  isHighlighted,
}: {
  alert: RateAlert;
  liveRate?: LiveRate;
  onToggle: () => void;
  onDelete: () => void;
  showHistory: boolean;
  fromFlag: string;
  toFlag: string;
  isHighlighted?: boolean;
}) {
  const directionIcon = alert.direction === "above" ? "trending-up" : "trending-down";
  const directionText = alert.direction === "above" ? "Above" : "Below";
  const currentRate = liveRate?.rate;

  // Calculate distance to target (guard against undefined target_rate)
  const distancePercent =
    currentRate && typeof alert.target_rate === "number"
      ? (((alert.target_rate - currentRate) / currentRate) * 100).toFixed(2)
      : null;
  const isClose =
    distancePercent !== null &&
    !Number.isNaN(parseFloat(distancePercent)) &&
    Math.abs(parseFloat(distancePercent)) < 2;

  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });
    return (
      <Animated.View style={{ transform: [{ translateX }], justifyContent: "center" }}>
        <Pressable
          onPress={() => {
            swipeableRef.current?.close();
            onDelete();
          }}
          style={localStyles.swipeDeleteAction}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <AppText style={localStyles.swipeDeleteText}>Delete</AppText>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      <View style={[localStyles.alertCard,
      !alert.is_active && localStyles.alertCardInactive,
      isHighlighted && localStyles.alertCardHighlighted,
      ]}>
        {/* Header Row */}
        <View style={localStyles.alertHeader}>
          <View style={localStyles.alertPair}>
            <View style={{ flexDirection: "row", marginRight: 8 }}>
              <CountryFlag currencyCode={alert.from_currency} fallbackEmoji={fromFlag} size="sm" />
              <CountryFlag currencyCode={alert.to_currency} fallbackEmoji={toFlag} size="sm" style={{ marginLeft: -6, borderWidth: 1.5, borderColor: "#FFFFFF", borderRadius: 999 }} />
            </View>
            <View>
              <AppText style={localStyles.alertPairText}>
                {alert.from_currency}/{alert.to_currency}
              </AppText>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, flexWrap: "wrap", gap: 4 }}>
                <View style={[
                  localStyles.directionBadge,
                  { backgroundColor: alert.direction === "above" ? COLORS.greenLight : COLORS.errorLight }
                ]}>
                  <Ionicons
                    name={directionIcon as any}
                    size={13}
                    color={alert.direction === "above" ? COLORS.text : COLORS.error}
                    style={{ marginRight: 4 }}
                  />
                  <AppText style={[
                    localStyles.directionText,
                    { color: alert.direction === "above" ? COLORS.text : COLORS.error }
                  ]}>
                    {directionText}
                  </AppText>
                </View>
                {alert.is_recurring && (
                  <View style={localStyles.recurringBadge}>
                    <Ionicons name="repeat" size={12} color={COLORS.primary} style={{ marginRight: 3 }} />
                    <AppText style={localStyles.recurringText}>RECURRING</AppText>
                  </View>
                )}
                {isClose && alert.is_active && (
                  <View style={localStyles.closeBadge}>
                    <Ionicons name="flash" size={11} color={COLORS.error} style={{ marginRight: 3 }} />
                    <AppText style={localStyles.closeText}>CLOSE</AppText>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Toggle Switch */}
          <Pressable onPress={onToggle} style={localStyles.toggleContainer}>
            <View
              style={[
                localStyles.toggle,
                { backgroundColor: alert.is_active ? COLORS.primary : COLORS.border },
              ]}
            >
              <View
                style={[
                  localStyles.toggleThumb,
                  { alignSelf: alert.is_active ? "flex-end" : "flex-start" },
                ]}
              />
            </View>
          </Pressable>
        </View>

        {/* Rate Info */}
        <View style={localStyles.rateInfoContainer}>
          <View style={localStyles.rateInfoBox}>
            <AppText style={localStyles.rateLabel}>Target Rate</AppText>
            <AppText style={localStyles.rateValue}>
              {directionText} {typeof alert.target_rate === "number" ? alert.target_rate.toFixed(4) : "—"}
            </AppText>
          </View>
          {currentRate && (
            <View style={localStyles.rateInfoBox}>
              <AppText style={localStyles.rateLabel}>Current Rate</AppText>
              <AppText style={localStyles.rateValue}>{currentRate.toFixed(4)}</AppText>
            </View>
          )}
          {distancePercent && (
            <View style={localStyles.rateInfoBox}>
              <AppText style={localStyles.rateLabel}>Distance</AppText>
              <AppText
                style={[
                  localStyles.rateValue,
                  {
                    color: parseFloat(distancePercent) > 0 ? COLORS.primary : COLORS.error,
                  },
                ]}
              >
                {parseFloat(distancePercent) > 0 ? "+" : ""}
                {distancePercent}%
              </AppText>
            </View>
          )}
        </View>

        {/* History Info */}
        {showHistory && (alert.trigger_count ?? 0) > 0 && (
          <View style={localStyles.historyInfo}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="notifications" size={13} color={COLORS.textSecondary} style={{ marginRight: 5 }} />
              <AppText style={localStyles.historyText}>
                Triggered {alert.trigger_count} time{(alert.trigger_count ?? 0) !== 1 ? "s" : ""}
              </AppText>
            </View>
            {alert.triggered_at && (
              <AppText style={localStyles.historyDate}>
                Last: {new Date(alert.triggered_at).toLocaleDateString()}
              </AppText>
            )}
          </View>
        )}

        {/* Swipe hint */}
        <View style={localStyles.alertActions}>
          <Ionicons name="chevron-back-outline" size={12} color={COLORS.muted} />
          <AppText style={localStyles.swipeHintText}>Swipe left to delete</AppText>
        </View>
      </View>
    </Swipeable>
  );
}

const localStyles = {
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  quickPairCard: {
    width: 120,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center" as const,
    position: "relative" as const,
  },
  quickPairFlags: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 8,
  },
  quickPairCode: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: COLORS.text,
    marginBottom: 4,
  },
  quickPairRate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600" as const,
  },
  changePill: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  addBadge: {
    position: "absolute" as const,
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(46, 158, 106, 0.15)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 2,
    borderColor: "#fff",
  },
  searchContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  tabContainer: {
    flexDirection: "row" as const,
    marginTop: 16,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center" as const,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#fff",
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.1,
    // shadowRadius: 2,
    // elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: COLORS.muted,
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: "600" as const,
  },
  emptyState: {
    padding: 40,
    alignItems: "center" as const,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.bgTertiary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: COLORS.muted,
    textAlign: "center" as const,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  emptyButton: {
    backgroundColor: COLORS.actionBg,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  alertCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  alertCardInactive: {
    opacity: 0.6,
    backgroundColor: COLORS.bgTertiary,
  },
  alertCardHighlighted: {
    borderColor: COLORS.accent,
    borderWidth: 2,
    backgroundColor: COLORS.accentLight,
  },
  alertHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: 12,
  },
  alertPair: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  alertPairText: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: COLORS.text,
  },
  directionBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  directionText: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
  recurringBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(46, 158, 106, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recurringText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: COLORS.primary,
  },
  closeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  closeText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: COLORS.error,
  },
  toggleContainer: {
    padding: 4,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: "center" as const,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  rateInfoContainer: {
    flexDirection: "row" as const,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  rateInfoBox: {
    flex: 1,
  },
  rateLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 2,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  rateValue: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: COLORS.text,
  },
  historyInfo: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    marginBottom: 12,
  },
  historyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600" as const,
  },
  historyDate: {
    fontSize: 12,
    color: COLORS.muted,
  },
  alertActions: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingTop: 6,
    opacity: 0.6,
  },
  swipeHintText: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: COLORS.muted,
  },
  swipeDeleteAction: {
    width: 80,
    height: "100%" as const,
    backgroundColor: COLORS.error,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 16,
    gap: 4,
  },
  swipeDeleteText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  statsContainer: {
    flexDirection: "row" as const,
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 16,
    padding: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center" as const,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "600" as const,
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  fab: {
    position: "absolute" as const,
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.actionBg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};
