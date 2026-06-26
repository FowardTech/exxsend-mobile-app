/**
 * RecipientNewScreen — corridor-driven recipient entry.
 * Uses api/corridors.ts as single source of truth.
 * Does NOT pre-save recipient — RecipientConfirmScreen persists after successful payout.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet, Modal, FlatList, StatusBar } from "react-native";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";
import AppTextInput from "../../../AppTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Corridor, CorridorMethod, MomoNetwork,
  getCorridorOrFallback, validateCorridorFields,
  toPayoutType, getRoutingValue,
} from "../../../../api/corridors";
import { getBanksByCountry, verifyBankAccount, Bank } from "../../../../api/flutterwave";
import { getUserWallets, getConversionQuote } from "../../../../api/config";
import { useAppTheme } from "@/theme/ThemeProvider";
import { SPACE, RADIUS, TYPE, CARD_SHADOW, GLASS_BORDER, GLASS_BORDER_SUBTLE, SCREEN_PADDING } from "@/theme/designSystem";
import CountryFlag from "../../../CountryFlag";
import CurrencyPickerModal, { Wallet } from "../../../CurrencyPickerModal";
import BeneficiaryPickerModal from "../../../BeneficiaryPickerModal";
import { RecentRecipientFromDB } from "../../../../api/sync";
import RecipientAvatar from "../../../../components/RecipientAvatar";

function getInitialValues(method: CorridorMethod): Record<string, string> {
  return Object.fromEntries(method.fields.map((f) => [f.key, ""]));
}

function MethodTab({ method, active, onPress }: { method: CorridorMethod; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeLocalStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={[s.tab, active && s.tabActive]}>
      <Ionicons
        name={method.method === "momo" ? "phone-portrait-outline" : method.method === "interac" ? "mail-outline" : "business-outline"}
        size={14} color={active ? "#FFF" : colors.textSecondary} style={{ marginRight: 5 }}
      />
      <AppText style={[s.tabText, active && s.tabTextActive]}>{method.label}</AppText>
    </Pressable>
  );
}

function FieldInput({ field, value, onChange, onBlur, error, editable = true, loading = false }: {
  field: { key: string; label: string; placeholder: string; keyboardType: string; maxLength?: number };
  value: string; onChange: (v: string) => void; onBlur?: () => void;
  error?: string; editable?: boolean; loading?: boolean;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeLocalStyles(colors), [colors]);
  const kbType = field.keyboardType === "numeric" ? "number-pad" : field.keyboardType === "phone" ? "phone-pad" : field.keyboardType === "email" ? "email-address" : "default";
  return (
    <View style={s.fieldWrap}>
      <AppText style={s.fieldLabel}>{field.label}</AppText>
      <View style={[s.inputBox, !!error && s.inputBoxErr, !editable && s.inputBoxDisabled]}>
        <AppTextInput
          value={value} onChangeText={onChange} onBlur={onBlur}
          placeholder={field.placeholder} placeholderTextColor={colors.muted}
          keyboardType={kbType as any} maxLength={field.maxLength}
          editable={editable && !loading}
          autoCapitalize={field.keyboardType === "email" ? "none" : "words"}
          style={s.input}
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
        {!loading && !editable && value.length > 0 && <Ionicons name="checkmark-circle" size={18} color={colors.green} style={{ marginLeft: 8 }} />}
      </View>
      {!!error && <AppText style={s.fieldError}>{error}</AppText>}
    </View>
  );
}

function BankPicker({ visible, banks, loading, searchQuery, onSearch, onSelect, onClose, selected }: {
  visible: boolean; banks: Bank[]; loading: boolean; searchQuery: string; onSearch: (q: string) => void;
  onSelect: (b: Bank) => void; onClose: () => void; selected: Bank | null;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeLocalStyles(colors), [colors]);
  const filtered = useMemo(() => banks.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase())), [banks, searchQuery]);
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <AppText style={s.sheetTitle}>Select bank</AppText>
            <Pressable onPress={onClose} style={s.sheetClose}><Ionicons name="close" size={18} color={colors.text} /></Pressable>
          </View>
          <View style={s.sheetSearch}>
            <Ionicons name="search-outline" size={15} color={colors.muted} style={{ marginRight: 8 }} />
            <AppTextInput value={searchQuery} onChangeText={onSearch} placeholder="Search banks…" placeholderTextColor={colors.muted} style={{ flex: 1, fontSize: 14, color: colors.text }} autoFocus />
          </View>
          {loading ? (
            <View style={{ padding: 32, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
              <AppText style={{ marginTop: 10, color: colors.muted, fontSize: 13 }}>Loading banks…</AppText>
            </View>
          ) : (
            <FlatList data={filtered} keyExtractor={(b) => b.code} style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable onPress={() => onSelect(item)} style={[s.bankRow, selected?.code === item.code && s.bankRowSelected]}>
                  <AppText style={s.bankName}>{item.name}</AppText>
                  {selected?.code === item.code && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function NetworkPicker({ visible, networks, onSelect, onClose, selected }: {
  visible: boolean; networks: MomoNetwork[]; onSelect: (n: MomoNetwork) => void; onClose: () => void; selected: MomoNetwork | null;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeLocalStyles(colors), [colors]);
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <AppText style={s.sheetTitle}>Select network</AppText>
            <Pressable onPress={onClose} style={s.sheetClose}><Ionicons name="close" size={18} color={colors.text} /></Pressable>
          </View>
          {networks.map((n) => (
            <Pressable key={n.code} onPress={() => onSelect(n)} style={[s.bankRow, selected?.code === n.code && s.bankRowSelected]}>
              <AppText style={s.bankName}>{n.name}</AppText>
              {selected?.code === n.code && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

export default function RecipientNewScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => makeLocalStyles(colors), [colors]);
  const params = useLocalSearchParams<{ destCurrency: string; fromWalletId: string; fromCurrency: string; fromAmount: string; toAmount: string; rate?: string; countryCode?: string; countryName?: string; prefilledRecipient?: string }>();
  const destCurrency = (params.destCurrency || "NGN").toUpperCase();
  const corridor: Corridor | undefined = useMemo(
    () => getCorridorOrFallback(destCurrency, params.countryCode, params.countryName),
    [destCurrency, params.countryCode, params.countryName]
  );
  // Set when arriving from a known recipient (e.g. Home screen's "Recent
  // recipients" → recipient detail → "Send to this recipient"). Their bank
  // details are already on file, so this screen should skip straight to
  // amount entry rather than asking the user to either pick a corridor
  // method or re-enter bank details for someone already known.
  const prefilled: RecentRecipientFromDB | null = useMemo(() => {
    if (!params.prefilledRecipient) return null;
    try { return JSON.parse(String(params.prefilledRecipient)); } catch { return null; }
  }, [params.prefilledRecipient]);
  const [methodIdx, setMethodIdx] = useState(0);
  const activeMethod: CorridorMethod | undefined = corridor?.methods[methodIdx];

  // ── CurrencyCloud: choose between a saved beneficiary or entering bank details ──
  const isCurrencyCloud = activeMethod?.method === "currencycloud";
  const [useSavedBeneficiary, setUseSavedBeneficiary] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<RecentRecipientFromDB | null>(null);
  const [beneficiaryPickerOpen, setBeneficiaryPickerOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [networkPickerOpen, setNetworkPickerOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<MomoNetwork | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [nameVerified, setNameVerified] = useState(false);
  const [nameVerifyAttempted, setNameVerifyAttempted] = useState(false);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fallback amount entry ──
  // RecipientSelectScreen normally passes fromAmount/toAmount/fromWalletId along the
  // chain (SendMoneyScreen → RecipientSelectScreen → here). But this screen can also be
  // opened directly (e.g. "Send to a new recipient" from the Recipients list) with none
  // of those params set, leaving the user with no way to specify an amount. When that
  // happens we show our own amount input + source-wallet picker right on this screen.
  const needsAmountEntry = !params.toAmount && !params.fromAmount;
  const [userPhone, setUserPhone] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [fromWallet, setFromWallet] = useState<Wallet | null>(null);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [manualFromAmount, setManualFromAmount] = useState("");
  const [manualToAmount, setManualToAmount] = useState("");
  const [manualRate, setManualRate] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (!needsAmountEntry) return;
    AsyncStorage.getItem("user_phone").then((phone) => {
      if (phone) setUserPhone(phone);
    });
  }, [needsAmountEntry]);

  useEffect(() => {
    if (!needsAmountEntry || !userPhone) return;
    getUserWallets(userPhone).then((res) => {
      if (res.success) {
        const active = res.wallets.filter((w: Wallet) => w.status === "active");
        setWallets(active);
        // Default to a wallet matching the destination currency if the user has one
        // (no conversion needed), otherwise fall back to their first active wallet.
        const directMatch = active.find((w: Wallet) => w.currencyCode?.toUpperCase() === destCurrency);
        setFromWallet(directMatch || active[0] || null);
      }
    }).catch(() => {});
  }, [needsAmountEntry, userPhone, destCurrency]);

  const fetchManualQuote = useCallback(async () => {
    if (!needsAmountEntry || !fromWallet || !manualFromAmount || parseFloat(manualFromAmount) <= 0) {
      setManualToAmount("");
      setManualRate(null);
      return;
    }
    if (fromWallet.currencyCode.toUpperCase() === destCurrency) {
      setManualToAmount(manualFromAmount);
      setManualRate(1);
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await getConversionQuote(userPhone, fromWallet.currencyCode, destCurrency, parseFloat(manualFromAmount));
      if (res.success) {
        setManualToAmount(Number(res.quote.buyAmount || 0).toFixed(2));
        setManualRate(Number(res.quote.rate || 0));
      } else {
        setManualToAmount("");
        setManualRate(null);
      }
    } catch {
      setManualToAmount("");
      setManualRate(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [needsAmountEntry, fromWallet, manualFromAmount, destCurrency, userPhone]);

  useEffect(() => {
    const t = setTimeout(fetchManualQuote, 400);
    return () => clearTimeout(t);
  }, [fetchManualQuote]);

  // Effective amounts: whatever was passed in via params, or what the user just entered.
  const effectiveFromAmount = needsAmountEntry ? manualFromAmount : params.fromAmount;
  const effectiveToAmount = needsAmountEntry ? manualToAmount : params.toAmount;
  const effectiveFromWalletId = needsAmountEntry ? (fromWallet ? String(fromWallet.id) : "") : params.fromWalletId;
  const effectiveFromCurrency = needsAmountEntry ? (fromWallet?.currencyCode || "") : params.fromCurrency;
  const effectiveRate = needsAmountEntry ? (manualRate ? String(manualRate) : "") : (params.rate || "");

  useEffect(() => {
    if (!activeMethod) return;
    setValues(getInitialValues(activeMethod));
    setErrors({}); setTouched({});
    setSelectedBank(null); setSelectedNetwork(null);
    setNameVerified(false); setNameVerifyAttempted(false);
  }, [methodIdx, destCurrency]);

  useEffect(() => {
    if (activeMethod?.method !== "bank") return;
    const cc = corridor?.countryCode || params.countryCode || "";
    if (!cc) return;
    setBanksLoading(true);
    getBanksByCountry(cc).then(setBanks).catch(() => setBanks([])).finally(() => setBanksLoading(false));
  }, [activeMethod?.method, corridor?.countryCode, params.countryCode]);

  const triggerVerify = useCallback(async (acct: string, bank: Bank | null) => {
    if (!activeMethod?.canVerify || !bank || acct.replace(/\s/g, "").length < 8) return;
    setVerifying(true); setNameVerified(false); setNameVerifyAttempted(true);
    try {
      const res = await verifyBankAccount(acct.replace(/\s/g, ""), bank.code, corridor?.countryCode);
      if (res.success && res.accountName) {
        setValues((prev) => ({ ...prev, accountName: res.accountName! }));
        setNameVerified(true);
      } else if (res.code === "UNSUPPORTED") {
        setNameVerified(false); // Graceful manual fallback
      } else if (!res.success) {
        Alert.alert("Verification Failed", res.message || "Could not verify this account.", [{ text: "OK" }]);
      }
    } catch { /* silent fallback */ }
    finally { setVerifying(false); }
  }, [activeMethod?.canVerify, corridor?.countryCode]);

  const handleAccountChange = useCallback((val: string) => {
    setValues((prev) => ({ ...prev, accountNumber: val, accountName: "" }));
    setNameVerified(false); setNameVerifyAttempted(false);
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    verifyTimerRef.current = setTimeout(() => triggerVerify(val, selectedBank), 700);
  }, [selectedBank, triggerVerify]);

  const handleBankSelect = useCallback((bank: Bank) => {
    setSelectedBank(bank); setBankPickerOpen(false);
    setValues((prev) => ({ ...prev, bankCode: bank.code, accountName: "" }));
    setNameVerified(false); setNameVerifyAttempted(false);
    const acct = values.accountNumber || "";
    if (acct.length >= 8) setTimeout(() => triggerVerify(acct, bank), 100);
  }, [values.accountNumber, triggerVerify]);

  const handleNetworkSelect = useCallback((network: MomoNetwork) => {
    setSelectedNetwork(network); setNetworkPickerOpen(false);
    setValues((prev) => ({ ...prev, networkCode: network.code }));
  }, []);

  const setField = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (touched[key]) {
      const field = activeMethod?.fields.find((f) => f.key === key);
      if (field) { const err = field.validate(val); setErrors((prev) => ({ ...prev, [key]: err || "" })); }
    }
  }, [activeMethod?.fields, touched]);

  const onBlur = useCallback((key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    const field = activeMethod?.fields.find((f) => f.key === key);
    if (field) { const err = field.validate(values[key] || ""); setErrors((prev) => ({ ...prev, [key]: err || "" })); }
  }, [activeMethod?.fields, values]);

  const handleContinue = useCallback(() => {
    if (!activeMethod || !corridor) return;

    if (needsAmountEntry) {
      if (!fromWallet) {
        Alert.alert("Select a wallet", "Please choose which wallet to send from.");
        return;
      }
      if (!manualFromAmount || parseFloat(manualFromAmount) <= 0) {
        Alert.alert("Enter an amount", "Please enter how much you'd like to send.");
        return;
      }
      if (!manualToAmount || parseFloat(manualToAmount) <= 0) {
        Alert.alert("Quote not ready", "Please wait for the conversion rate.");
        return;
      }
    }

    // Known-recipient path (arrived via "Send to this recipient") — their
    // bank details are already on file, so skip corridor-method selection
    // and the bank-detail form entirely and go straight to confirm.
    if (prefilled) {
      const prefilledIsInterac = prefilled.payoutMethod === "interac" || destCurrency === "CAD";
      const isIbanCorridor = activeMethod.routingFieldType === "iban_only";
      // The saved-recipient record only has one generic "bankCode" field for
      // whatever routing/SWIFT value applies — route it into whichever
      // granular field executeCurrencyCloudWithdrawal's bank_details
      // construction actually reads from for this corridor. Without this,
      // a prefilled CurrencyCloud recipient's bank_details.bankCode came
      // through empty regardless of what was actually saved.
      const routingValue = prefilled.bankCode || "";

      // This corridor requires a routing code (ABA/sort code/BSB) — block
      // here, the same way the manual-entry form itself would, rather than
      // letting an incomplete saved record's empty value reach the actual
      // transfer call with no validation at all. Reuses the exact same
      // field validator the form uses, so the message matches.
      if (!isIbanCorridor && activeMethod.routingFieldType) {
        const routingFieldDef = activeMethod.fields.find(
          (f) => f.key === "routingNumber" || f.key === "sortCode" || f.key === "bsbCode"
        );
        const routingErr = routingFieldDef?.validate(routingValue);
        if (routingErr) {
          Alert.alert(
            "Missing bank details",
            `This saved recipient is missing their ${routingFieldDef?.label || "routing code"}. Please re-add them with full bank details.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Add new recipient",
                onPress: () =>
                  router.push({
                    pathname: "/recipientnew" as any,
                    params: { destCurrency, countryCode: corridor.countryCode, countryName: corridor.countryName } as any,
                  }),
              },
            ]
          );
          return;
        }
      }

      const recipientPayload = {
        accountName: prefilled.accountName || "",
        // IBAN corridors keep the account identifier in `iban`, not
        // `accountNumber` (see the matching fix in the saved-beneficiary
        // branch above) — without this branch, a prefilled IBAN-corridor
        // recipient's account number would never reach the actual transfer.
        accountNumber: isIbanCorridor ? "" : (prefilled.accountNumber || ""),
        bankCode: prefilled.bankCode || (prefilledIsInterac ? "INTERAC" : ""),
        bankName: prefilled.bankName || (prefilledIsInterac ? "Interac e-Transfer" : ""),
        currency: destCurrency,
        countryCode: prefilled.countryCode || corridor.countryCode,
        isInterac: prefilledIsInterac,
        // This was the actual bug: defaulting to "bank" regardless of
        // corridor meant any CurrencyCloud recipient (USD/GBP/AUD/EUR/...)
        // whose saved record didn't already carry payoutMethod fell through
        // RecipientConfirmScreen.tsx's isCurrencyCloud check and got routed
        // through the Flutterwave-only execute path instead — which is
        // exactly why a GBP transfer failed with "not supported for
        // Flutterwave payouts". The corridor itself already knows its own
        // correct method; there's no reason to guess "bank" here.
        payoutMethod: prefilled.payoutMethod || (prefilledIsInterac ? "interac" : activeMethod.method),
        payoutType: prefilledIsInterac ? "interac" : toPayoutType(activeMethod.method, activeMethod.routingFieldType),
        networkCode: prefilled.networkCode || "",
        networkName: prefilled.networkName || "",
        nameVerified: !!prefilled.nameVerified,
        beneficiaryId: prefilled.id,
        bankCountry: prefilled.countryCode || corridor.countryCode,
        iban: isIbanCorridor ? (prefilled.accountNumber || "") : "",
        bicSwift: isIbanCorridor ? routingValue : "",
        routingFieldType: activeMethod.routingFieldType ?? null,
        routingNumber: activeMethod.routingFieldType === "aba" ? routingValue : "",
        sortCode: activeMethod.routingFieldType === "sort_code" ? routingValue : "",
        bsbCode: activeMethod.routingFieldType === "bsb_code" ? routingValue : "",
      };
      router.push({
        pathname: "/recipientconfirm" as any,
        params: {
          recipient: JSON.stringify(recipientPayload),
          destCurrency,
          fromWalletId: needsAmountEntry ? (fromWallet ? String(fromWallet.id) : "") : params.fromWalletId,
          fromCurrency: needsAmountEntry ? (fromWallet?.currencyCode || "") : params.fromCurrency,
          fromAmount: needsAmountEntry ? manualFromAmount : params.fromAmount,
          toAmount: needsAmountEntry ? manualToAmount : params.toAmount,
          rate: needsAmountEntry ? (manualRate ? String(manualRate) : "") : (params.rate || ""),
        } as any,
      });
      return;
    }

    // Saved-beneficiary path: skip bank-detail field validation entirely, just
    // require that a beneficiary has actually been picked.
    if (isCurrencyCloud && useSavedBeneficiary) {
      if (!selectedBeneficiary) {
        Alert.alert("Choose a beneficiary", "Please select a saved beneficiary to continue.");
        return;
      }
      const isIbanCorridor = activeMethod.routingFieldType === "iban_only";

      // Same gate as the prefilled-recipient branch above — block here if
      // this saved beneficiary is missing the routing code this corridor
      // actually requires, rather than letting an empty value reach the
      // transfer call unvalidated.
      if (!isIbanCorridor && activeMethod.routingFieldType) {
        const routingFieldDef = activeMethod.fields.find(
          (f) => f.key === "routingNumber" || f.key === "sortCode" || f.key === "bsbCode"
        );
        const routingErr = routingFieldDef?.validate(selectedBeneficiary.bankCode || "");
        if (routingErr) {
          Alert.alert(
            "Missing bank details",
            `This saved beneficiary is missing their ${routingFieldDef?.label || "routing code"}. Please add them again with full bank details.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Add new recipient",
                onPress: () => { setUseSavedBeneficiary(false); setSelectedBeneficiary(null); },
              },
            ]
          );
          return;
        }
      }

      const recipientPayload = {
        accountName: selectedBeneficiary.accountName || "",
        // The saved-recipient record only has one generic account-number
        // field — route it to whichever local field this corridor actually
        // expects (RecipientConfirmScreen reads accountNumber vs. iban
        // separately depending on corridor type).
        accountNumber: isIbanCorridor ? "" : (selectedBeneficiary.accountNumber || ""),
        bankCode: selectedBeneficiary.bankCode || "",
        bankName: selectedBeneficiary.bankName || "",
        currency: destCurrency,
        countryCode: corridor.countryCode,
        isInterac: false,
        payoutMethod: activeMethod.method,
        payoutType: toPayoutType(activeMethod.method, activeMethod.routingFieldType),
        networkCode: "",
        networkName: "",
        nameVerified: !!selectedBeneficiary.nameVerified,
        beneficiaryId: selectedBeneficiary.id,
        bankCountry: selectedBeneficiary.countryCode || corridor.countryCode,
        iban: isIbanCorridor ? (selectedBeneficiary.accountNumber || "") : "",
        bicSwift: selectedBeneficiary.bankCode || "",
        routingFieldType: activeMethod.routingFieldType ?? null,
        routingNumber: "",
        sortCode: "",
        bsbCode: "",
      };
      router.push({
        pathname: "/recipientconfirm" as any,
        params: {
          destCurrency,
          fromWalletId: effectiveFromWalletId,
          fromCurrency: effectiveFromCurrency,
          fromAmount: effectiveFromAmount,
          toAmount: effectiveToAmount,
          rate: effectiveRate,
          recipient: JSON.stringify(recipientPayload),
          mode: "new",
        },
      });
      return;
    }

    const allTouched = Object.fromEntries(activeMethod.fields.map((f) => [f.key, true]));
    setTouched(allTouched);
    const errs = validateCorridorFields(activeMethod, values);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    const recipientPayload = {
      accountName: values.accountName?.trim() || "",
      accountNumber: values.accountNumber?.trim() || "",
      bankCode: selectedBank?.code || getRoutingValue(activeMethod.routingFieldType, values) || values.bankCode?.trim() || "",
      bankName: selectedBank?.name || values.bankName?.trim() || "",
      currency: destCurrency,
      countryCode: corridor.countryCode,
      isInterac: activeMethod.method === "interac",
      payoutMethod: activeMethod.method,
      payoutType: toPayoutType(activeMethod.method, activeMethod.routingFieldType),
      networkCode: selectedNetwork?.code || values.networkCode || "",
      networkName: selectedNetwork?.name || "",
      nameVerified,
      // CurrencyCloud bank-detail fields (no-ops for non-currencycloud corridors).
      // bankCountry comes straight from the corridor, not user input — each
      // corridor is already scoped to one specific country, so there's
      // nothing for a free-text field to add except a chance to type
      // something the backend's ISO 3166-1 Alpha-2 check rejects.
      beneficiaryId: "",
      bankCountry: corridor.countryCode,
      iban: values.iban?.trim() || "",
      bicSwift: values.bicSwift?.trim() || "",
      routingFieldType: activeMethod.routingFieldType ?? null,
      routingNumber: values.routingNumber?.trim() || "",
      sortCode: values.sortCode?.trim() || "",
      bsbCode: values.bsbCode?.trim() || "",
    };
    router.push({
      pathname: "/recipientconfirm" as any,
      params: {
        destCurrency,
        fromWalletId: effectiveFromWalletId,
        fromCurrency: effectiveFromCurrency,
        fromAmount: effectiveFromAmount,
        toAmount: effectiveToAmount,
        rate: effectiveRate,
        recipient: JSON.stringify(recipientPayload),
        mode: "new",
      },
    });
  }, [
    activeMethod, corridor, values, selectedBank, selectedNetwork, nameVerified, destCurrency, router,
    needsAmountEntry, fromWallet, manualFromAmount, manualToAmount,
    effectiveFromWalletId, effectiveFromCurrency, effectiveFromAmount, effectiveToAmount, effectiveRate,
    isCurrencyCloud, useSavedBeneficiary, selectedBeneficiary, prefilled, params,
  ]);

  if (!corridor || !activeMethod) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <View style={s.header}>
          <BackButton onPress={() => router.back()} />
          <AppText style={[s.headerTitle, { flex: 1, textAlign: "center" }]}>New Recipient</AppText>
          <View style={{ width: 34 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
          <AppText style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 12 }}>{destCurrency} not yet supported</AppText>
          <AppText style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 8 }}>We are working on adding more corridors.</AppText>
          <Pressable onPress={() => router.back()} style={[s.continueBtn, { marginTop: 24 }]}><AppText style={s.continueBtnText}>Go Back</AppText></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isNameEditable = !nameVerified || !activeMethod.canVerify;
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={s.header}>
        <BackButton onPress={() => router.back()} />
        <View style={s.headerCenter}>
          <CountryFlag currencyCode={destCurrency} size="sm" />
          <AppText style={s.headerTitle}>{corridor.countryName}</AppText>
        </View>
        <View style={{ width: 34 }} />
      </View>
      {needsAmountEntry ? (
        <View style={s.amountCard}>
          <AppText style={s.amountCardLabel}>You send</AppText>
          <View style={s.amountRow}>
            <AppTextInput
              value={manualFromAmount}
              onChangeText={setManualFromAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
              style={s.amountInput}
            />
            <Pressable onPress={() => setShowWalletPicker(true)} style={s.walletPill}>
              {fromWallet ? <CountryFlag currencyCode={fromWallet.currencyCode} size="sm" /> : null}
              <AppText style={s.walletPillText}>{fromWallet?.currencyCode || "Select"}</AppText>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </Pressable>
          </View>
          {!!fromWallet && (
            <AppText style={s.amountCardBalance}>Balance: {fromWallet.formattedBalance} {fromWallet.currencyCode}</AppText>
          )}
          <View style={s.amountDivider} />
          <AppText style={s.amountCardLabel}>Recipient gets</AppText>
          <View style={s.amountRow}>
            {quoteLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <AppText style={s.amountReceiveText}>{manualToAmount || "0.00"} {destCurrency}</AppText>
            )}
          </View>
        </View>
      ) : (
        <View style={s.summaryBar}>
          <AppText style={s.summaryLabel}>Sending</AppText>
          <AppText style={s.summaryAmount}>{params.toAmount} {destCurrency}</AppText>
        </View>
      )}
      {!prefilled && corridor.methods.length > 1 && (
        <View style={s.tabsRow}>
          {corridor.methods.map((m, i) => <MethodTab key={m.method} method={m} active={i === methodIdx} onPress={() => setMethodIdx(i)} />)}
        </View>
      )}

      {!prefilled && isCurrencyCloud && (
        <View style={s.ccToggleRow}>
          <Pressable
            style={[s.ccToggleBtn, !useSavedBeneficiary && s.ccToggleBtnActive]}
            onPress={() => { setUseSavedBeneficiary(false); setSelectedBeneficiary(null); }}
          >
            <AppText style={[s.ccToggleText, !useSavedBeneficiary && s.ccToggleTextActive]}>Enter bank details</AppText>
          </Pressable>
          <Pressable
            style={[s.ccToggleBtn, useSavedBeneficiary && s.ccToggleBtnActive]}
            onPress={() => { setUseSavedBeneficiary(true); setBeneficiaryPickerOpen(true); }}
          >
            <AppText style={[s.ccToggleText, useSavedBeneficiary && s.ccToggleTextActive]}>Use saved beneficiary</AppText>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {prefilled ? (
          <View style={s.beneficiaryCard}>
            <RecipientAvatar
              name={prefilled.accountName || "?"}
              currencyCode={destCurrency}
              countryCode={prefilled.countryCode || corridor.countryCode}
              isExxsend={prefilled.payoutMethod === "exxsend" || prefilled.bankCode === "EXXSEND"}
              photoUrl={prefilled.avatarUrl}
              size={46}
            />
            <View style={{ flex: 1 }}>
              <AppText style={s.beneficiaryName}>{prefilled.accountName}</AppText>
              <AppText style={s.beneficiaryMeta}>
                {prefilled.bankName || "Bank"}
                {prefilled.accountNumber ? ` · •••• ${prefilled.accountNumber.slice(-4)}` : ""}
              </AppText>
            </View>
          </View>
        ) : isCurrencyCloud && useSavedBeneficiary ? (
          selectedBeneficiary ? (
            <Pressable style={s.beneficiaryCard} onPress={() => setBeneficiaryPickerOpen(true)}>
              <RecipientAvatar
                name={selectedBeneficiary.accountName || "?"}
                currencyCode={destCurrency}
                countryCode={selectedBeneficiary.countryCode || corridor.countryCode}
                size={46}
              />
              <View style={{ flex: 1 }}>
                <AppText style={s.beneficiaryName}>{selectedBeneficiary.accountName}</AppText>
                <AppText style={s.beneficiaryMeta}>
                  {selectedBeneficiary.bankName || "Bank"}
                  {selectedBeneficiary.accountNumber ? ` · •••• ${selectedBeneficiary.accountNumber.slice(-4)}` : ""}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ) : (
            <Pressable style={s.beneficiaryEmptyCard} onPress={() => setBeneficiaryPickerOpen(true)}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
              <AppText style={s.beneficiaryEmptyText}>Choose a saved beneficiary</AppText>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          )
        ) : (
        <>
        {activeMethod.fields.map((field) => {
          if (field.key === "bankCode") {
            return (
              <View key={field.key} style={s.fieldWrap}>
                <AppText style={s.fieldLabel}>{field.label}</AppText>
                <Pressable onPress={() => setBankPickerOpen(true)} style={[s.inputBox, !!errors.bankCode && s.inputBoxErr]}>
                  <AppText style={[s.input, !selectedBank && { color: colors.muted }]}>{selectedBank?.name || field.placeholder}</AppText>
                  {banksLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-down" size={16} color={colors.muted} />}
                </Pressable>
                {!!errors.bankCode && <AppText style={s.fieldError}>{errors.bankCode}</AppText>}
              </View>
            );
          }
          if (field.key === "networkCode") {
            return (
              <View key={field.key} style={s.fieldWrap}>
                <AppText style={s.fieldLabel}>{field.label}</AppText>
                <Pressable onPress={() => setNetworkPickerOpen(true)} style={[s.inputBox, !!errors.networkCode && s.inputBoxErr]}>
                  <AppText style={[s.input, !selectedNetwork && { color: colors.muted }]}>{selectedNetwork?.name || field.placeholder}</AppText>
                  <Ionicons name="chevron-down" size={16} color={colors.muted} />
                </Pressable>
                {!!errors.networkCode && <AppText style={s.fieldError}>{errors.networkCode}</AppText>}
              </View>
            );
          }
          if (field.key === "accountNumber") {
            return (
              <FieldInput key={field.key} field={field} value={values.accountNumber || ""} onChange={handleAccountChange} onBlur={() => onBlur("accountNumber")} error={touched.accountNumber ? errors.accountNumber : undefined} loading={verifying} />
            );
          }
          if (field.key === "accountName") {
            return (
              <View key={field.key}>
                <FieldInput field={field} value={values.accountName || ""} onChange={(v) => setField("accountName", v)} onBlur={() => onBlur("accountName")} error={touched.accountName ? errors.accountName : undefined} editable={isNameEditable} loading={verifying && activeMethod.canVerify} />
                {nameVerified && (
                  <View style={s.verifiedBadge}><Ionicons name="checkmark-circle" size={14} color={colors.green} /><AppText style={s.verifiedText}>Name verified by bank</AppText></View>
                )}
                {nameVerifyAttempted && !nameVerified && !verifying && activeMethod.canVerify && (
                  <View style={s.manualBadge}><Ionicons name="information-circle-outline" size={14} color={colors.muted} /><AppText style={s.manualText}>Auto-verify unavailable — enter name manually</AppText></View>
                )}
              </View>
            );
          }
          return <FieldInput key={field.key} field={field} value={values[field.key] || ""} onChange={(v) => setField(field.key, v)} onBlur={() => onBlur(field.key)} error={touched[field.key] ? errors[field.key] : undefined} />;
        })}
        </>
        )}
        <Pressable onPress={handleContinue} style={({ pressed }) => [s.continueBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="arrow-forward" size={16} color={colors.actionText} style={{ marginRight: 6 }} />
          <AppText style={s.continueBtnText}>Continue</AppText>
        </Pressable>
        <View style={{ height: 24 }} />
      </ScrollView>
      <BankPicker visible={bankPickerOpen} banks={banks} loading={banksLoading} searchQuery={bankSearch} onSearch={setBankSearch} onSelect={handleBankSelect} onClose={() => setBankPickerOpen(false)} selected={selectedBank} />
      {activeMethod.networks && <NetworkPicker visible={networkPickerOpen} networks={activeMethod.networks} onSelect={handleNetworkSelect} onClose={() => setNetworkPickerOpen(false)} selected={selectedNetwork} />}
      {isCurrencyCloud && (
        <BeneficiaryPickerModal
          visible={beneficiaryPickerOpen}
          currency={destCurrency}
          selected={selectedBeneficiary}
          onClose={() => setBeneficiaryPickerOpen(false)}
          onSelect={(b) => { setSelectedBeneficiary(b); setBeneficiaryPickerOpen(false); }}
          onAddNew={() => { setUseSavedBeneficiary(false); setSelectedBeneficiary(null); setBeneficiaryPickerOpen(false); }}
        />
      )}
      {needsAmountEntry && (
        <CurrencyPickerModal
          visible={showWalletPicker}
          onClose={() => setShowWalletPicker(false)}
          wallets={wallets}
          selected={fromWallet}
          onSelect={(w) => { setFromWallet(w); setShowWalletPicker(false); }}
          title="Send From"
        />
      )}
    </SafeAreaView>
  );
}
function makeLocalStyles(colors: any) {
  return StyleSheet.create({

  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  headerTitle: { ...TYPE.subtitle, color: colors.text },
  summaryBar: { backgroundColor: colors.primaryLight, paddingHorizontal: SCREEN_PADDING, paddingVertical: SPACE.md - 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { fontSize: 12, color: colors.primaryDark, fontWeight: "600" },
  summaryAmount: { fontSize: 16, fontWeight: "700", color: colors.primaryDark },
  amountCard: { backgroundColor: colors.card, marginHorizontal: SPACE.lg, marginTop: SPACE.md, borderRadius: RADIUS.md, padding: SPACE.lg, ...GLASS_BORDER, ...CARD_SHADOW },
  amountCardLabel: { fontSize: 12, color: colors.muted, fontWeight: "600", marginBottom: SPACE.sm },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amountInput: { flex: 1, fontSize: 24, fontWeight: "700", color: colors.text, paddingVertical: 4 },
  amountReceiveText: { fontSize: 20, fontWeight: "700", color: colors.primaryDark },
  walletPill: { flexDirection: "row", alignItems: "center", gap: SPACE.xs + 2, backgroundColor: colors.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  walletPillText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  amountCardBalance: { fontSize: 12, color: colors.muted, fontWeight: "500", marginTop: SPACE.sm },
  amountDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginVertical: SPACE.lg - 2 },
  tabsRow: { flexDirection: "row", padding: SPACE.md, gap: SPACE.sm, backgroundColor: colors.card },
  ccToggleRow: { flexDirection: "row", gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.xs, backgroundColor: colors.card },
  ccToggleBtn: { flex: 1, paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.sm, alignItems: "center", backgroundColor: colors.bgTertiary },
  ccToggleBtnActive: { backgroundColor: colors.primaryLight },
  ccToggleText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  ccToggleTextActive: { color: colors.primary, fontWeight: "700" },
  beneficiaryCard: { flexDirection: "row", alignItems: "center", gap: SPACE.md, backgroundColor: colors.card, borderRadius: RADIUS.md, padding: SPACE.lg, marginTop: SPACE.lg, ...GLASS_BORDER, ...CARD_SHADOW },
  beneficiaryEmptyCard: { flexDirection: "row", alignItems: "center", gap: SPACE.sm + 2, backgroundColor: colors.primaryLight, borderRadius: RADIUS.md, padding: SPACE.lg, marginTop: SPACE.lg },
  beneficiaryEmptyText: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.primary },
  avatar: { width: 46, height: 46, borderRadius: RADIUS.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  beneficiaryName: { fontSize: 15, fontWeight: "700", color: colors.text },
  beneficiaryMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.sm, backgroundColor: colors.bgTertiary },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  tabTextActive: { color: "#FFFFFF", fontWeight: "700" },
  body: { padding: SCREEN_PADDING },
  fieldWrap: { marginBottom: SPACE.lg },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: SPACE.sm },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", ...GLASS_BORDER_SUBTLE, ...CARD_SHADOW, borderRadius: RADIUS.sm + 2, paddingHorizontal: SPACE.md + 2, height: 52 },
  inputBoxErr: { borderWidth: 1.5, borderColor: colors.red },
  inputBoxDisabled: { backgroundColor: colors.primaryLight },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text, padding: 0 },
  fieldError: { fontSize: 12, color: colors.red, fontWeight: "600", marginTop: 5 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5, paddingHorizontal: SPACE.md, paddingVertical: 5, backgroundColor: colors.greenSoft, borderRadius: RADIUS.xs, alignSelf: "flex-start" },
  verifiedText: { fontSize: 12, color: colors.green, fontWeight: "700" },
  manualBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  manualText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  continueBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.actionBg, borderRadius: RADIUS.md, paddingVertical: SPACE.lg + 1, marginTop: SPACE.xs },
  continueBtnText: { color: colors.actionText, fontSize: 15, fontWeight: "700" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingBottom: SPACE.xxxl, overflow: "hidden" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: SPACE.md - 2 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, paddingVertical: SPACE.md + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  sheetClose: { width: 30, height: 30, borderRadius: RADIUS.full, backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" },
  sheetSearch: { flexDirection: "row", alignItems: "center", marginHorizontal: SPACE.lg, marginVertical: SPACE.sm + 2, backgroundColor: "#FFFFFF", ...GLASS_BORDER_SUBTLE, ...CARD_SHADOW, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, height: 42 },
  bankRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, paddingVertical: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  bankRowSelected: { backgroundColor: colors.primaryLight },
  bankName: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
  });
}

