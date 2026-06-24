import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./../../../theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, TouchableWithoutFeedback, View } from "react-native";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import AppTextInput from "../../AppTextInput";
import {
  getConversionQuote,
  getPayoutDestinations,
  getUserWallets,
  PayoutDestination,
} from "../../../api/config";
import CurrencyPickerModal, { Wallet } from "../../../components/CurrencyPickerModal";
import CurrencyPill from "../../../components/CurrencyPill";
import ScreenShell from "../../../components/ScreenShell";
import { styles } from "../../../theme/styles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { SPACE, RADIUS, TYPE, CARD_SHADOW } from "../../../theme/designSystem";
import CountryFlag from "../../../components/CountryFlag";

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

/**
 * ✅ Safe countryCode readers (no TS redlines)
 */
const getWalletCountryCode = (w: Wallet | null | undefined): string => {
  const cc = (w as unknown as { countryCode?: string })?.countryCode;
  return typeof cc === "string" ? cc : "";
};

const getDestinationCountryCode = (d: PayoutDestination | null | undefined): string => {
  const cc = (d as unknown as { countryCode?: string })?.countryCode;
  return typeof cc === "string" ? cc : "";
};

/**
 * ✅ Typed wrapper so we can pass countryCode to CountryFlag with no TS errors
 * (even if CountryFlag’s props don’t declare it yet).
 */
const CountryFlagSafe = CountryFlag as unknown as React.ComponentType<{
  currencyCode?: string;
  countryCode?: string;
  fallbackEmoji?: string;
  size?: "sm" | "md" | "lg" | string;
  style?: any;
}>;

export default function SendMoneyScreen() {
  const { colors } = useAppTheme();
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

  const [payoutDestinations, setPayoutDestinations] = useState<PayoutDestination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<PayoutDestination | null>(null);
  const [destinationSearch, setDestinationSearch] = useState("");

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
      setBalanceExceeded(amt > (fromWallet.balance ?? 0));
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
              (w: Wallet) => w.currencyCode?.toUpperCase() === initialFromCurrency.toUpperCase()
            ) || null;
        }

        setFromWallet(selectedFrom || activeWallets[0] || null);
      } else {
        Alert.alert("Error", response.message || "Failed to load wallets");
      }
    } catch {
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
      return;
    }

    if (fromWallet.currencyCode === selectedDestination.code) {
      setToAmount(fromAmount);
      setRate(1);
      return;
    }

    setQuoteLoading(true);
    try {
      const response = await getConversionQuote(
        userPhone,
        fromWallet.currencyCode,
        selectedDestination.code,
        parseFloat(fromAmount)
      );

      if (response.success) {
        setToAmount(response.quote.buyAmount.toFixed(2));
        setRate(response.quote.rate);
      } else {
        setToAmount("");
        setRate(null);
      }
    } catch {
      setToAmount("");
      setRate(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [fromWallet, fromAmount, userPhone, selectedDestination]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const handleQuickAmount = (percentage: number) => {
    if (fromWallet && (fromWallet.balance ?? 0) > 0) {
      setFromAmount(((fromWallet.balance ?? 0) * percentage).toFixed(2));
    }
  };

  const handleContinue = () => {
    if (!fromWallet || !fromAmount || !selectedDestination) return;

    const amount = parseFloat(fromAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    if (amount > (fromWallet.balance ?? 0)) {
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

    router.push({
      pathname: "/recipientselect" as any,
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
    if (dest.code === "CAD") return "Send via EFT Bank Transfer";
    return `Send to ${dest.countryName} bank account`;
  };

  const filteredDestinations = useMemo(() => {
    const q = destinationSearch.toLowerCase().trim();
    if (!q) return payoutDestinations;
    return payoutDestinations.filter(
      (d) =>
        d.code.toLowerCase().includes(q) ||
        d.countryName.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q)
    );
  }, [payoutDestinations, destinationSearch]);

  if (loading) {
    return (
      <ScreenShell>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <AppText style={{ marginTop: 16, color: "#666" }}>Loading wallets...</AppText>
        </View>
      </ScreenShell>
    );
  }

  if (wallets.length === 0) {
    return (
      <ScreenShell>
        <View style={{ flex: 1, padding: 20 }}>
          <AppText style={{ fontSize: 22, fontWeight: "700", color: "#333", marginBottom: 8 }}>
            Withdraw
          </AppText>
          <AppText style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            You need at least 1 currency wallet to Withdraw.
          </AppText>

          <Pressable
            style={{ backgroundColor: COLORS.actionBg, borderRadius: 12, padding: 16, alignItems: "center" }}
            onPress={() => router.push("/addaccount")}
          >
            <AppText style={{ color: COLORS.actionText, fontWeight: "700", fontSize: 16 }}>+ Add Currency</AppText>
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
    !quoteLoading &&
    !!toAmount;

  return (
    <ScreenShell>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <BackButton onPress={() => router.back()} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.headerTitle}>Withdraw</AppText>
              {/* <AppText style={styles.subtitle}>Withdraw to {selectedDestination?.name || "Select"}</AppText> */}
            </View>
          </View>

          {/* FROM */}
          <View style={styles.convertBox}>
            <AppText style={{ color: colors.primary, fontWeight: "700" }}>You send</AppText>
            <View style={styles.convertRow}>
              <AppTextInput
                value={fromAmount}
                onChangeText={setFromAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.muted}
                style={[styles.amountInput, { fontSize: 28 }, balanceExceeded && { color: colors.red }]}
              />
              <CurrencyPill
                flag={fromWallet?.flag || "🏳️"}
                code={fromWallet?.currencyCode || "Select"}
                countryCode={getWalletCountryCode(fromWallet)}
                onPress={() => setShowFromPicker(true)}
              />
            </View>

            <AppText style={[styles.convertBalance, balanceExceeded && { color: colors.red }]}>
              Balance: {fromWallet?.formattedBalance || "0.00"} {fromWallet?.currencyCode || ""}
            </AppText>

            <View style={{ flexDirection: "row", marginTop: SPACE.md }}>
              <QuickAmountButton label="25%" onPress={() => handleQuickAmount(0.25)} disabled={!fromWallet} />
              <QuickAmountButton label="50%" onPress={() => handleQuickAmount(0.5)} disabled={!fromWallet} />
              <QuickAmountButton label="75%" onPress={() => handleQuickAmount(0.75)} disabled={!fromWallet} />
              <QuickAmountButton label="MAX" onPress={() => handleQuickAmount(1)} disabled={!fromWallet} />
            </View>
          </View>

          {/* MID */}
          <View style={styles.convertMid}>
            <View style={{ width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="arrow-down" size={18} color={colors.primary} />
            </View>
            {rate && selectedDestination ? (
              <AppText style={styles.muted}>
                1 {fromWallet?.currencyCode} = {rate.toFixed(4)} {selectedDestination.code}
              </AppText>
            ) : quoteLoading ? (
              <AppText style={styles.muted}>Fetching rate...</AppText>
            ) : fromWallet?.currencyCode === selectedDestination?.code ? (
              <AppText style={styles.muted}>No conversion needed</AppText>
            ) : (
              <AppText style={styles.muted}>Enter amount to see rate</AppText>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.xs }}>
              <Ionicons name="time-outline" size={13} color={colors.muted} />
              <AppText style={styles.muted}>Same-day delivery</AppText>
            </View>
          </View>

          {/* TO */}
          <View style={styles.convertBox}>
            <AppText style={{ color: colors.primary, fontWeight: "700" }}>
              Recipient gets ({selectedDestination?.code || "Select"})
            </AppText>
            <View style={styles.convertRow}>
              <AppTextInput
                value={quoteLoading ? "..." : toAmount}
                editable={false}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                style={[styles.amountInput, { fontSize: 28, color: colors.textSecondary }]}
              />
              <CurrencyPill
                flag={selectedDestination?.flag || "🏳️"}
                code={selectedDestination?.code || "Select"}
                countryCode={getDestinationCountryCode(selectedDestination)}
                onPress={() => setShowToPicker(true)}
              />
            </View>

            <AppText style={styles.convertBalance}>
              {selectedDestination ? getPayoutMethodLabel(selectedDestination) : "Select destination"}
            </AppText>
          </View>

          <Pressable
            style={canContinue ? styles.primaryBtn : styles.disabledBigBtn}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <AppText style={{ color: canContinue ? colors.actionText : colors.muted, fontWeight: "700", fontSize: 18 }}>
              Continue
            </AppText>
          </Pressable>

          <CurrencyPickerModal
            visible={showFromPicker}
            onClose={() => setShowFromPicker(false)}
            wallets={wallets}
            selected={fromWallet}
            onSelect={setFromWallet}
            title="Send From"
          />

          {/* Destination Picker Modal */}
          <Modal visible={showToPicker} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
              <Pressable style={{ flex: 1 }} onPress={() => setShowToPicker(false)} />
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: "70%", paddingBottom: SPACE.huge }}>
                <View style={{ padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Pressable onPress={() => setShowToPicker(false)} style={{ width: 30, height: 30, justifyContent: "center", alignItems: "center" }}>
                      <Ionicons name="close" size={20} color={colors.muted} />
                    </Pressable>
                    <AppText style={{ ...TYPE.subtitle, color: colors.text }}>Send To</AppText>
                    <View style={{ width: 30 }} />
                  </View>
                </View>

                <AppTextInput
                  style={{
                    marginHorizontal: SPACE.lg,
                    marginVertical: SPACE.md,
                    backgroundColor: colors.bgTertiary,
                    borderRadius: RADIUS.sm,
                    paddingHorizontal: SPACE.lg,
                    paddingVertical: SPACE.md,
                    fontSize: 16,
                    color: colors.text,
                  }}
                  placeholder="Search country or currency..."
                  placeholderTextColor={colors.muted}
                  value={destinationSearch}
                  onChangeText={setDestinationSearch}
                />

                <FlatList
                  data={filteredDestinations}
                  keyExtractor={(item) => item.code}
                  renderItem={({ item }) => (
                    <Pressable
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: SPACE.lg,
                        marginHorizontal: SPACE.lg,
                        marginBottom: SPACE.sm,
                        backgroundColor: selectedDestination?.code === item.code ? colors.greenSoft : colors.bgTertiary,
                        borderRadius: RADIUS.sm,
                      }}
                      onPress={() => {
                        setSelectedDestination(item);
                        setShowToPicker(false);
                        setDestinationSearch("");
                      }}
                    >
                      <CountryFlagSafe
                        currencyCode={item.code}
                        countryCode={getDestinationCountryCode(item)}
                        fallbackEmoji={item.flag}
                        size="md"
                        style={{ marginRight: SPACE.md }}
                      />

                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                          {item.code} - {item.countryName}
                        </AppText>
                        <AppText style={{ fontSize: 13, color: colors.muted }}>
                          {getPayoutMethodLabel(item)}
                        </AppText>
                      </View>

                      {selectedDestination?.code === item.code && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.green} />
                      )}
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <AppText style={{ textAlign: "center", color: colors.muted, marginTop: 40, fontSize: 16 }}>
                      No destinations found
                    </AppText>
                  }
                />
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </ScreenShell>
  );
}
