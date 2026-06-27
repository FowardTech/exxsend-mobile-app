import { getCountries, getExchangeRates, getUserAccounts } from "@/api/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import CountryFlag from "../../../components/CountryFlag";
import { COLORS } from "../../../theme/colors";
import { styles } from "../../../theme/styles";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";
import ScreenShell from "../../ScreenShell";

type Country = {
  code: string;
  name: string;
  flag?: string;
  currencyCode?: string;
  currencyEnabled?: boolean;
};

type UserAccount = {
  id: string;
  currencyCode: string;
  accountName: string;
  balance?: number | null;
  status?: string;
};

type DisplayRate = {
  from: string;
  to: string;
  fromFlag: string;
  toFlag: string;
  rate: string;
  numericRate: number;
  change?: string;
};

function buildPairs(codes: string[]) {
  const uniq = Array.from(
    new Set(codes.map((c) => c.toUpperCase().trim()).filter(Boolean))
  );
  const pairs: string[] = [];
  for (const from of uniq) {
    for (const to of uniq) {
      if (from !== to) pairs.push(`${from}_${to}`);
    }
  }
  return pairs;
}

const currencyToCountry: Record<string, string> = {
  USD: "US",
  AUD: "AU",
  GBP: "GB",
  EUR: "EU",
  CAD: "CA",
  NGN: "NG",
};

const fallbackEmoji: Record<string, string> = {
  USD: "🇺🇸",
  CAD: "🇨🇦",
  GBP: "🇬🇧",
  EUR: "🇪🇺",
  NGN: "🇳🇬",
  GHS: "🇬🇭",
  KES: "🇰🇪",
  RWF: "🇷🇼",
  UGX: "🇺🇬",
  TZS: "🇹🇿",
  ZMW: "🇿🇲",
  XOF: "🇸🇳",
  XAF: "🇨🇲",
  ZAR: "🇿🇦",
  EGP: "🇪🇬",
  MAD: "🇲🇦",
  AED: "🇦🇪",
  INR: "🇮🇳",
  JPY: "🇯🇵",
  CNY: "🇨🇳",
  NZD: "🇳🇿",
  CHF: "🇨🇭",
  SGD: "🇸🇬",
  HKD: "🇭🇰",
  MXN: "🇲🇽",
  BRL: "🇧🇷",
};

function resolveFlag(flagsByKey: Record<string, string>, code: string) {
  const key = (code || "").toUpperCase().trim();
  if (!key) return "";
  if (flagsByKey[key]) return flagsByKey[key];
  const ck = currencyToCountry[key];
  if (ck && flagsByKey[ck]) return flagsByKey[ck];
  return fallbackEmoji[key] || "";
}

export default function ExchangeRatesScreen() {
  const router = useRouter();
  const isInitialMount = useRef(true);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [flagsByKey, setFlagsByKey] = useState<Record<string, string>>({});
  const [disabledCurrencies, setDisabledCurrencies] = useState<Record<string, true>>({});

  const [rates, setRates] = useState<DisplayRate[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<string>("");

  const getFlagForCurrency = useCallback(
    (currencyCode?: string) => resolveFlag(flagsByKey, currencyCode || ""),
    [flagsByKey]
  );

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        // --------- 1) FLAGS + DISABLED MAPS ----------
        let flagsMap = flagsByKey;
        let disabledMap = disabledCurrencies;

        const shouldLoadFlags = isRefresh || Object.keys(flagsByKey).length === 0;
        if (shouldLoadFlags) {
          try {
            const countries: Country[] = await getCountries();
            const fm: Record<string, string> = {};
            const dm: Record<string, true> = {};

            for (const c of countries || []) {
              const flag = (c.flag || "").trim();
              const cur = (c.currencyCode || "").toUpperCase().trim();
              const code = (c.code || "").toUpperCase().trim();

              if (cur && flag && !fm[cur]) fm[cur] = flag;
              if (code && flag && !fm[code]) fm[code] = flag;

              if (cur && c.currencyEnabled === false) dm[cur] = true;
              if (code && c.currencyEnabled === false) dm[code] = true;
            }

            flagsMap = fm;
            disabledMap = dm;

            setFlagsByKey(fm);
            setDisabledCurrencies(dm);
          } catch (e) {
            console.log("Failed to load flags:", e);
            // keep existing maps if any
          }
        }

        // --------- 2) ACCOUNTS ----------
        const phone = await AsyncStorage.getItem("user_phone");
        let userAccounts: UserAccount[] = [];

        if (phone) {
          try {
            const res = await getUserAccounts(phone, true);
            if (res?.success && Array.isArray(res.accounts)) {
              userAccounts = res.accounts.map((a: any) => ({
                ...a,
                currencyCode: String(a.currencyCode || a.currency_code || "").toUpperCase().trim(),
              }));
              setAccounts(userAccounts);
            } else {
              // keep existing accounts if fetch fails
              userAccounts = accounts;
            }
          } catch (e) {
            console.log("Failed to load accounts:", e);
            userAccounts = accounts;
          }
        } else {
          userAccounts = accounts;
        }

        // --------- 3) ENABLED CURRENCY CODES ----------
        const enabled = userAccounts
          .map((a) => (a.currencyCode || "").toUpperCase().trim())
          .filter(Boolean)
          .filter((c) => !disabledMap[c]);

        // choose default base currency once
        if (!baseCurrency && enabled.length > 0) {
          setBaseCurrency(enabled[0]);
        }

        const pairs = buildPairs(enabled);

        if (pairs.length === 0) {
          setRates([]);
          return;
        }

        // --------- 4) RATES ----------
        const res = await getExchangeRates(pairs.join(","));

        if (res?.success && Array.isArray(res.rates)) {
          const formatted: DisplayRate[] = res.rates
            .map((r: any) => {
              const from = String(r.fromCurrency || r.buy_currency || "").toUpperCase().trim();
              const to = String(r.toCurrency || r.sell_currency || "").toUpperCase().trim();
              const numericRate = Number.parseFloat(r.rate || r.core_rate);

              if (!from || !to || !Number.isFinite(numericRate)) return null;

              const changeVal =
                r.change ??
                (r.changePercent != null
                  ? `${Number(r.changePercent) >= 0 ? "+" : ""}${Number(r.changePercent).toFixed(2)}%`
                  : "+0.0%");

              return {
                from,
                to,
                fromFlag: resolveFlag(flagsMap, from),
                toFlag: resolveFlag(flagsMap, to),
                numericRate,
                rate: numericRate.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                }),
                change: changeVal,
              } as DisplayRate;
            })
            .filter(Boolean) as DisplayRate[];

          setRates(formatted);
        } else {
          setRates([]);
        }
      } catch (e) {
        console.log("Failed to load exchange rates:", e);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    // ✅ keep deps minimal but correct
    [accounts, baseCurrency, disabledCurrencies, flagsByKey]
  );

  // Initial load
  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;
    loadData(false);
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const baseCurrencies = useMemo(() => {
    const list = accounts
      .map((a) => (a.currencyCode || "").toUpperCase().trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [accounts]);

  const visibleRates = useMemo(() => {
    const q = query.trim().toUpperCase();
    let list = rates;

    if (baseCurrency) {
      const top = list.filter((r) => r.from === baseCurrency);
      const rest = list.filter((r) => r.from !== baseCurrency);
      list = [...top, ...rest];
    }

    if (!q) return list;

    return list.filter((r) => {
      const pair = `${r.from} ${r.to}`.toUpperCase();
      return pair.includes(q);
    });
  }, [rates, query, baseCurrency]);

  return (
    <ScreenShell padded={false} scrollable={false}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />

          <View style={{ flex: 1 }}>
            <AppText style={styles.headerTitle}>Exchange Rates</AppText>

          </View>

          <View style={styles.helpCircle}>
            <AppText style={styles.helpCircleText} onPress={() => router.push('/chatsupport')}>?</AppText>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <AppText style={styles.searchIcon}>⌕</AppText>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search currency pair (e.g. USD, USD→NGN)"
            placeholderTextColor="#9CA3AF"

            autoCapitalize="characters"
          />
        </View>

        {/* Base currency pills */}
        {baseCurrencies.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10 }}
          >
            {baseCurrencies.map((c) => {
              const active = c === baseCurrency;
              return (
                <Pressable
                  key={c}
                  onPress={() => setBaseCurrency(c)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    marginRight: 10,
                    backgroundColor: active ? "rgba(14,165,233,0.12)" : "#ffffff",
                    borderWidth: 1,
                    borderColor: active ? "rgba(14,165,233,0.25)" : "#E5E7EB",
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <CountryFlag currencyCode={c} size="sm" style={{ marginRight: 6 }} />
                  <AppText style={{ fontWeight: "600", color: active ? COLORS.primary : "#111827", fontSize: 12 }}>
                    {c}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Rates Card */}
        <View style={[styles.fxCard, { marginTop: 14 }]}>

          <View style={styles.fxHeader}>
            <View>
              <AppText style={styles.fxTitle}>All rates</AppText>
              <AppText style={styles.fxSubtitle}>
                Showing {visibleRates.length} pair{visibleRates.length === 1 ? "" : "s"}
              </AppText>
              <AppText style={styles.subtitle}>Mid-market • updates frequently</AppText>
            </View>

            <Pressable onPress={onRefresh} disabled={refreshing}>
              <AppText style={styles.fxSeeAll}>{refreshing ? "Refreshing..." : "Refresh"}</AppText>
            </Pressable>
          </View>

          <View style={styles.fxDivider} />

          {initialLoading ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <AppText style={{ marginTop: 10, color: "#9CA3AF", fontWeight: "600" }}>Loading rates…</AppText>
            </View>
          ) : accounts.length < 2 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <AppText style={{ color: "#888", fontSize: 14, textAlign: "center" }}>
                Add at least two currency accounts to see exchange rates between them.
              </AppText>
            </View>
          ) : visibleRates.length === 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <AppText style={{ color: "#9CA3AF", fontWeight: "600" }}>No matching rates</AppText>
            </View>
          ) : (
            visibleRates.map((x, idx) => {
              const isPositive = String(x.change || "").trim().startsWith("+");
              return (
                <Pressable
                  key={`${x.from}-${x.to}-${idx}`}
                  style={[styles.fxRow, idx === visibleRates.length - 1 ? { paddingBottom: 14 } : null]}
                  onPress={() => router.push(`/convert?from=${x.from}&to=${x.to}`)}
                >
                  <View style={styles.fxLeft}>
                    <View style={styles.fxFlags}>
                      <CountryFlag currencyCode={x.from} size="md" />
                      <CountryFlag currencyCode={x.to} size="md" style={{ marginLeft: -8, borderWidth: 1.5, borderColor: "#FFFFFF", borderRadius: 999 }} />
                    </View>

                    <View>
                      <AppText style={styles.fxPair}>
                        {x.from} → {x.to}
                      </AppText>
                      <AppText style={styles.fxPairSub}>
                        1 {x.from} = {x.rate} {x.to}
                      </AppText>
                    </View>
                  </View>

                  <View style={styles.fxRight}>
                    <View style={[styles.fxChangePill, isPositive ? styles.fxUp : styles.fxDown]}>
                      <AppText style={[styles.fxChangeText, isPositive ? styles.fxUpText : styles.fxDownText]}>
                        {x.change || "+0.0%"}
                      </AppText>
                    </View>
                    <AppText style={styles.fxChevron}>›</AppText>
                  </View>
                </Pressable>
              );
            })
          )}

          {!initialLoading && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <AppText style={styles.fxFooterText}>Last updated: just now</AppText>
            </View>
          )}
        </View>

        {/* Quick action */}
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <Pressable onPress={() => router.push("/convert")} style={[styles.primaryBtn]}>
            <AppText style={{ color: COLORS.white, fontWeight: "600", fontSize: 16 }}>Convert currency</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
