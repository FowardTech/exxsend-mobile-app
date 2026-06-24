import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList, ScrollView, StyleSheet } from "react-native";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import NumericKeypad from "../../NumericKeypad";
import AppTextInput from "../../AppTextInput";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, router } from "expo-router";
import ScreenShell from "../../../components/ScreenShell";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import CurrencyPill from "../../../components/CurrencyPill";
import { Wallet } from "../../../components/CurrencyPickerModal"; // keep the type
import { useStyles } from "../../../theme/styles";
import { SPACE, RADIUS, TYPE, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "../../../theme/designSystem";
import {
  getUserWallets,
  getConversionQuote,
  getPayoutDestinations,
  PayoutDestination,
  calculateSendFee,
} from "../../../api/config";
import FeeBreakdown, { FeeInfo } from "../../../components/FeeBreakdown";
import CountryFlag from "../../../components/CountryFlag";
import { useAppTheme } from "@/theme/ThemeProvider";

// ------------------------------------------------------------
// Country code normalization (fixes your countryCode errors)
// ------------------------------------------------------------
const COUNTRY_CODE_BY_CURRENCY: Record<string, string> = {
  CAD: "CA",
  NGN: "NG",
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  KES: "KE",
  GHS: "GH",
  RWF: "RW",
};

function normalizeCountryCode(input?: unknown): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  const up = trimmed.toUpperCase();
  if (up.length === 2) return up;
  return COUNTRY_CODE_BY_CURRENCY[up] || "";
}

function getWalletCountryCode(w?: Wallet | null): string {
  const anyW = w as any;
  return normalizeCountryCode(anyW?.countryCode ?? anyW?.country_code ?? w?.currencyCode);
}

function getDestinationCountryCode(d?: PayoutDestination | null): string {
  const anyD = d as any;
  return normalizeCountryCode(anyD?.countryCode ?? anyD?.country_code ?? d?.code);
}

// ------------------------------------------------------------
// Quick Amount Button
// ------------------------------------------------------------
const QuickAmountButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      style={{
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.sm,
        backgroundColor: disabled ? colors.borderLight : colors.primaryLight,
        borderRadius: RADIUS.full,
        marginRight: SPACE.sm,
        opacity: disabled ? 0.5 : 1,
      }}
      onPress={onPress}
      disabled={disabled}
    >
      <AppText style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{label}</AppText>
    </Pressable>
  );
};

export default function SendMoneyScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles();

  const sm = useMemo(() => StyleSheet.create({

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", ...TYPE.subtitle, color: colors.text },
  body: { padding: SCREEN_PADDING, paddingBottom: SPACE.xxxl },
  card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACE.xl, marginBottom: SPACE.md, ...GLASS_BORDER, ...CARD_SHADOW },
  cardLabel: { ...TYPE.eyebrow, color: colors.muted, marginBottom: SPACE.md },
  amtRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  amtInput: { flex: 1, fontSize: 32, fontWeight: "700" as const, color: colors.text, padding: 0 },
  amtInputReadonly: { flex: 1, fontSize: 32, fontWeight: "700" as const, color: colors.textSecondary, padding: 0 },
  balRow: { flexDirection: "row", alignItems: "center", marginTop: SPACE.md },
  balText: { ...TYPE.caption, color: colors.muted },
  errText: { ...TYPE.caption, fontWeight: "700" as const, color: colors.red },
  destLabel: { ...TYPE.caption, color: colors.muted, marginTop: SPACE.sm },
  quickRow: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.lg },
  quickBtn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, backgroundColor: colors.primaryLight },
  quickBtnDisabled: { backgroundColor: colors.borderLight },
  quickBtnText: { ...TYPE.caption, fontWeight: "700" as const, color: colors.primary },
  quickBtnTextDisabled: { color: colors.muted },
  midRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.md },
  arrowBtn: { width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center" },
  rateBox: { flex: 1, backgroundColor: colors.card, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm + 1, alignItems: "center", ...GLASS_BORDER, ...CARD_SHADOW },
  rateText: { ...TYPE.caption, fontWeight: "600" as const, color: colors.textSecondary },
  deliveryTag: { flexDirection: "row", alignItems: "center", backgroundColor: colors.greenSoft, borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.sm },
  deliveryText: { fontSize: 11, fontWeight: "700" as const, color: colors.greenDark },
  continueBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, backgroundColor: colors.actionBg, borderRadius: RADIUS.md, paddingVertical: SPACE.lg + 1, marginTop: SPACE.xs },
  continueBtnDisabled: { backgroundColor: colors.border },
  continueBtnText: { color: colors.actionText, fontSize: 15, fontWeight: "700" as const },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: SPACE.lg },
  infoText: { ...TYPE.caption, color: colors.green },
  }), [colors]);

  const params = useLocalSearchParams();
  const initialFromCurrency = params.from as string | undefined;

  const [userPhone, setUserPhone] = useState<string>("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [fromWallet, setFromWallet] = useState<Wallet | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [balanceExceeded, setBalanceExceeded] = useState(false);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null);

  // Dynamic payout destinations
  const [payoutDestinations, setPayoutDestinations] = useState<PayoutDestination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<PayoutDestination | null>(null);
  const [destinationSearch, setDestinationSearch] = useState("");

  // ✅ From wallet picker search (so you have the same UX as destination picker)
  const [fromSearch, setFromSearch] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("user_phone").then((phone) => {
      if (phone) setUserPhone(phone);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (userPhone) {
      loadWallets();
      loadPayoutDestinations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPhone]);

  useEffect(() => {
    if (fromWallet && fromAmount) {
      const amt = parseFloat(fromAmount) || 0;
      setBalanceExceeded(amt > fromWallet.balance);
    } else {
      setBalanceExceeded(false);
    }
  }, [fromAmount, fromWallet]);

  const loadWallets = async () => {
    try {
      const response = await getUserWallets(userPhone);
      if (response.success) {
        const activeWallets = response.wallets.filter((w: Wallet) => w.status === "active");
        setWallets(activeWallets);

        let selectedFrom: Wallet | null = null;
        if (initialFromCurrency) {
          selectedFrom =
            activeWallets.find(
              (w: Wallet) => w.currencyCode.toUpperCase() === initialFromCurrency.toUpperCase()
            ) || null;
        }

        setFromWallet(selectedFrom || activeWallets[0] || null);
      } else {
        Alert.alert("Error", response.message || "Failed to load wallets");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to load your wallets");
    } finally {
      setLoading(false);
    }
  };

  const loadPayoutDestinations = async () => {
    try {
      const response = await getPayoutDestinations();
      if (response.success && response.destinations.length > 0) {
        setPayoutDestinations(response.destinations);
        const defaultDest =
          response.destinations.find((d: { code: string }) => d.code === "NGN") ||
          response.destinations[0];
        setSelectedDestination(defaultDest);
      }
    } catch (e) {
      console.log("Failed to load payout destinations:", e);
    }
  };

  const fetchQuote = useCallback(async () => {
    if (!fromWallet || !fromAmount || parseFloat(fromAmount) <= 0 || !selectedDestination) {
      setToAmount("");
      setRate(null);
      setFeeInfo(null);
      return;
    }

    const amount = parseFloat(fromAmount);
    const fromCurrency = fromWallet.currencyCode;
    const toCurrency = selectedDestination.code;

    setQuoteLoading(true);

    try {
      // Same-currency transfer
      if (fromCurrency === toCurrency) {
        setToAmount(fromAmount);
        setRate(1);

        const feeResponse = await calculateSendFee({
          phone: userPhone,
          transactionType: "send",
          amount,
          currency: fromCurrency,
        });

        if (feeResponse.success && feeResponse.feeAmount != null) {
          setFeeInfo({
            feeAmount: feeResponse.feeAmount,
            feeCurrency: feeResponse.feeCurrency || fromCurrency,
            feeType: feeResponse.feeConfig?.fee_type,
            feePercentage: feeResponse.feeConfig?.percentage_fee,
            flatFee: feeResponse.feeConfig?.flat_fee,
            totalDebit: feeResponse.totalAmount,
            feeAmountInBaseCurrency: feeResponse.feeAmountInBaseCurrency,
            baseCurrency: feeResponse.baseCurrency,
            baseCurrencySymbol: feeResponse.baseCurrencySymbol,
          });
        } else {
          setFeeInfo(null);
        }

        return;
      }

      // Different currencies
      const response = await getConversionQuote(userPhone, fromCurrency, toCurrency, amount);

      if (response.success) {
        setToAmount(response.quote.buyAmount.toFixed(2));
        setRate(response.quote.rate);

        if (response.quote.feeAmount != null) {
          setFeeInfo({
            feeAmount: response.quote.feeAmount,
            feeCurrency: response.quote.feeCurrency,
            feeType: response.quote.feeType,
            feePercentage: response.quote.feePercentage,
            flatFee: response.quote.flatFee,
            totalDebit: response.quote.totalDebit,
            feeAmountInBaseCurrency: response.quote.feeAmountInBaseCurrency,
            baseCurrency: response.quote.baseCurrency,
            baseCurrencySymbol: response.quote.baseCurrencySymbol,
          });
        } else {
          setFeeInfo(null);
        }
      } else {
        setToAmount("");
        setRate(null);
        setFeeInfo(null);
      }
    } catch (error) {
      console.error("Quote failed:", error);
      setToAmount("");
      setRate(null);
      setFeeInfo(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [fromWallet, fromAmount, userPhone, selectedDestination]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const handleQuickAmount = (percentage: number) => {
    if (fromWallet && fromWallet.balance > 0) {
      setFromAmount((fromWallet.balance * percentage).toFixed(2));
    }
  };

  const handleContinue = async () => {
    if (!fromWallet || !fromAmount || !selectedDestination) return;

    const amount = parseFloat(fromAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    if (amount > fromWallet.balance) {
      Alert.alert(
        "Insufficient Balance",
        `You only have ${fromWallet.formattedBalance} ${fromWallet.currencyCode}`
      );
      return;
    }

    if (!toAmount || parseFloat(toAmount) <= 0) {
      Alert.alert("Quote not ready", "Please wait for the conversion rate.");
      return;
    }

    // Note: email/KYC verification is enforced server-side at the actual send
    // step (RecipientConfirmScreen, via classify403 on the execute response).
    // We intentionally don't gate on locally-cached email_verified/user_kyc_status
    // flags here — those caches are only refreshed by specific screens (CheckEmailScreen,
    // HomeScreen) and can be stale or never-set for an already-verified user, which
    // was incorrectly blocking verified users with a premature "Email Not Verified"
    // prompt before they ever reached the PIN step.

    router.push({
      pathname: "/recipientselect" ,
      params: {
        destCurrency: selectedDestination.code,
        fromWalletId: String(fromWallet.id),
        fromCurrency: fromWallet.currencyCode,
        fromAmount,
        toAmount,
        rate: rate ? String(rate) : "",
      },
    });
  };

  const getPayoutMethodLabel = (dest: PayoutDestination) => {
    if (dest.code === "CAD") return "Send via Interac";
    return `Send to ${dest.countryName} bank account`;
  };

  const filteredDestinations = payoutDestinations.filter(
    (d) =>
      d.code.toLowerCase().includes(destinationSearch.toLowerCase()) ||
      d.countryName.toLowerCase().includes(destinationSearch.toLowerCase()) ||
      d.name.toLowerCase().includes(destinationSearch.toLowerCase())
  );

  // ✅ Wallet filter for the From picker modal
  const filteredWallets = wallets.filter((w) => {
    const q = fromSearch.toLowerCase().trim();
    if (!q) return true;
    const code = String(w.currencyCode || "").toLowerCase();
    const name = String((w as any)?.currencyName || (w as any)?.accountName || "").toLowerCase();
    return code.includes(q) || name.includes(q);
  });

  if (loading) {
    return (
      <ScreenShell>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText style={{ marginTop: 16, color: "#666" }}>Loading wallets...</AppText>
        </View>
      </ScreenShell>
    );
  }

  if (wallets.length === 0) {
    return (
      <ScreenShell>
        <View style={{ flex: 1, padding: 20 }}>
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.back()} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Send Money</AppText>
              <AppText style={{ fontSize: 12, color: colors.muted, fontWeight: "500" }}>Send to another wallet</AppText>
            </View>
          </View>

          <Pressable style={styles.primaryBtn} onPress={() => router.push("/addaccount")}>
            <AppText style={{ color: colors.actionText, fontWeight: "700", fontSize: 16 }}>+ Add Currency</AppText>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const canContinue =
    !!fromWallet &&
    !!fromAmount &&
    parseFloat(fromAmount) > 0 &&
    !balanceExceeded &&
    !!selectedDestination &&
    (rate || fromWallet.currencyCode === selectedDestination.code) &&
    !quoteLoading;
  return (
    <ScreenShell scrollable={false} padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

          {/* ── Header ── */}
          <View style={sm.header}>
            <BackButton onPress={() => router.back()} />
            <AppText style={sm.headerTitle}>Send Money</AppText>
            <View style={{ width: 34 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sm.body} keyboardShouldPersistTaps="handled">

            {/* ── FROM card ── */}
            <View style={sm.card}>
              <AppText style={sm.cardLabel}>You send</AppText>
              <View style={sm.amtRow}>
                <AppTextInput
                  value={fromAmount}
                  onChangeText={setFromAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  showSoftInputOnFocus={false}
                  caretHidden
                  placeholderTextColor={colors.muted}
                  style={[sm.amtInput, balanceExceeded && { color: colors.red }]}
                />
                <CurrencyPill
                  flag={(fromWallet as any)?.flag || "🏳️"}
                  code={fromWallet?.currencyCode || "Select"}
                  countryCode={getWalletCountryCode(fromWallet)}
                  onPress={() => setShowFromPicker(true)}
                />
              </View>
              <View style={sm.balRow}>
                <Ionicons name="wallet-outline" size={13} color={colors.muted} />
                <AppText style={[sm.balText, balanceExceeded && { color: colors.red }]}>
                  {" "}Balance: {fromWallet?.formattedBalance || "0.00"} {fromWallet?.currencyCode || ""}
                </AppText>
                {balanceExceeded && <AppText style={sm.errText}> · Insufficient</AppText>}
              </View>

              {/* Quick amounts */}
              <View style={sm.quickRow}>
                {[["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["MAX", 1]].map(([label, pct]) => (
                  <Pressable
                    key={label as string}
                    onPress={() => handleQuickAmount(pct as number)}
                    disabled={!fromWallet}
                    style={({ pressed }) => [sm.quickBtn, !fromWallet && sm.quickBtnDisabled, pressed && { opacity: 0.7 }]}
                  >
                    <AppText style={[sm.quickBtnText, !fromWallet && sm.quickBtnTextDisabled]}>{label as string}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ── Arrow + Rate ── */}
            <View style={sm.midRow}>
              <View style={sm.arrowBtn}>
                <Ionicons name="arrow-down" size={18} color={colors.primary} />
              </View>
              <View style={sm.rateBox}>
                {quoteLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : rate && selectedDestination
                    ? <AppText style={sm.rateText}>1 {fromWallet?.currencyCode} = {selectedDestination.code === "NGN" ? rate.toFixed(0) : rate.toFixed(4)} {selectedDestination.code}</AppText>
                    : fromWallet?.currencyCode === selectedDestination?.code
                      ? <AppText style={sm.rateText}>No conversion needed</AppText>
                      : <AppText style={sm.rateText}>Enter amount to see rate</AppText>
                }
              </View>
              <View style={sm.deliveryTag}>
                <Ionicons name="time-outline" size={12} color={colors.green} />
                <AppText style={sm.deliveryText}> Same-day</AppText>
              </View>
            </View>

            {/* ── TO card ── */}
            <View style={sm.card}>
              <AppText style={sm.cardLabel}>Recipient gets</AppText>
              <View style={sm.amtRow}>
                <AppTextInput
                  value={quoteLoading ? "..." : toAmount}
                  editable={false}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  style={sm.amtInputReadonly}
                />
                <CurrencyPill
                  flag={(selectedDestination as any)?.flag || "🏳️"}
                  code={selectedDestination?.code || "Select"}
                  countryCode={getDestinationCountryCode(selectedDestination)}
                  onPress={() => setShowToPicker(true)}
                />
              </View>
              <AppText style={sm.destLabel}>
                {selectedDestination ? getPayoutMethodLabel(selectedDestination) : "Select destination currency"}
              </AppText>

              {feeInfo ? (
                <FeeBreakdown
                  fee={feeInfo}
                  sellAmount={Number(fromAmount) || 0}
                  sellCurrency={fromWallet?.currencyCode || ""}
                  buyAmount={Number(toAmount) || 0}
                  buyCurrency={selectedDestination?.code || ""}
                  rate={rate ? Number(rate) : null}
                />
              ) : null}
            </View>

            {/* ── Continue button ── */}
            <Pressable
              onPress={handleContinue}
              disabled={!canContinue}
              style={({ pressed }) => [sm.continueBtn, !canContinue && sm.continueBtnDisabled, pressed && { opacity: 0.85 }]}
            >
              <AppText style={sm.continueBtnText}>Continue</AppText>
              <Ionicons name="arrow-forward" size={16} color={colors.actionText} />
            </Pressable>

            <View style={sm.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.green} />
              <AppText style={sm.infoText}> Secured transfer · Best exchange rates</AppText>
            </View>

          </ScrollView>

          {/* ── Numeric keypad ── */}
          <NumericKeypad value={fromAmount} onChangeValue={setFromAmount} />

          {/* Pickers */}
          <Modal visible={showFromPicker} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
              <Pressable style={{ flex: 1 }} onPress={() => setShowFromPicker(false)} />
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACE.lg, paddingBottom: SPACE.xxxl }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 16 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <AppText style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Select wallet</AppText>
                  <Pressable onPress={() => setShowFromPicker(false)} style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="close" size={18} color={colors.text} />
                  </Pressable>
                </View>
                <FlatList
                  data={filteredWallets}
                  keyExtractor={(w) => String(w.id)}
                  style={{ maxHeight: 360 }}
                  renderItem={({ item: w }) => (
                    <Pressable
                      onPress={() => { setFromWallet(w); setShowFromPicker(false); }}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }}
                    >
                      <CountryFlag currencyCode={w.currencyCode} size="md" />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <AppText style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{w.currencyCode}</AppText>
                        <AppText style={{ fontSize: 12, color: colors.muted }}>{w.formattedBalance}</AppText>
                      </View>
                      {fromWallet?.id === w.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    </Pressable>
                  )}
                />
              </View>
            </View>
          </Modal>

          <Modal visible={showToPicker} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
              <Pressable style={{ flex: 1 }} onPress={() => setShowToPicker(false)} />
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACE.lg, paddingBottom: SPACE.xxxl }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 16 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <AppText style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Send to</AppText>
                  <Pressable onPress={() => setShowToPicker(false)} style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="close" size={18} color={colors.text} />
                  </Pressable>
                </View>
                <FlatList
                  data={filteredDestinations}
                  keyExtractor={d => d.code}
                  style={{ maxHeight: 360 }}
                  renderItem={({ item: d }) => (
                    <Pressable
                      onPress={() => { setSelectedDestination(d); setShowToPicker(false); }}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }}
                    >
                      <CountryFlag currencyCode={d.code} size="md" />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <AppText style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{d.code}</AppText>
                        <AppText style={{ fontSize: 12, color: colors.muted }}>{getPayoutMethodLabel(d)}</AppText>
                      </View>
                      {selectedDestination?.code === d.code && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    </Pressable>
                  )}
                />
              </View>
            </View>
          </Modal>

      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

// ── SendMoney screen styles ───────────────────────────────────

