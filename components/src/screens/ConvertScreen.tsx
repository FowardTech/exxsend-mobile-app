import { useAppTheme } from "@/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  clearAllBalanceCaches,
  executeConversion,
  getConversionQuote,
  getUserWallets,
} from "../../../api/config";
import { checkLiquidity, isLiquidityLowResponse, LiquidityResult } from "../../../api/liquidity";
import CountryFlag from "../../../components/CountryFlag";
import FeeBreakdown, { FeeInfo } from "../../../components/FeeBreakdown";
import LiquidityBanner from "../../../components/LiquidityBanner";
import { useAutoPolling } from "../../../hooks/useAutoPolling";
import { useDeviceTrustGate } from "../../../hooks/useDeviceTrustGate";
import { addPendingSettlement, clearPendingForCurrency, usePendingSettlements } from "../../../hooks/usePendingSettlements";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE, TYPE } from "../../../theme/designSystem";
import { useStyles } from "../../../theme/styles";
import { userScopedKey } from "../../../utils/cacheKeys";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";
import { Wallet } from "./../../CurrencyPickerModal";
import CurrencyPill from "./../../CurrencyPill";
import ScreenShell from "./../../ScreenShell";

// ✅ FIX: extend Wallet locally to include countryCode (API may return it)
type WalletWithCountry = Wallet & { countryCode?: string; country_code?: string };

// ------------------------------------------------------------
// Helpers
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

function getWalletCountryCode(w?: WalletWithCountry | null): string {
  const anyW = w as any;
  return normalizeCountryCode(anyW?.countryCode ?? anyW?.country_code ?? w?.currencyCode);
}

function normCcy(v: any) {
  return String(v || "").toUpperCase().trim();
}

function toNumberSafe(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeWalletBalances(list: any[]): WalletWithCountry[] {
  if (!Array.isArray(list)) return [];
  return list.map((w: any) => ({
    ...w,
    currencyCode: normCcy(w.currencyCode),
    balance: toNumberSafe(w.balance),
  }));
}

// Quick amount button component
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
      <AppText style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>{label}</AppText>
    </Pressable>
  );
};

export default function ConvertScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles();
  const { ensureDeviceTrusted } = useDeviceTrustGate();

  const cv = useMemo(() => StyleSheet.create({

    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54, position: "relative" },
    headerSide: { minWidth: 34 },
    headerTitle: { position: "absolute", left: 0, right: 0, textAlign: "center", ...TYPE.subtitle, color: colors.text },
    body: { padding: SCREEN_PADDING, paddingBottom: SPACE.xxxl },
    card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACE.xl, marginBottom: SPACE.md, ...GLASS_BORDER, ...CARD_SHADOW },
    cardLabel: { ...TYPE.eyebrow, color: colors.muted, marginBottom: SPACE.md },
    amtRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
    amtInput: { flex: 1, fontSize: 32, fontWeight: "600" as const, color: colors.text, padding: 0 },
    amtInputReadonly: { flex: 1, fontSize: 32, fontWeight: "600" as const, color: colors.textSecondary, padding: 0 },
    balRow: { flexDirection: "row", alignItems: "center", marginTop: SPACE.md },
    balText: { ...TYPE.caption, color: colors.muted },
    errText: { ...TYPE.caption, fontWeight: "600" as const, color: colors.red },
    warnText: { ...TYPE.caption, fontWeight: "600" as const, color: colors.accent },
    quickRow: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.lg },
    quickBtn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, backgroundColor: colors.primaryLight },
    quickBtnDisabled: { backgroundColor: colors.borderLight },
    quickBtnText: { ...TYPE.caption, fontWeight: "600" as const, color: colors.primary },
    quickBtnTextDisabled: { color: colors.muted },
    midRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.md },
    swapBtn: { width: 44, height: 44, borderRadius: RADIUS.full, backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center" },
    rateBox: { flex: 1, backgroundColor: colors.card, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md - 2, alignItems: "center", ...GLASS_BORDER, ...CARD_SHADOW },
    rateText: { ...TYPE.subtitle, fontSize: 13, color: colors.textSecondary },
    convertBtn: { backgroundColor: colors.actionBg, borderRadius: RADIUS.md, paddingVertical: SPACE.lg + 1, alignItems: "center", justifyContent: "center", marginTop: SPACE.xs },
    convertBtnDisabled: { backgroundColor: colors.border },
    convertBtnText: { color: colors.actionText, fontSize: 15, fontWeight: "600" as const },
    infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: SPACE.lg },
    infoText: { ...TYPE.caption, color: colors.green },
  }), [colors]);

  const params = useLocalSearchParams();
  const initialFromCurrency = params.from as string | undefined;
  const initialToCurrency = params.to as string | undefined;

  const [userPhone, setUserPhone] = useState<string>("");
  const [wallets, setWallets] = useState<WalletWithCountry[]>([]);
  const [fromWallet, setFromWallet] = useState<WalletWithCountry | null>(null);
  const [toWallet, setToWallet] = useState<WalletWithCountry | null>(null);

  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [balanceExceeded, setBalanceExceeded] = useState(false);
  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null);

  // ── Liquidity pre-flight ──
  const [liquidityBlock, setLiquidityBlock] = useState<LiquidityResult | null>(null);
  const [liquidityChecking, setLiquidityChecking] = useState(false);
  const liquidityCheckSeq = useRef(0);

  const selectedFromCodeRef = useRef<string | null>(null);
  const selectedToCodeRef = useRef<string | null>(null);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");

  // Pending settlements for optimistic balance display
  const { hasPendingForCurrency, getOptimisticBalance } = usePendingSettlements();

  // ✅ IMPORTANT: Only apply optimistic balances when the wallet is pending AND we haven't refreshed from API after convert
  // Here we simply apply optimistic when pending exists, BUT since HomeScreen now disables optimistic once confirmed,
  // ConvertScreen won't cause doubling anymore because we normalize balances and clear pending on success when settled.
  const getDisplayBalance = useCallback(
    (wallet: WalletWithCountry | null) => {
      if (!wallet) return 0;
      return getOptimisticBalance(toNumberSafe(wallet.balance), wallet.currencyCode);
    },
    [getOptimisticBalance]
  );

  const fromDisplayBalance = getDisplayBalance(fromWallet);
  const toDisplayBalance = getDisplayBalance(toWallet);

  const fromHasPending = hasPendingForCurrency(fromWallet?.currencyCode ?? "");

  const handleSelectFrom = useCallback(
    (w: Wallet) => {
      const next = w as WalletWithCountry;
      selectedFromCodeRef.current = normCcy(next.currencyCode);
      setFromWallet({ ...next, currencyCode: normCcy(next.currencyCode), balance: toNumberSafe((next as any).balance) });

      if (toWallet && normCcy(toWallet.currencyCode) === normCcy(next.currencyCode)) {
        selectedToCodeRef.current = fromWallet ? normCcy(fromWallet.currencyCode) : null;
        setToWallet(fromWallet);
      }
    },
    [fromWallet, toWallet]
  );

  const handleSelectTo = useCallback(
    (w: Wallet) => {
      const next = w as WalletWithCountry;
      selectedToCodeRef.current = normCcy(next.currencyCode);
      setToWallet({ ...next, currencyCode: normCcy(next.currencyCode), balance: toNumberSafe((next as any).balance) });

      if (fromWallet && normCcy(fromWallet.currencyCode) === normCcy(next.currencyCode)) {
        selectedFromCodeRef.current = toWallet ? normCcy(toWallet.currencyCode) : null;
        setFromWallet(toWallet);
      }
    },
    [fromWallet, toWallet]
  );

  useEffect(() => {
    AsyncStorage.getItem("user_phone").then((phone) => {
      if (phone) setUserPhone(phone);
      else setLoading(false);
    });
  }, []);

  useAutoPolling(
    useCallback(() => {
      if (userPhone) loadWallets();
    }, [userPhone]),
    { intervalMs: 60000, enabled: !!userPhone, fetchOnMount: true }
  );

  useEffect(() => {
    if (fromWallet && fromAmount) {
      const amount = parseFloat(fromAmount) || 0;
      setBalanceExceeded(amount > fromDisplayBalance);
    } else {
      setBalanceExceeded(false);
    }
  }, [fromAmount, fromWallet, fromDisplayBalance]);

  const loadWallets = async () => {
    try {
      // ✅ USER-SCOPED cached accounts (same as HomeScreen)
      const cacheKey = userScopedKey("cached_accounts_v1", userPhone);
      const cachedRaw = await AsyncStorage.getItem(cacheKey);
      const cachedAccounts: { currencyCode: string; balance: any }[] = cachedRaw ? JSON.parse(cachedRaw) : [];
      const cachedBalanceMap: Record<string, number> = {};
      cachedAccounts.forEach((a) => {
        const ccy = normCcy(a.currencyCode);
        const bal = toNumberSafe(a.balance);
        if (ccy) cachedBalanceMap[ccy] = bal;
      });

      const response = await getUserWallets(userPhone);

      if (response.success) {
        // ✅ normalize API balances
        const apiWallets = normalizeWalletBalances(response.wallets || []);

        // ✅ merge cache ONLY if API balance is truly missing/zero AND cache is newer
        // We do NOT override valid API values (including string numbers).
        const mergedWallets: WalletWithCountry[] = apiWallets.map((w) => {
          const ccy = normCcy(w.currencyCode);
          const cachedBal = cachedBalanceMap[ccy];

          const apiBal = toNumberSafe((w as any).balance);

          // only use cache if api balance is missing (0 AND original was null/undefined)
          const rawWasMissing = (w as any).balance === null || (w as any).balance === undefined;

          if (rawWasMissing && typeof cachedBal === "number") {
            return { ...w, balance: cachedBal };
          }
          return { ...w, balance: apiBal };
        });

        // ✅ write back normalized cache so Home + Convert use the same stable numeric balances
        await AsyncStorage.setItem(cacheKey, JSON.stringify(mergedWallets));

        const activeWallets = mergedWallets.filter((w) => w.status === "active");
        setWallets(mergedWallets);

        const desiredFromCode =
          (selectedFromCodeRef.current ||
            fromWallet?.currencyCode ||
            initialFromCurrency ||
            activeWallets[0]?.currencyCode ||
            null)?.toUpperCase?.() ?? null;

        const desiredToCode =
          (selectedToCodeRef.current || toWallet?.currencyCode || initialToCurrency || null)?.toUpperCase?.() ?? null;

        const nextFrom =
          desiredFromCode
            ? activeWallets.find((w) => normCcy(w.currencyCode) === desiredFromCode) || null
            : activeWallets[0] || null;

        let nextTo: WalletWithCountry | null = null;
        if (desiredToCode && desiredToCode !== normCcy(nextFrom?.currencyCode)) {
          nextTo = activeWallets.find((w) => normCcy(w.currencyCode) === desiredToCode) || null;
        }
        if (!nextTo) nextTo = activeWallets.find((w) => w.currencyCode !== nextFrom?.currencyCode) || null;

        if (nextFrom?.currencyCode) selectedFromCodeRef.current = normCcy(nextFrom.currencyCode);
        if (nextTo?.currencyCode) selectedToCodeRef.current = normCcy(nextTo.currencyCode);

        setFromWallet(nextFrom);
        setToWallet(nextTo);
      } else {
        Alert.alert("Error", response.message || "Failed to load wallets");
      }
    } catch (error) {
      console.error("Failed to load wallets:", error);
      Alert.alert("Error", "Failed to load your wallets");
    } finally {
      setLoading(false);
    }
  };

  const fetchQuote = useCallback(async () => {
    if (!fromWallet || !toWallet || !fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount("");
      setRate(null);
      setFeeInfo(null);
      return;
    }

    setQuoteLoading(true);
    try {
      const response = await getConversionQuote(
        userPhone,
        fromWallet.currencyCode,
        toWallet.currencyCode,
        parseFloat(fromAmount)
      );

      if (response.success) {
        const grossBuyAmount = Number(response.quote.buyAmount || 0);
        const rateNum = Number(response.quote.rate || 0);
        const feeAmt = response.quote.feeAmount !== undefined ? Number(response.quote.feeAmount || 0) : 0;
        const feeCcy = response.quote.feeCurrency || fromWallet.currencyCode;

        // CurrencyCloud's own quote computes buyAmount from the full sell
        // amount — it has no knowledge of Exxsend's separate platform fee.
        // Without this adjustment, "Total you get" (net of fee) and
        // "You'll receive" (still the gross figure) contradict each other:
        // the fee would visibly reduce one number but not the other, even
        // though it's the same conversion.
        let netBuyAmount = grossBuyAmount;
        if (feeAmt > 0 && rateNum > 0) {
          if (feeCcy === fromWallet.currencyCode) {
            // Fee comes out of the sell amount before conversion.
            netBuyAmount = (parseFloat(fromAmount) - feeAmt) * rateNum;
          } else if (feeCcy === toWallet.currencyCode) {
            // Fee comes out of the buy amount after conversion.
            netBuyAmount = grossBuyAmount - feeAmt;
          }
        }

        setToAmount(netBuyAmount.toFixed(2));
        setRate(rateNum);

        if (response.quote.feeAmount !== undefined) {
          setFeeInfo({
            feeAmount: feeAmt,
            feeCurrency: feeCcy,
            feeType: response.quote.feeConfig?.fee_type,
            feePercentage: response.quote.feeConfig?.percentage_fee,
            flatFee: response.quote.feeConfig?.flat_fee,
            totalDebit: Number(response.quote.totalDebit || 0),
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
  }, [fromWallet, toWallet, fromAmount, userPhone]);

  useEffect(() => {
    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [fetchQuote]);

  // ── Liquidity pre-flight: runs on the BUY currency + BUY amount, 400ms debounce ──
  const runLiquidityCheck = useCallback(async () => {
    if (!toWallet || !toAmount || parseFloat(toAmount) <= 0) {
      setLiquidityBlock(null);
      return;
    }
    const seq = ++liquidityCheckSeq.current;
    setLiquidityChecking(true);
    try {
      const result = await checkLiquidity({
        currency: toWallet.currencyCode,
        amount: parseFloat(toAmount),
        operation: "conversion",
      });
      if (seq !== liquidityCheckSeq.current) return; // stale response — a newer check superseded this one
      setLiquidityBlock(result.ok ? null : result);
    } finally {
      if (seq === liquidityCheckSeq.current) setLiquidityChecking(false);
    }
  }, [toWallet, toAmount]);

  useEffect(() => {
    const debounce = setTimeout(runLiquidityCheck, 400);
    return () => clearTimeout(debounce);
  }, [runLiquidityCheck]);

  const handleQuickAmount = (percentage: number) => {
    if (fromWallet && fromDisplayBalance > 0) {
      setFromAmount((fromDisplayBalance * percentage).toFixed(2));
    }
  };

  const handleConvert = async () => {
    if (!fromWallet || !toWallet || !fromAmount) return;

    const amount = parseFloat(fromAmount);
    if (amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    if (amount > fromDisplayBalance) {
      router.push({
        pathname: "/result",
        params: {
          type: "error",
          title: "Conversion Failed",
          message: `Insufficient Balance. You only have ${fromDisplayBalance.toFixed(2)} ${fromWallet.currencyCode}`,
          primaryText: "Try again",
          primaryRoute: "back",
          secondaryText: "Contact support",
          secondaryRoute: "/help",
        },
      });
      return;
    }

    Alert.alert(
      "Confirm Conversion",
      `Convert ${fromAmount} ${fromWallet.currencyCode} to ${toAmount} ${toWallet.currencyCode}?\n\nRate: 1 ${fromWallet.currencyCode} = ${rate?.toFixed(4)} ${toWallet.currencyCode}`,
      [{ text: "Cancel", style: "cancel" }, { text: "Convert", onPress: executeConversionRequest }]
    );
  };

  const executeConversionRequest = async () => {
    if (!fromWallet || !toWallet || !fromAmount) return;

    const trusted = await ensureDeviceTrusted(userPhone);
    if (!trusted) return;

    setConverting(true);
    try {
      const response = await executeConversion(
        userPhone,
        fromWallet.currencyCode,
        toWallet.currencyCode,
        parseFloat(fromAmount)
      );

      if (response.success) {
        const conversionData = response.conversion;

        const sellAmount = toNumberSafe(conversionData?.sellAmount ?? fromAmount);
        const buyAmount = toNumberSafe(conversionData?.buyAmount ?? toAmount);

        const sellCurrency = normCcy(conversionData?.sellCurrency || fromWallet.currencyCode);
        const buyCurrency = normCcy(conversionData?.buyCurrency || toWallet.currencyCode);

        // ✅ If backend says balance update pending, record pending settlement
        if (response.balanceUpdatePending) {
          const KNOWN_EXOTIC_CURRENCIES = ["NGN", "GHS", "RWF", "UGX", "TZS", "ZMW", "XOF", "XAF"];
          const isExotic = (c: string) => KNOWN_EXOTIC_CURRENCIES.includes(normCcy(c));

          const pendingSellAmount = isExotic(sellCurrency) ? 0 : sellAmount;
          const pendingBuyAmount = isExotic(buyCurrency) ? 0 : buyAmount;

          if (pendingSellAmount !== 0 || pendingBuyAmount !== 0) {
            await addPendingSettlement({
              sellCurrency,
              buyCurrency,
              sellAmount: pendingSellAmount,
              buyAmount: pendingBuyAmount,
              conversionId: conversionData?.id,
              sellBalanceBefore: toNumberSafe(fromWallet.balance),
              buyBalanceBefore: toNumberSafe(toWallet.balance),
            });
          }
        } else {
          // ✅ if backend already settled, ensure no old pending remains
          clearPendingForCurrency(sellCurrency);
          clearPendingForCurrency(buyCurrency);
        }

        // ✅ CRITICAL: wipe caches so HomeScreen never shows stale or “added” cached values
        try {
          await clearAllBalanceCaches();
        } catch { }

        // ✅ force a reload of wallets now (so this screen also stays correct)
        await loadWallets();

        router.push({
          pathname: "/result",
          params: {
            type: "success",
            title: "Conversion Complete",
            message: `You converted ${sellAmount.toFixed(2)} ${sellCurrency} to ${buyAmount.toFixed(2)} ${buyCurrency}`,
            subtitle: `Rate: 1 ${sellCurrency} = ${toNumberSafe(conversionData?.rate ?? rate).toFixed(4)} ${buyCurrency}`,
            amount: `${sellAmount.toFixed(2)} ${sellCurrency} → ${buyAmount.toFixed(2)} ${buyCurrency}`,
            transactionId: (response as any)?.transaction_id || (response as any)?.reference || (response as any)?.id || "",
            fee: (response as any)?.fee != null ? `${(response as any).fee} ${sellCurrency}` : "Free",
            note: `Rate: 1 ${sellCurrency} = ${toNumberSafe(conversionData?.rate ?? rate).toFixed(4)} ${buyCurrency}`,
            primaryText: "Done",
            primaryRoute: "/(tabs)",
            secondaryText: "View wallet",
            secondaryRoute: "/(tabs)/wallet",
          },
        });
      } else {
        const liquidityFail = isLiquidityLowResponse(response);
        router.push({
          pathname: "/result",
          params: {
            type: "error",
            title: liquidityFail ? "Try again in a few minutes" : "Conversion Failed",
            message: liquidityFail
              ? liquidityFail.message
              : response.message || "Something went wrong with the conversion.",
            primaryText: "Try again",
            primaryRoute: "back",
            secondaryText: "",
            secondaryRoute: "/help",
          },
        });
      }
    } catch (error) {
      console.error("[ConvertScreen] Conversion error:", error);
      const liquidityFail = isLiquidityLowResponse(error);
      router.push({
        pathname: "/result",
        params: {
          type: "error",
          title: liquidityFail ? "Try again in a few minutes" : "Conversion Failed",
          message: liquidityFail
            ? liquidityFail.message
            : "Network error. Please check your connection and try again.",
          primaryText: "Try again",
          primaryRoute: "back",
          secondaryText: "",
          secondaryRoute: "/help",
        },
      });
    } finally {
      setConverting(false);
    }
  };

  const swapCurrencies = () => {
    const temp = fromWallet;
    setFromWallet(toWallet);
    setToWallet(temp);
    setFromAmount("");
    setToAmount("");
    setRate(null);

    selectedFromCodeRef.current = temp?.currencyCode ?? null;
    selectedToCodeRef.current = toWallet?.currencyCode ?? null;
  };

  // ------------------------------------------------------------
  // ✅ Custom pickers with rounded flags (CountryFlag)
  // ------------------------------------------------------------
  const filteredFromWallets = wallets
    .filter((w) => w.currencyCode !== toWallet?.currencyCode)
    .filter((w) => {
      const q = fromSearch.toLowerCase().trim();
      if (!q) return true;
      const code = String(w.currencyCode || "").toLowerCase();
      const name = String((w as any)?.currencyName || (w as any)?.accountName || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });

  const filteredToWallets = wallets
    .filter((w) => w.currencyCode !== fromWallet?.currencyCode)
    .filter((w) => {
      const q = toSearch.toLowerCase().trim();
      if (!q) return true;
      const code = String(w.currencyCode || "").toLowerCase();
      const name = String((w as any)?.currencyName || (w as any)?.accountName || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });

  const FromPickerModal = (
    <Modal visible={showFromPicker} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            setShowFromPicker(false);
            setFromSearch("");
          }}
        />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%", paddingBottom: 40 }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable
                onPress={() => {
                  setShowFromPicker(false);
                  setFromSearch("");
                }}
                style={{ width: 30, height: 30, justifyContent: "center", alignItems: "center" }}
              >
                <AppText style={{ fontSize: 18, color: colors.textSecondary }}>✕</AppText>
              </Pressable>
              <AppText style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>Convert From</AppText>
              <View style={{ width: 30 }} />
            </View>
          </View>

          <AppTextInput
            style={{
              marginHorizontal: 16,
              marginVertical: 12,
              backgroundColor: colors.borderLight,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              color: colors.text,
            }}
            placeholder="Search currency..."
            placeholderTextColor={colors.muted}
            value={fromSearch}
            onChangeText={setFromSearch}
          />

          <FlatList
            data={filteredFromWallets}
            keyExtractor={(item) => String((item as any)?.id ?? item.currencyCode)}
            renderItem={({ item }) => {
              const selected = normCcy(fromWallet?.currencyCode) === normCcy(item.currencyCode);
              return (
                <Pressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    marginHorizontal: 16,
                    marginBottom: 8,
                    backgroundColor: selected ? colors.greenSoft : colors.bgTertiary,
                    borderRadius: 12,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.primary : colors.border,
                  }}
                  onPress={() => {
                    handleSelectFrom(item as any);
                    setShowFromPicker(false);
                    setFromSearch("");
                  }}
                >
                  <CountryFlag currencyCode={item.currencyCode} fallbackEmoji={(item as any)?.flag} size="md" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{item.currencyCode}</AppText>
                    <AppText style={{ fontSize: 13, color: colors.textSecondary }}>
                      Balance: {getOptimisticBalance(toNumberSafe(item.balance), item.currencyCode).toFixed(2)} {item.currencyCode}
                    </AppText>
                  </View>
                  {selected && <AppText style={{ fontSize: 18, color: colors.primary, fontWeight: "600" }}>✓</AppText>}
                </Pressable>
              );
            }}
            ListEmptyComponent={<AppText style={{ textAlign: "center", color: colors.muted, marginTop: 40, fontSize: 16 }}>No wallets found</AppText>}
          />
        </View>
      </View>
    </Modal>
  );

  const ToPickerModal = (
    <Modal visible={showToPicker} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            setShowToPicker(false);
            setToSearch("");
          }}
        />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%", paddingBottom: 40 }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable
                onPress={() => {
                  setShowToPicker(false);
                  setToSearch("");
                }}
                style={{ width: 30, height: 30, justifyContent: "center", alignItems: "center" }}
              >
                <AppText style={{ fontSize: 18, color: colors.textSecondary }}>✕</AppText>
              </Pressable>
              <AppText style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>Convert To</AppText>
              <View style={{ width: 30 }} />
            </View>
          </View>

          <AppTextInput
            style={{
              marginHorizontal: 16,
              marginVertical: 12,
              backgroundColor: colors.borderLight,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              color: colors.text,
            }}
            placeholder="Search currency..."
            placeholderTextColor={colors.muted}
            value={toSearch}
            onChangeText={setToSearch}
          />

          <FlatList
            data={filteredToWallets}
            keyExtractor={(item) => String((item as any)?.id ?? item.currencyCode)}
            renderItem={({ item }) => {
              const selected = normCcy(toWallet?.currencyCode) === normCcy(item.currencyCode);
              return (
                <Pressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    marginHorizontal: 16,
                    marginBottom: 8,
                    backgroundColor: selected ? colors.greenSoft : colors.bgTertiary,
                    borderRadius: 12,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.primary : colors.border,
                  }}
                  onPress={() => {
                    handleSelectTo(item as any);
                    setShowToPicker(false);
                    setToSearch("");
                  }}
                >
                  <CountryFlag currencyCode={item.currencyCode} fallbackEmoji={(item as any)?.flag} size="md" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{item.currencyCode}</AppText>
                    <AppText style={{ fontSize: 13, color: colors.textSecondary }}>
                      Balance: {getOptimisticBalance(toNumberSafe(item.balance), item.currencyCode).toFixed(2)} {item.currencyCode}
                    </AppText>
                  </View>
                  {selected && <AppText style={{ fontSize: 18, color: colors.primary, fontWeight: "600" }}>✓</AppText>}
                </Pressable>
              );
            }}
            ListEmptyComponent={<AppText style={{ textAlign: "center", color: colors.muted, marginTop: 40, fontSize: 16 }}>No wallets found</AppText>}
          />
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <ScreenShell>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText style={{ marginTop: 16, color: colors.muted }}>Loading wallets...</AppText>
        </View>
      </ScreenShell>
    );
  }

  if (wallets.length < 2) {
    return (
      <ScreenShell>
        <View style={{ flex: 1, padding: 20 }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <BackButton onPress={() => router.back()} />
              <AppText style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>Convert Currency</AppText>
              <AppText style={styles.subtitle}>You need at least 2 currency wallets to convert between currencies.</AppText>
              <Pressable style={styles.primaryBtn} onPress={() => router.push("/addaccount")}>
                <AppText style={{ color: colors.actionText, fontWeight: "600", fontSize: 16 }}>+ Add Currency</AppText>
              </Pressable>
            </View>
          </View>

          {wallets.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 12 }}>
                Your Current Wallet{wallets.length > 1 ? "s" : ""}
              </AppText>

              {wallets.map((wallet) => (
                <View
                  key={wallet.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: wallet.status === "active" ? colors.bgTertiary : colors.border,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 10,
                    opacity: wallet.status === "active" ? 1 : 0.6,
                  }}
                >
                  <CountryFlag currencyCode={wallet.currencyCode} fallbackEmoji={(wallet as any).flag} size="md" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{(wallet as any).currencyName}</AppText>
                    <AppText style={{ fontSize: 14, color: colors.muted }}>
                      {toNumberSafe(wallet.balance).toFixed(2)} {wallet.currencyCode}
                    </AppText>
                  </View>

                  {wallet.status !== "active" && (
                    <View style={{ backgroundColor: colors.muted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                      <AppText style={{ color: colors.white, fontSize: 10, fontWeight: "600" }}>INACTIVE</AppText>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          <AppText style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 16 }}>
            Add {wallets.length === 0 ? "at least 2 currencies" : "one more currency"} to start converting
          </AppText>
        </View>
      </ScreenShell>
    );
  }

  const canConvert =
    !!fromWallet &&
    !!toWallet &&
    !!fromAmount &&
    parseFloat(fromAmount) > 0 &&
    !balanceExceeded &&
    !fromHasPending &&
    !!rate &&
    !quoteLoading &&
    !liquidityBlock &&
    !liquidityChecking;
  return (
    <ScreenShell scrollable={false} padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

        {/* ── Header ── */}
        <View style={cv.header}>
          <View style={cv.headerSide}>
            <BackButton onPress={() => router.back()} />
          </View>
          <AppText style={cv.headerTitle} pointerEvents="none">Convert</AppText>
          <View style={cv.headerSide} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={cv.body} keyboardShouldPersistTaps="handled">

          {/* ── FROM card ── */}
          <View style={cv.card}>
            <AppText style={cv.cardLabel}>You convert</AppText>
            <View style={cv.amtRow}>
              <AppTextInput
                value={fromAmount}
                onChangeText={setFromAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.muted}
                style={[cv.amtInput, balanceExceeded && { color: colors.red }]}
              />
              <CurrencyPill
                flag={fromWallet?.flag || "🏳️"}
                code={fromWallet?.currencyCode || "Select"}
                countryCode={getWalletCountryCode(fromWallet)}
                onPress={() => setShowFromPicker(true)}
              />
            </View>
            <View style={cv.balRow}>
              <Ionicons name="wallet-outline" size={13} color={colors.muted} />
              <AppText style={[cv.balText, balanceExceeded && { color: colors.red }]}>
                {" "}Balance: {fromDisplayBalance.toFixed(2)} {fromWallet?.currencyCode || ""}
              </AppText>
              {balanceExceeded && <AppText style={cv.errText}> · Insufficient</AppText>}
              {fromHasPending && <AppText style={cv.warnText}> · Settlement pending</AppText>}
            </View>

            {/* Quick amounts */}
            <View style={cv.quickRow}>
              {[["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["MAX", 1.0]].map(([label, pct]) => (
                <Pressable
                  key={label as string}
                  onPress={() => handleQuickAmount(pct as number)}
                  disabled={!fromWallet || fromDisplayBalance <= 0 || fromHasPending}
                  style={({ pressed }) => [cv.quickBtn, (!fromWallet || fromDisplayBalance <= 0) && cv.quickBtnDisabled, pressed && { opacity: 0.7 }]}
                >
                  <AppText style={[cv.quickBtnText, (!fromWallet || fromDisplayBalance <= 0) && cv.quickBtnTextDisabled]}>{label as string}</AppText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Swap + Rate ── */}
          <View style={cv.midRow}>
            <Pressable onPress={swapCurrencies} style={cv.swapBtn}>
              <Ionicons name="swap-vertical-outline" size={20} color={colors.primary} />
            </Pressable>
            <View style={cv.rateBox}>
              {quoteLoading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : rate
                  ? <AppText style={cv.rateText}>1 {fromWallet?.currencyCode} = {rate.toFixed(4)} {toWallet?.currencyCode}</AppText>
                  : <AppText style={cv.rateText}>Enter amount to see rate</AppText>
              }
            </View>
          </View>

          {/* ── TO card ── */}
          <View style={cv.card}>
            <AppText style={cv.cardLabel}>You receive</AppText>
            <View style={cv.amtRow}>
              <AppTextInput
                value={quoteLoading ? "..." : toAmount}
                editable={false}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                style={cv.amtInputReadonly}
              />
              <CurrencyPill
                flag={toWallet?.flag || "🏳️"}
                code={toWallet?.currencyCode || "Select"}
                countryCode={getWalletCountryCode(toWallet)}
                onPress={() => setShowToPicker(true)}
              />
            </View>
            <View style={cv.balRow}>
              <Ionicons name="wallet-outline" size={13} color={colors.muted} />
              <AppText style={cv.balText}> Balance: {toDisplayBalance.toFixed(2)} {toWallet?.currencyCode || ""}</AppText>
            </View>
          </View>

          {/* ── Fee breakdown ── */}
          {fromWallet && toWallet && rate && parseFloat(fromAmount) > 0 && (
            <FeeBreakdown
              fee={feeInfo}
              sellAmount={parseFloat(fromAmount)}
              sellCurrency={fromWallet.currencyCode}
              buyAmount={parseFloat(toAmount) || 0}
              buyCurrency={toWallet.currencyCode}
              rate={rate}
            />
          )}

          {/* ── Liquidity banner ── */}
          <LiquidityBanner
            result={liquidityBlock}
            retrying={liquidityChecking}
            onRetry={runLiquidityCheck}
          />

          {/* ── Convert button ── */}
          <Pressable
            onPress={handleConvert}
            disabled={!canConvert || converting}
            style={({ pressed }) => [cv.convertBtn, (!canConvert || converting) && cv.convertBtnDisabled, pressed && { opacity: 0.85 }]}
          >
            {converting
              ? <ActivityIndicator color={colors.actionText} />
              : <AppText style={cv.convertBtnText}>Convert Now</AppText>
            }
          </Pressable>

          {/* ── Info ── */}
          <View style={cv.infoRow}>
            <Ionicons name="flash-outline" size={13} color={colors.green} />
            <AppText style={cv.infoText}> Instant conversion · No hidden fees</AppText>
          </View>

        </ScrollView>

        {FromPickerModal}
        {ToPickerModal}

      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

// ── Convert screen styles ──────────────────────────────────────

