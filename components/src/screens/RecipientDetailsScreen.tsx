import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bank,
  COUNTRY_NAMES,
  CURRENCY_TO_COUNTRY,
  getBanksByCountry,
  getCurrencySymbol,
  verifyBankAccount,
} from "../../../api/flutterwave";
import { saveRecipientToDB } from "../../../api/sync";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { useStyles } from "../../../theme/styles";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BottomSheet from "../../BottomSheet";

// ✅ Email validation regex (Interac)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface HeaderProps {
  title: string;
}
function Header({ title }: HeaderProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();
  return (
    <View style={styles.flowHeader}>
      <Pressable style={styles.iconBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </Pressable>
      <AppText style={styles.flowHeaderTitle}>{title}</AppText>
      <View style={{ width: 34 }} />
    </View>
  );
}

export default function RecipientDetailsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();

  // ✅ read params (optional) so screen supports CAD Interac + bank transfer
  const params = useLocalSearchParams<{
    destCurrency?: string;
    fromWalletId?: string;
    fromCurrency?: string;
    fromAmount?: string;
    toAmount?: string;
    rate?: string;
    countryCode?: string;
    countryName?: string;
  }>();

  const destCurrency = (params.destCurrency || "NGN").toUpperCase();
  const isInterac = destCurrency === "CAD";
  const countryCode = isInterac
    ? "CA"
    : (params.countryCode || CURRENCY_TO_COUNTRY[destCurrency] || "NG").toUpperCase();
  const countryName = isInterac ? "Canada" : params.countryName || COUNTRY_NAMES[countryCode] || countryCode;
  const isNigeria = countryCode === "NG";
  const symbol = getCurrencySymbol(destCurrency);
  const toAmount = params.toAmount || "0";

  // ✅ user phone (for saving to DB)
  const [userPhone, setUserPhone] = useState("");

  // Bank picker / bank transfer state
  const [bankOpen, setBankOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [account, setAccount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // ✅ Interac state (CAD)
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");

  // Common
  const [save, setSave] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ✅ Banks data (dynamic; not used for Interac)
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(!isInterac);
  const [bankError, setBankError] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");

  // ✅ Load user phone
  useEffect(() => {
    AsyncStorage.getItem("user_phone").then((phone) => {
      if (phone) setUserPhone(phone);
    });
  }, []);

  // ✅ Load banks for destination country (skip for Interac)
  useEffect(() => {
    if (isInterac) {
      setBanks([]);
      setBanksLoading(false);
      return;
    }

    const loadBanks = async () => {
      setBanksLoading(true);
      setBankError(false);
      try {
        const list = await getBanksByCountry(countryCode);
        if (Array.isArray(list) && list.length > 0) {
          setBanks(list);
          setBankError(false);
        } else {
          setBankError(true);
          setBanks([]);
        }
      } catch (e) {
        console.error(`Failed to load ${countryName} banks:`, e);
        setBankError(true);
        setBanks([]);
      } finally {
        setBanksLoading(false);
      }
    };

    loadBanks();
  }, [countryCode, countryName, isInterac]);

  const retryLoadBanks = useCallback(() => {
    if (!isInterac && countryCode) {
      setBanksLoading(true);
      setBankError(false);
      getBanksByCountry(countryCode)
        .then(list => {
          setBanks(Array.isArray(list) && list.length > 0 ? list : []);
          if (!Array.isArray(list) || list.length === 0) setBankError(true);
        })
        .catch(() => setBankError(true))
        .finally(() => setBanksLoading(false));
    }
  }, [isInterac, countryCode]);

  // ✅ Filter banks (search)
  const filteredBanks = useMemo(() => {
    if (banksLoading) return [];
    const q = bankSearchQuery.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => (b.name || "").toLowerCase().includes(q));
  }, [banks, banksLoading, bankSearchQuery]);

  // ✅ Reset verification when bank/account changes (bank flow only)
  useEffect(() => {
    if (isInterac) return;
    setIsVerified(false);
    if (isNigeria) setAccountName("");
  }, [selectedBank?.code, account, isNigeria, isInterac]);

  // ✅ Verify bank account (Nigeria via API; others manual confirm)
  const handleVerifyAccount = useCallback(async () => {
    if (!selectedBank) return;

    // Non-NG: no API verification — just confirm name exists
    if (!isNigeria) {
      if (accountName.trim()) setIsVerified(true);
      return;
    }

    // NG requires 10 digits
    if (account.length < 10) return;

    setVerifying(true);
    setIsVerified(false);

    try {
      const result = await verifyBankAccount(account, selectedBank.code);
      if (result?.success && result?.accountName) {
        setAccountName(result.accountName);
        setIsVerified(true);
      }
    } catch (e) {
      console.error("Verification error:", e);
    } finally {
      setVerifying(false);
    }
  }, [selectedBank, account, isNigeria, accountName]);

  // ✅ Auto-verify NG at 10 digits
  useEffect(() => {
    if (isInterac) return;
    if (isNigeria && account.length === 10 && selectedBank && !isVerified && !verifying) {
      handleVerifyAccount();
    }
  }, [account, selectedBank, isVerified, verifying, isNigeria, isInterac, handleVerifyAccount]);

  // ✅ Ready rules
  const isReady = isInterac
    ? EMAIL_REGEX.test(recipientEmail.trim()) && recipientName.trim().length > 0
    : !!selectedBank && account.length >= 10 && (isNigeria ? isVerified : accountName.trim().length > 0);

  // ✅ Confirmation display values
  const displayName = isInterac ? recipientName.trim() : accountName.trim();
  const displayAccount = isInterac ? recipientEmail.trim() : account;
  const displayBank = isInterac ? "Interac e-Transfer" : selectedBank?.name || "";
  const initials = displayName
    ? displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("")
    : "??";

  const handleContinue = () => {
    if (!isReady) return;
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    // ✅ Build recipient payload
    const recipientData = isInterac
      ? {
        accountName: recipientName.trim(),
        accountNumber: recipientEmail.trim().toLowerCase(), // email in accountNumber field
        bankCode: "INTERAC",
        bankName: "Interac e-Transfer",
        currency: destCurrency,
        countryCode: "CA",
        isInterac: true,
        payoutType: "interac",
      }
      : {
        accountName: accountName.trim(),
        accountNumber: account,
        bankCode: selectedBank!.code,
        bankName: selectedBank!.name,
        currency: destCurrency,
        countryCode,
        isInterac: false,
        payoutType: "bank",
      };

    // ✅ Save recipient to DB if toggle is on
    if (save && userPhone) {
      try {
        await saveRecipientToDB({ phone: userPhone, ...recipientData });
      } catch (e) {
        console.error("Failed to save recipient:", e);
      }
    }

    setConfirmOpen(false);

    router.push({
      pathname: "/reviewdetails" as any,
      params: {
        ...params,
        name: recipientData.accountName,
        bank: recipientData.bankName,
        account: recipientData.accountNumber,
        recipient: JSON.stringify(recipientData),
        mode: "new",
      } as any,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <Header title={isInterac ? "Interac recipient details" : "Enter recipient details"} />

      <View style={{ paddingHorizontal: 16, paddingTop: 12, flex: 1 }}>
        {/* ✅ Transfer summary (keeps your screen styling vibe) */}
        <View
          style={{
            backgroundColor: "#ECFDF5",
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <AppText style={{ fontSize: 13, color: "#065F46" }}>Sending</AppText>
          <AppText style={{ fontSize: 20, fontWeight: "600", color: "#065F46" }}>
            {symbol}
            {parseFloat(toAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            {destCurrency}
          </AppText>
        </View>

        {/* ✅ Interac vs Bank transfer form */}
        {isInterac ? (
          <>
            {/* Interac info banner */}
            <View
              style={{
                backgroundColor: "#DBEAFE",
                borderRadius: 10,
                padding: 12,
                marginBottom: 18,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <AppText style={{ fontSize: 16, marginRight: 10 }}>📧</AppText>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 14, fontWeight: "600", color: "#1E40AF" }}>
                  Interac e-Transfer
                </AppText>
                <AppText style={{ fontSize: 12, color: "#1E40AF", marginTop: 2 }}>
                  The recipient will receive an email to deposit funds into their Canadian bank.
                </AppText>
              </View>
            </View>

            {/* Recipient email */}
            <AppText style={styles.inputLabel}>Recipient email</AppText>
            <View style={styles.textField}>
              <AppTextInput
                value={recipientEmail}
                onChangeText={setRecipientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="recipient@email.com"
                placeholderTextColor={colors.muted}
                style={styles.textFieldInput}
              />
              {EMAIL_REGEX.test(recipientEmail.trim()) && (
                <AppText style={{ color: colors.primary, fontSize: 16, marginLeft: 8 }}>✓</AppText>
              )}
            </View>

            {/* Recipient name */}
            <AppText style={[styles.inputLabel, { marginTop: 18 }]}>Recipient name</AppText>
            <View style={styles.textField}>
              <AppTextInput
                value={recipientName}
                onChangeText={setRecipientName}
                autoCapitalize="words"
                placeholder="Enter recipient's full name"
                placeholderTextColor={colors.muted}
                style={styles.textFieldInput}
              />
            </View>
          </>
        ) : (
          <>
            {/* Bank name */}
            <AppText style={styles.inputLabel}>Bank name</AppText>
            <Pressable style={styles.dropdown} onPress={() => setBankOpen(true)} disabled={banksLoading}>
              <AppText style={[styles.dropdownText, !selectedBank && { color: "#9B9B9B" }]}>
                {banksLoading ? "Loading banks..." : selectedBank?.name || `Select ${countryName} bank`}
              </AppText>
              <AppText style={styles.dropdownArrow}>⌄</AppText>
            </Pressable>

            {/* Account number */}
            <AppText style={[styles.inputLabel, { marginTop: 18 }]}>Account number</AppText>
            <View style={styles.textField}>
              <AppTextInput
                value={account}
                onChangeText={(text) => setAccount(text.replace(/\D/g, ""))}
                keyboardType="number-pad"
                placeholder="Enter account number"
                placeholderTextColor={colors.muted}
                style={[styles.textFieldInput, { flex: 1 }]}
                maxLength={20}
              />
              {verifying && <ActivityIndicator size="small" color={colors.primary} />}
              {isNigeria && isVerified && <AppText style={{ color: colors.primary, fontSize: 16 }}>✓</AppText>}
            </View>

            {/* Recipient name */}
            <AppText style={[styles.inputLabel, { marginTop: 18 }]}>Recipient name</AppText>
            <View style={styles.textField}>
              <AppTextInput
                value={accountName}
                onChangeText={(t) => {
                  setAccountName(t);
                  if (!isNigeria) setIsVerified(false);
                }}
                autoCapitalize="words"
                placeholder={isNigeria ? "Auto-filled after verification" : "Enter recipient name"}
                placeholderTextColor={colors.muted}
                style={styles.textFieldInput}
                editable={!isNigeria || !isVerified}
              />
            </View>

            {/* Manual confirm for non-NG */}
            {!isNigeria && account.length >= 6 && accountName.trim() && !isVerified ? (
              <Pressable
                style={[styles.outlineBtn, { marginTop: 12, width: "100%" }]}
                onPress={() => setIsVerified(true)}
              >
                <AppText style={styles.outlineBtnText}>✓ Confirm recipient details</AppText>
              </Pressable>
            ) : null}
          </>
        )}

        {/* Save beneficiary toggle (unchanged) */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setSave(!save)}
            style={[styles.toggle, save ? styles.toggleOn : styles.toggleOff]}
          >
            <View style={[styles.toggleDot, save ? { marginLeft: 18 } : { marginLeft: 2 }]} />
          </Pressable>
          <AppText style={styles.toggleText}>Save beneficiary</AppText>
        </View>
      </View>

      {/* Continue button (unchanged) */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
        <Pressable
          onPress={handleContinue}
          style={[styles.bigBottomBtn, !isReady && { backgroundColor: "#DCDCDC" }]}
          disabled={!isReady}
        >
          <AppText style={[styles.bigBottomBtnText, !isReady && { color: "#B3B3B3" }]}>Continue</AppText>
        </Pressable>
      </View>

      {/* Bank picker sheet (unchanged UI, but now uses API banks + search) */}
      {!isInterac && (
        <BottomSheet visible={bankOpen} onClose={() => setBankOpen(false)}>
          <AppText style={styles.sheetTitle}>Select bank</AppText>

          {/* Search */}
          <View style={[styles.textField, { marginHorizontal: 16, marginBottom: 12 }]}>
            <AppTextInput
              value={bankSearchQuery}
              onChangeText={setBankSearchQuery}
              placeholder="Search banks..."
              placeholderTextColor={colors.muted}
              style={styles.textFieldInput}
              autoCapitalize="none"
            />
          </View>

          {banksLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <AppText style={{ marginTop: 10, color: "#9B9B9B" }}>Loading banks...</AppText>
            </View>
          ) : (
            <FlatList
              data={filteredBanks}
              keyExtractor={(x) => x.code}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => {
                    setSelectedBank(item);
                    setBankOpen(false);
                    setBankSearchQuery("");
                  }}
                >
                  <AppText style={{ fontWeight: "600" }}>{item.name}</AppText>
                  <AppText style={{ color: "#9B9B9B" }}>›</AppText>
                </Pressable>
              )}
              ListEmptyComponent={
                <AppText style={{ textAlign: "center", color: "#9B9B9B", marginTop: 20 }}>
                  {banks.length === 0 ? "No banks available" : "No banks found"}
                </AppText>
              }
            />
          )}
        </BottomSheet>
      )}

      {/* Confirm recipient bottom sheet (unchanged UI; now works for Interac too) */}
      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <View style={{ alignItems: "center", paddingTop: 18 }}>
          <View style={styles.confirmAvatar}>
            <AppText style={{ color: "#fff", fontWeight: "600", fontSize: 18 }}>{initials}</AppText>
          </View>
          <View style={styles.verifyBadge}>
            <AppText style={{ color: "#fff", fontWeight: "600" }}>✓</AppText>
          </View>

          <AppText style={styles.confirmTitle}>Confirm recipient details</AppText>

          <View style={styles.confirmCard}>
            <AppText style={styles.confirmName}>{displayName || "—"}</AppText>
            <AppText style={styles.confirmMeta}>
              {isInterac ? `Interac • ${displayAccount || "—"}` : `${displayBank || "—"} • ${displayAccount || "—"}`}
            </AppText>
          </View>

          <AppText style={styles.confirmHint}>Please confirm the recipient’s details before you continue</AppText>

          <Pressable style={[styles.primaryBtn, { width: "100%", marginTop: 16 }]} onPress={handleConfirm}>
            <AppText style={styles.primaryBtnText}>Continue</AppText>
          </Pressable>

          <Pressable
            style={[styles.outlineBtn, { width: "100%", marginTop: 12 }]}
            onPress={() => setConfirmOpen(false)}
          >
            <AppText style={styles.outlineBtnText}>Edit details</AppText>
          </Pressable>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
