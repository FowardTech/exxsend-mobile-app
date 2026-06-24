import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import ScreenShell from "../../../components/ScreenShell";
import { useStyles } from "../../../theme/styles";
import { useOtherStyles } from "../../../theme/otherstyles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { isFlutterwaveCurrency, COUNTRY_NAMES, CURRENCY_TO_COUNTRY } from "../../../api/flutterwave";
import { getCorridorOrFallback } from "../../../api/corridors";
import { getRecentRecipientsFromDB, RecentRecipientFromDB } from "@/api/sync";

export interface SavedRecipient {
  id: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  countryCode: string;
  createdAt: number;
}

// normalize expo-router param: string | string[] | undefined -> string
function asString(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function getInitials(name: string) {
  const safe = String(name || "").trim();
  if (!safe) return "U";
  return safe
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

// ✅ Normalize DB/API responses into an array safely (handles null too)
function normalizeRecipients(input: unknown): RecentRecipientFromDB[] {
  if (Array.isArray(input)) return input as RecentRecipientFromDB[];

  if (input && typeof input === "object") {
    const obj = input as any;
    if (Array.isArray(obj.recipients)) return obj.recipients as RecentRecipientFromDB[];
    if (Array.isArray(obj.data)) return obj.data as RecentRecipientFromDB[];
    if (Array.isArray(obj.items)) return obj.items as RecentRecipientFromDB[];
  }

  return [];
}

// ✅ Safe currency getter (in case backend uses different field names)
function getRecipientCurrency(r: any): string {
  const cur = r?.destCurrency ?? r?.currency ?? r?.toCurrency;
  return typeof cur === "string" ? cur.toUpperCase().trim() : "";
}

// ✅ detect Interac recipient (supports multiple backend shapes)
function isInteracRecipient(r: any): boolean {
  // could be boolean true, "true", 1, or recipientType === "interac"
  const v = r?.isInterac ?? r?.interac ?? r?.is_interac;
  if (v === true || v === 1 || v === "1" || v === "true") return true;
  const t = String(r?.type || r?.recipientType || r?.channel || "").toLowerCase();
  return t === "interac" || t === "etransfer" || t === "e-transfer";
}

export default function RecipientSelectScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles();
  const otherstyles = useOtherStyles();
  const raw = useLocalSearchParams<{
    destCurrency?: string | string[];
    fromWalletId?: string | string[];
    fromCurrency?: string | string[];
    fromAmount?: string | string[];
    toAmount?: string | string[];
    rate?: string | string[];
  }>();

  // ✅ build a SAFE plain object for navigation
  const navParams = useMemo(() => {
    return {
      destCurrency: asString(raw.destCurrency),
      fromWalletId: asString(raw.fromWalletId),
      fromCurrency: asString(raw.fromCurrency),
      fromAmount: asString(raw.fromAmount),
      toAmount: asString(raw.toAmount),
      rate: asString(raw.rate),
    };
  }, [raw.destCurrency, raw.fromWalletId, raw.fromCurrency, raw.fromAmount, raw.toAmount, raw.rate]);

  const destCurrency = (navParams.destCurrency || "NGN").toUpperCase().trim();

  // ✅ Interac support
  const isInterac = destCurrency === "CAD";
  // ✅ Flutterwave exotic-currency support (NGN/GHS/KES/...)
  const isFlutterwave = !isInterac && isFlutterwaveCurrency(destCurrency);
  // ✅ CurrencyCloud support: either a known corridor (USD/GBP/AUD/EUR/...) or a
  // generic bank-transfer fallback for any other currency the admin has activated.
  // The "Send to" picker (getPayoutDestinations) is the actual activation gate —
  // by the time a currency reaches this screen, the backend already vetted it, so
  // we never hard-block here just because this client doesn't have a specific
  // corridor definition for it yet (e.g. a newly-activated currency like PHP).
  const isCurrencyCloud = !isInterac && !isFlutterwave;
  const resolvedCorridor = isCurrencyCloud
    ? getCorridorOrFallback(destCurrency)
    : undefined;
  const countryCode = isInterac
    ? "CA"
    : resolvedCorridor
      ? resolvedCorridor.countryCode
      : (CURRENCY_TO_COUNTRY[destCurrency] || "NG").toUpperCase();
  const countryName = isInterac
    ? "Canada"
    : resolvedCorridor
      ? resolvedCorridor.countryName
      : (COUNTRY_NAMES[countryCode] || countryCode);

  // Every admin-activated currency is supported by construction now — the
  // picker already enforces activation, so there's nothing left to block here.
  const isSupportedDest = true;

  const [search, setSearch] = useState("");

  // ✅ Use ONE loading flag for this screen
  const [loadingSaved, setLoadingSaved] = useState(true);

  const [saved, setSaved] = useState<RecentRecipientFromDB[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoadingSaved(true);

    // If unsupported currency, don't fetch
    if (!isSupportedDest) {
      setSaved([]);
      setLoadingSaved(false);
      return;
    }

    (async () => {
      try {
        const phone = await AsyncStorage.getItem("user_phone");
        if (!phone || !mounted) {
          if (mounted) setSaved([]);
          return;
        }

        // ✅ Keep your same API call, then filter by currency (CAD will work if your DB stores CAD recipients)
        const rawRecipients = await getRecentRecipientsFromDB(phone);
        if (!mounted) return;

        const recipientsArr = normalizeRecipients(rawRecipients);

        const filteredByCurrency = recipientsArr.filter((r: any) => {
          const rCur = getRecipientCurrency(r);
          return rCur && rCur === destCurrency;
        });

        setSaved(filteredByCurrency);
      } catch (err) {
        console.error("Failed to load recipients from DB:", err);
        if (mounted) setSaved([]);
      } finally {
        if (mounted) setLoadingSaved(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [destCurrency, isSupportedDest]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return saved;

    return saved.filter((r: any) => {
      const name = String(r?.accountName || "").toLowerCase();
      const bank = String(r?.bankName || "").toLowerCase();
      const acct = String(r?.accountNumber || "");
      return name.includes(q) || bank.includes(q) || acct.includes(q);
    });
  }, [search, saved]);

  // ✅ Unsupported currency message (instead of spinner forever)
  if (!isSupportedDest) {
    return (
      <ScreenShell>
        <View style={otherstyles.centerState}>
          <AppText style={[otherstyles.centerStateText, { fontWeight: "700" }]}>Unsupported currency</AppText>
          <AppText style={[otherstyles.centerStateText, { marginTop: 6 }]}>
            Sending to {destCurrency} is not currently supported.
          </AppText>

          <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
            <AppText style={{ color: colors.primary, fontWeight: "700" }}>Go back</AppText>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell padded={false}>
      <View style={otherstyles.recipientSelectContainer}>
        {/* Header */}
        <View style={otherstyles.confirmHeader}>
          <BackButton onPress={() => router.back()} />

          <View style={otherstyles.confirmHeaderCenter}>
            <AppText style={otherstyles.confirmTitle}>Recipients</AppText>
            <AppText style={otherstyles.confirmSubtitle}>Send to {countryName}</AppText>
          </View>

          <Pressable style={styles.helpCircle}>
            <Ionicons name="help" size={16} color={colors.primary} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.inputBox, otherstyles.recipientSelectSearchWrap]}>
          <Ionicons name="search-outline" size={16} color={colors.muted} style={{ marginRight: 6 }} />
          <AppTextInput
            placeholder={isInterac ? "Search name or email" : "Search name, bank, or account number"}
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.textFieldInput}
            autoCapitalize="none"
          />
        </View>

        {/* Primary action */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/recipientnew" as any,
              params: {
                ...navParams,
                countryCode,
                countryName,
                // ✅ tell the new-recipient screen it's Interac flow (optional but helpful)
                ...(isInterac ? { isInterac: "true" } : {}),
              } as any,
            })
          }
          style={otherstyles.recipientSelectNewCard}
        >
          <View style={otherstyles.recipientSelectNewIconCircle}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <AppText style={otherstyles.recipientSelectNewTitle}>
              {isInterac ? "Send via Interac e-Transfer" : "New recipient"}
            </AppText>
            <AppText style={otherstyles.recipientSelectNewSub}>
              {isInterac ? "Add a Canadian Interac recipient" : `Add a ${countryName} bank recipient`}
            </AppText>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {/* Section title */}
        <View style={otherstyles.recipientSelectSectionRow}>
          <AppText style={otherstyles.recipientSelectSectionTitle}>
            {isInterac ? "Saved Interac recipients" : "Saved recipients"}
          </AppText>
          <AppText style={otherstyles.recipientSelectSectionCount}>{loadingSaved ? "" : `${filtered.length}`}</AppText>
        </View>

        {/* List */}
        <ScrollView
          contentContainerStyle={otherstyles.recipientSelectListContent}
          showsVerticalScrollIndicator={false}
        >
          {loadingSaved ? (
            <View style={otherstyles.centerState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <AppText style={otherstyles.centerStateText}>Loading recipients…</AppText>
            </View>
          ) : filtered.length === 0 ? (
            <View style={otherstyles.recipientSelectEmpty}>
              <Ionicons name="people-outline" size={32} color={colors.muted} />
              <AppText style={otherstyles.recipientSelectEmptyTitle}>
                {isInterac ? "No saved Interac recipients" : "No saved recipients"}
              </AppText>
              <AppText style={otherstyles.recipientSelectEmptySub}>
                Add a recipient to send money faster next time.
              </AppText>

              <Pressable
                style={otherstyles.recipientSelectEmptyBtn}
                onPress={() =>
                  router.push({
                    pathname: "/recipientnew" as any,
                    params: { ...navParams, countryCode, countryName, ...(isInterac ? { isInterac: "true" } : {}) } as any,
                  })
                }
              >
                <AppText style={otherstyles.recipientSelectEmptyBtnText}>
                  {isInterac ? "Add Interac recipient" : "Add recipient"}
                </AppText>
              </Pressable>
            </View>
          ) : (
            <View style={otherstyles.recipientSelectCard}>
              {filtered.map((r: any, idx: number) => (
                <View key={`${r?.id || ""}-${r?.bankCode || ""}-${r?.accountNumber || ""}-${idx}`}>
                  <Pressable
                    onPress={() => {
                      const rCurrency = getRecipientCurrency(r) || destCurrency;

                      // ✅ For CAD, always force CA
                      const cc = (rCurrency === "CAD"
                        ? "CA"
                        : (CURRENCY_TO_COUNTRY[rCurrency] || countryCode || "NG")
                      ).toUpperCase();

                      const interacFlag = isInteracRecipient(r) || rCurrency === "CAD";

                      router.push({
                        pathname: "/recipientconfirm" as any,
                        params: {
                          ...navParams,
                          recipient: JSON.stringify({
                            ...r,
                            destCurrency: rCurrency,
                            countryCode: cc,
                            // ✅ standardize this flag for your confirm screen
                            ...(interacFlag ? { isInterac: true } : {}),
                          }),
                          mode: "saved",
                        } as any,
                      });
                    }}
                    style={otherstyles.recipientSelectRow}
                  >
                    <View style={otherstyles.recipientSelectAvatarCircle}>
                      <AppText style={otherstyles.recipientSelectAvatarText}>{getInitials(r?.accountName)}</AppText>
                    </View>

                    <View style={otherstyles.recipientSelectRowInfo}>
                      <AppText style={otherstyles.recipientSelectRowName} numberOfLines={1}>
                        {r?.accountName || "Unknown"}
                      </AppText>

                      <AppText style={otherstyles.recipientSelectRowSub} numberOfLines={1}>
                        {isInterac
                          ? `Interac • ${String(r?.accountNumber || "—")}`
                          : `${r?.bankName || "—"} • ${String(r?.accountNumber || "—")}`}
                      </AppText>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>

                  {idx !== filtered.length - 1 && <View style={otherstyles.recipientSelectDivider} />}
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 18 }} />
        </ScrollView>
      </View>
    </ScreenShell>
  );
}
