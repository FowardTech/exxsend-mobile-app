import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  getConversionQuote,
  getUserWallets,
} from "../../../api/config";
import {
  Bank,
  getNigerianBanks,
  sendNGN,
  verifyBankAccount,
} from "../../../api/flutterwave";
import { checkLiquidity, isLiquidityLowResponse, LiquidityResult } from "../../../api/liquidity";
import CurrencyPickerModal, { Wallet } from "../../../components/CurrencyPickerModal";
import CurrencyPill from "../../../components/CurrencyPill";
import LiquidityBanner from "../../../components/LiquidityBanner";
import ScreenShell from "../../../components/ScreenShell";
import { useStyles } from "../../../theme/styles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";


// ============================================================
// Bank Picker Modal Component
// ============================================================
function BankPickerModal({
  visible,
  banks,
  banksLoading,
  onSelect,
  onClose,
  searchQuery,
  setSearchQuery,
}: {
  visible: boolean;
  banks: Bank[];
  banksLoading: boolean;
  onSelect: (bank: Bank) => void;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  if (!visible) return null;

  const filteredBanks = banksLoading
    ? []
    : banks.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%", paddingBottom: 40 }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>Select Bank</AppText>
              <Pressable onPress={onClose}>
                <AppText style={{ fontSize: 16, color: colors.muted }}>Cancel</AppText>
              </Pressable>
            </View>

            <AppTextInput
              style={styles.inputBox}
              placeholder={banksLoading ? "Loading banks..." : "Search banks..."}
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              editable={!banksLoading}
            />
          </View>

          <ScrollView style={{ paddingHorizontal: 20 }}>
            {banksLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <ActivityIndicator size="small" color={colors.muted} />
                <AppText style={{ marginTop: 10, textAlign: "center", color: colors.muted }}>
                  Loading banks…
                </AppText>
              </View>
            ) : (
              <>
                {filteredBanks.map((bank) => (
                  <Pressable
                    key={bank.code}
                    style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
                    onPress={() => {
                      onSelect(bank);
                      onClose();
                    }}
                  >
                    <AppText style={{ fontSize: 16, color: colors.text }}>{bank.name}</AppText>
                  </Pressable>
                ))}
                {filteredBanks.length === 0 && (
                  <AppText style={{ textAlign: "center", color: colors.muted, marginTop: 20 }}>
                    {banks.length === 0 ? "No banks loaded" : "No banks found"}
                  </AppText>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Saved Recipient Type
// ============================================================
export interface SavedRecipient {
  id: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  createdAt: number;
}

const SAVED_RECIPIENTS_KEY = "saved_ngn_recipients";

// Helper functions for saved recipients
async function getSavedRecipients(): Promise<SavedRecipient[]> {
  try {
    const data = await AsyncStorage.getItem(SAVED_RECIPIENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function saveRecipient(recipient: Omit<SavedRecipient, "id" | "createdAt">): Promise<void> {
  try {
    const existing = await getSavedRecipients();
    // Check for duplicates
    const duplicate = existing.find(
      (r) => r.accountNumber === recipient.accountNumber && r.bankCode === recipient.bankCode
    );
    if (duplicate) return; // Already saved

    const newRecipient: SavedRecipient = {
      ...recipient,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    await AsyncStorage.setItem(SAVED_RECIPIENTS_KEY, JSON.stringify([newRecipient, ...existing].slice(0, 20)));
  } catch (e) {
    console.error("Failed to save recipient:", e);
  }
}

// ============================================================
// Recipient Details Modal Component (for entering bank details)
// ============================================================
function RecipientDetailsModal({
  visible,
  onClose,
  onConfirm,
  banks,
  banksLoading,
  amount,
  toCurrency,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (bank: Bank, accountNumber: string, accountName: string) => void;
  banks: Bank[];
  banksLoading: boolean;
  amount: string;
  toCurrency: string;
}) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [savedRecipients, setSavedRecipients] = useState<SavedRecipient[]>([]);
  const [showNewRecipient, setShowNewRecipient] = useState(false);
  const [saveThisRecipient, setSaveThisRecipient] = useState(true);

  // Load saved recipients when modal opens
  useEffect(() => {
    if (visible) {
      getSavedRecipients().then(setSavedRecipients);
      setSelectedBank(null);
      setAccountNumber("");
      setAccountName("");
      setIsVerified(false);
      setShowNewRecipient(false);
      setSaveThisRecipient(true);
    }
  }, [visible]);

  // Auto-verify when account number is 10 digits
  useEffect(() => {
    const verifyAccount = async () => {
      if (accountNumber.length === 10 && selectedBank && !isVerified && !verifying) {
        setVerifying(true);
        setAccountName("");
        try {
          const result = await verifyBankAccount(accountNumber, selectedBank.code);
          if (result.success && result.accountName) {
            setAccountName(result.accountName);
            setIsVerified(true);
          } else {
            Alert.alert("Verification Failed", result.message || "Could not verify account.");
          }
        } catch (e) {
          Alert.alert("Error", "Failed to verify account.");
        } finally {
          setVerifying(false);
        }
      }
    };
    verifyAccount();
  }, [accountNumber, selectedBank, isVerified, verifying]);

  // Reset verification when bank changes
  useEffect(() => {
    setIsVerified(false);
    setAccountName("");
  }, [selectedBank?.code]);

  const handleSelectSavedRecipient = (recipient: SavedRecipient) => {
    const bank = banks.find((b) => b.code === recipient.bankCode);
    if (bank) {
      onConfirm(bank, recipient.accountNumber, recipient.accountName);
    } else {
      // Bank not found in list, use a fallback
      onConfirm(
        { code: recipient.bankCode, name: recipient.bankName },
        recipient.accountNumber,
        recipient.accountName
      );
    }
  };

  const handleConfirmNew = async () => {
    if (!selectedBank || !accountNumber || !accountName) return;

    // Save recipient if checkbox is checked
    if (saveThisRecipient) {
      await saveRecipient({
        accountName,
        accountNumber,
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
      });
    }

    onConfirm(selectedBank, accountNumber, accountName);
  };

  const canConfirm = isVerified && selectedBank && accountNumber.length === 10 && accountName;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: "85%" }}>
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <AppText style={{ fontSize: 20, fontWeight: "600", color: colors.text }}>
                  {showNewRecipient ? "New Recipient" : "Send To"}
                </AppText>
                <Pressable onPress={showNewRecipient ? () => setShowNewRecipient(false) : onClose}>
                  <AppText style={{ fontSize: 16, color: colors.muted }}>{showNewRecipient ? "Back" : "Cancel"}</AppText>
                </Pressable>
              </View>

              {/* Amount Summary */}
              <View style={{ backgroundColor: colors.greenSoft, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <AppText style={{ color: colors.greenDark, fontSize: 14 }}>Recipient gets</AppText>
                <AppText style={{ color: colors.greenDark, fontSize: 24, fontWeight: "600" }}>
                  {toCurrency === "NGN" ? "₦" : ""}{parseFloat(amount || "0").toLocaleString()} {toCurrency}
                </AppText>
              </View>

              {!showNewRecipient ? (
                <ScrollView style={{ maxHeight: 350 }}>
                  {/* New Recipient Button */}
                  <Pressable
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 16,
                      backgroundColor: colors.bgTertiary,
                      borderRadius: 12,
                      marginBottom: 12,
                    }}
                    onPress={() => setShowNewRecipient(true)}
                  >
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.primary,
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 12,
                    }}>
                      <AppText style={{ color: "#fff", fontSize: 20, fontWeight: "600" }}>+</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>New Recipient</AppText>
                      <AppText style={{ fontSize: 13, color: colors.muted }}>Enter bank details manually</AppText>
                    </View>
                    <AppText style={{ color: colors.muted, fontSize: 18 }}>›</AppText>
                  </Pressable>

                  {/* Saved Recipients */}
                  {savedRecipients.length > 0 && (
                    <>
                      <AppText style={{ fontSize: 14, fontWeight: "600", color: colors.muted, marginBottom: 12, marginTop: 8 }}>
                        SAVED RECIPIENTS
                      </AppText>
                      {savedRecipients.map((recipient) => (
                        <Pressable
                          key={recipient.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            padding: 14,
                            backgroundColor: "#fff",
                            borderRadius: 12,
                            marginBottom: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                          onPress={() => handleSelectSavedRecipient(recipient)}
                        >
                          <View style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: colors.primaryLight,
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 12,
                          }}>
                            <AppText style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                              {getInitials(recipient.accountName)}
                            </AppText>
                          </View>
                          <View style={{ flex: 1 }}>
                            <AppText style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                              {recipient.accountName}
                            </AppText>
                            <AppText style={{ fontSize: 13, color: colors.muted }}>
                              {recipient.bankName} • {recipient.accountNumber}
                            </AppText>
                          </View>
                          <AppText style={{ fontSize: 18 }}>🇳🇬</AppText>
                        </Pressable>
                      ))}
                    </>
                  )}

                  {savedRecipients.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 24 }}>
                      <Ionicons name="people-outline" size={36} color={colors.muted} style={{ marginBottom: 12 }} />
                      <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.textSecondary }}>No saved recipients</AppText>
                      <AppText style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4 }}>
                        Add a new recipient to get started
                      </AppText>
                    </View>
                  )}
                </ScrollView>
              ) : (
                <>
                  {/* Bank Selection */}
                  <AppText style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginBottom: 8 }}>
                    Select Bank
                  </AppText>
                  <Pressable
                    style={[styles.inputBox, { marginBottom: 16 }]}
                    onPress={() => setShowBankPicker(true)}
                  >
                    <AppText style={{ fontSize: 16, color: selectedBank ? colors.text : colors.muted }}>
                      {selectedBank?.name || "Choose a bank"}
                    </AppText>
                    <AppText style={{ fontSize: 16, color: colors.muted }}>▼</AppText>
                  </Pressable>

                  {/* Account Number */}
                  <AppText style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginBottom: 8 }}>
                    Account Number
                  </AppText>
                  <View style={styles.inputBox}>
                    <AppTextInput
                      style={{ flex: 1, fontSize: 18, fontWeight: "600", color: colors.text, paddingVertical: 12 }}
                      placeholder="Enter 10-digit account number"
                      placeholderTextColor={colors.muted}
                      value={accountNumber}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, "").slice(0, 10);
                        setAccountNumber(cleaned);
                        if (cleaned.length < 10) {
                          setIsVerified(false);
                          setAccountName("");
                        }
                      }}
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                    {verifying && <ActivityIndicator size="small" color={colors.primary} />}
                    {isVerified && <AppText style={{ fontSize: 18, color: colors.primary }}>✓</AppText>}
                  </View>

                  {/* Verified Account Name */}
                  {isVerified && accountName && (
                    <View style={{ backgroundColor: colors.greenSoft, borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 12 }}>
                      <AppText style={{ color: colors.greenDark, fontSize: 12, fontWeight: "600" }}>VERIFIED ACCOUNT</AppText>
                      <AppText style={{ color: colors.greenDark, fontSize: 18, fontWeight: "600", marginTop: 4 }}>{accountName}</AppText>
                    </View>
                  )}

                  {/* Save Recipient Checkbox */}
                  {isVerified && (
                    <Pressable
                      style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}
                      onPress={() => setSaveThisRecipient(!saveThisRecipient)}
                    >
                      <View style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: saveThisRecipient ? colors.primary : colors.muted,
                        backgroundColor: saveThisRecipient ? colors.primary : "transparent",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 10,
                      }}>
                        {saveThisRecipient && <AppText style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>✓</AppText>}
                      </View>
                      <AppText style={{ fontSize: 14, color: colors.textSecondary }}>Save this recipient for future transfers</AppText>
                    </Pressable>
                  )}

                  {/* Confirm Button */}
                  <Pressable
                    style={{
                      backgroundColor: canConfirm ? styles.primaryBtn.backgroundColor : colors.border,
                      height: 58,
                      paddingVertical: 15,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 20,
                    }}
                    onPress={handleConfirmNew}
                    disabled={!canConfirm}
                  >
                    <AppText style={{ color: canConfirm ? colors.actionText : colors.muted, fontSize: 16, fontWeight: "600" }}>
                      Continue
                    </AppText>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>

        <BankPickerModal
          visible={showBankPicker}
          banks={banks}
          banksLoading={banksLoading}
          onSelect={setSelectedBank}
          onClose={() => setShowBankPicker(false)}
          searchQuery={bankSearchQuery}
          setSearchQuery={setBankSearchQuery}
        />
      </View>
    </Modal>
  );
}

// ============================================================
// Confirmation Modal Component
// ============================================================
function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  fromAmount,
  fromCurrency,
  toAmount,
  toCurrency,
  rate,
  accountName,
  accountNumber,
  bankName,
  sending,
  liquidityBlock,
  liquidityChecking,
  onRetryLiquidity,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
  rate: number | null;
  accountName: string;
  accountNumber: string;
  bankName: string;
  sending: boolean;
  liquidityBlock?: LiquidityResult | null;
  liquidityChecking?: boolean;
  onRetryLiquidity?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
          <AppText style={{ fontSize: 20, fontWeight: "600", color: colors.text, textAlign: "center" }}>
            Confirm Transfer
          </AppText>

          <View style={{ marginTop: 24 }}>
            {/* Amount Summary */}
            <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <AppText style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>You send</AppText>
              <AppText style={{ fontSize: 20, fontWeight: "600", color: colors.text }}>
                {parseFloat(fromAmount || "0").toLocaleString()} {fromCurrency}
              </AppText>
              {rate && (
                <AppText style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
                  Rate: 1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}
                </AppText>
              )}
            </View>

            <View style={{ backgroundColor: colors.greenSoft, borderRadius: 16, padding: 16 }}>
              <AppText style={{ fontSize: 14, color: colors.greenDark, marginBottom: 4 }}>Recipient gets</AppText>
              <AppText style={{ fontSize: 24, fontWeight: "600", color: colors.greenDark }}>
                {toCurrency === "NGN" ? "₦" : ""}{parseFloat(toAmount || "0").toLocaleString()} {toCurrency}
              </AppText>
            </View>

            {/* Recipient Details */}
            <View style={{ marginTop: 16 }}>
              <DetailRow label="Recipient Name" value={accountName} />
              <DetailRow label="Account Number" value={accountNumber} />
              <DetailRow label="Bank" value={bankName} />
            </View>
          </View>

          {!!onRetryLiquidity && (
            <View style={{ marginTop: 16 }}>
              <LiquidityBanner
                result={liquidityBlock}
                retrying={!!liquidityChecking}
                onRetry={onRetryLiquidity}
              />
            </View>
          )}

          <View style={{ marginTop: 24, flexDirection: "row", gap: 12 }}>
            <Pressable
              style={{
                flex: 1, backgroundColor: colors.borderLight, alignItems: "center",
                height: 58,
                paddingVertical: 15,
                borderRadius: 999,
                justifyContent: "center",
                marginTop: 20,
              }}
              onPress={onClose}
              disabled={sending}
            >
              <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.textSecondary }}>Cancel</AppText>
            </Pressable>

            <Pressable
              style={[{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" }, styles.primaryBtn, !!liquidityBlock && { opacity: 0.5 }]}
              onPress={onConfirm}
              disabled={sending || !!liquidityBlock}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.actionText} />
              ) : (
                <AppText style={{ fontSize: 16, fontWeight: "600", color: colors.actionText }}>Send</AppText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
      <AppText style={{ fontSize: 14, color: colors.muted }}>{label}</AppText>
      <AppText style={{ fontSize: 14, fontWeight: "600", color: colors.text, textAlign: "right", flex: 1, marginLeft: 16 }}>{value}</AppText>
    </View>
  );
}

// ============================================================
// Quick Amount Button Component
// ============================================================
const QuickAmountButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    style={{
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: disabled ? "#E5E7EB" : "#F3F4F6",
      borderRadius: 16,
      marginRight: 8,
      opacity: disabled ? 0.5 : 1,
    }}
    onPress={onPress}
    disabled={disabled}
  >
    <AppText style={{ color: "#333", fontWeight: "600", fontSize: 13 }}>{label}</AppText>
  </Pressable>
);

// ============================================================
// Main SendMoneyScreen Component
// ============================================================
export default function SendMoneyScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles();

  const wm = useMemo(() => StyleSheet.create({

    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
    backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
    body: { padding: 16, paddingBottom: 32 },
    card: { backgroundColor: colors.card, borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: colors.borderLight, },
    cardLabel: { fontSize: 11, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 },
    amtRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    amtInput: { flex: 1, fontSize: 32, fontWeight: "600", color: colors.text, padding: 0 },
    amtInputReadonly: { flex: 1, fontSize: 32, fontWeight: "600", color: colors.textSecondary, padding: 0 },
    balRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
    balText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
    errText: { fontSize: 12, color: colors.red, fontWeight: "600" },
    quickRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    quickBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border },
    quickBtnDisabled: { backgroundColor: colors.borderLight, borderColor: colors.borderLight },
    quickBtnText: { fontSize: 12, fontWeight: "600", color: colors.primary },
    quickBtnTextDisabled: { color: colors.muted },
    midRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    arrowWrap: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" },
    rateBox: { flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center" },
    rateText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    ngnPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.greenSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    ngnPillText: { fontSize: 14, fontWeight: "600", color: colors.greenDark },
    continueBtn: { backgroundColor: colors.actionBg, borderRadius: 16, paddingVertical: 17, alignItems: "center", justifyContent: "center", marginTop: 8 },
    continueBtnDisabled: { backgroundColor: colors.border },
    continueBtnText: { color: colors.actionText, fontSize: 15, fontWeight: "600" },
    infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 14 },
    infoText: { fontSize: 12, color: colors.green, fontWeight: "600" },
  }), [colors]);

  const params = useLocalSearchParams();
  const initialFromCurrency = params.from as string | undefined;

  const [userPhone, setUserPhone] = useState<string>("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [fromWallet, setFromWallet] = useState<Wallet | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState(""); // Always in NGN
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [balanceExceeded, setBalanceExceeded] = useState(false);

  // ── Liquidity pre-flight (bank withdrawal: destination is always NGN) ──
  const [liquidityBlock, setLiquidityBlock] = useState<LiquidityResult | null>(null);
  const [liquidityChecking, setLiquidityChecking] = useState(false);
  const liquidityCheckSeq = useRef(0);

  // Modal states
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showRecipientDetails, setShowRecipientDetails] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Bank data
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);

  // Recipient details (for NGN transfers)
  const [recipientBank, setRecipientBank] = useState<Bank | null>(null);
  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [recipientAccountName, setRecipientAccountName] = useState("");

  // Load user phone
  useEffect(() => {
    AsyncStorage.getItem("user_phone").then((phone) => {
      if (phone) {
        setUserPhone(phone);
      } else {
        setLoading(false);
      }
    });
  }, []);

  // Load wallets
  useEffect(() => {
    if (userPhone) {
      loadWallets();
    }
  }, [userPhone]);

  // Load Nigerian banks
  useEffect(() => {
    const loadBanks = async () => {
      setBanksLoading(true);
      try {
        const bankList = await getNigerianBanks();
        setBanks(bankList);
      } catch (e) {
        console.error("Failed to load banks:", e);
      } finally {
        setBanksLoading(false);
      }
    };
    loadBanks();
  }, []);

  // Check balance exceeded
  useEffect(() => {
    if (fromWallet && fromAmount) {
      const amount = parseFloat(fromAmount) || 0;
      setBalanceExceeded(amount > fromWallet.balance);
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

        // Pre-select from wallet based on URL param
        let selectedFrom: Wallet | null = null;
        if (initialFromCurrency) {
          selectedFrom = activeWallets.find(
            (w: Wallet) => w.currencyCode.toUpperCase() === initialFromCurrency.toUpperCase()
          ) || null;
        }

        if (selectedFrom) {
          setFromWallet(selectedFrom);
        } else if (activeWallets.length >= 1) {
          setFromWallet(activeWallets[0]);
        }
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

  // Fetch quote when amount or currencies change - always convert to NGN
  const fetchQuote = useCallback(async () => {
    if (!fromWallet || !fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount("");
      setRate(null);
      return;
    }

    // If source is already NGN, no conversion needed
    if (fromWallet.currencyCode === "NGN") {
      setToAmount(fromAmount);
      setRate(1);
      return;
    }

    setQuoteLoading(true);
    try {
      const response = await getConversionQuote(
        userPhone,
        fromWallet.currencyCode,
        "NGN", // Always convert to NGN for Nigerian bank transfers
        parseFloat(fromAmount)
      );

      if (response.success) {
        setToAmount(response.quote.buyAmount.toFixed(2));
        setRate(response.quote.rate);
      } else {
        setToAmount("");
        setRate(null);
      }
    } catch (error) {
      console.error("Quote failed:", error);
      setToAmount("");
      setRate(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [fromWallet, fromAmount, userPhone]);

  // Debounce quote fetching
  useEffect(() => {
    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [fetchQuote]);

  // ── Liquidity pre-flight: runs on the destination (NGN) amount, 500ms debounce ──
  const runLiquidityCheck = useCallback(async () => {
    if (!toAmount || parseFloat(toAmount) <= 0) {
      setLiquidityBlock(null);
      return;
    }
    const seq = ++liquidityCheckSeq.current;
    setLiquidityChecking(true);
    try {
      const result = await checkLiquidity({
        currency: "NGN",
        amount: parseFloat(toAmount),
        operation: "bank_withdrawal",
      });
      if (seq !== liquidityCheckSeq.current) return; // a newer check superseded this one
      setLiquidityBlock(result.ok ? null : result);
    } finally {
      if (seq === liquidityCheckSeq.current) setLiquidityChecking(false);
    }
  }, [toAmount]);

  useEffect(() => {
    const debounce = setTimeout(runLiquidityCheck, 500);
    return () => clearTimeout(debounce);
  }, [runLiquidityCheck]);

  const handleQuickAmount = (percentage: number) => {
    if (fromWallet && fromWallet.balance > 0) {
      const amount = (fromWallet.balance * percentage).toFixed(2);
      setFromAmount(amount);
    }
  };

  const handleContinue = () => {
    if (!fromWallet || !fromAmount) return;

    const amount = parseFloat(fromAmount);
    if (amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    if (amount > fromWallet.balance) {
      Alert.alert("Insufficient Balance", `You only have ${fromWallet.formattedBalance} ${fromWallet.currencyCode}`);
      return;
    }

    // Always show bank details modal - destination is always Nigerian bank account
    // If source is not NGN, conversion happens behind the scenes
    setShowRecipientDetails(true);
  };

  const handleRecipientConfirmed = (bank: Bank, accountNumber: string, accountName: string) => {
    setRecipientBank(bank);
    setRecipientAccountNumber(accountNumber);
    setRecipientAccountName(accountName);
    setShowRecipientDetails(false);
    setShowConfirmation(true);
  };

  const handleConfirmSend = async () => {
    if (!recipientBank || !recipientAccountNumber || !recipientAccountName) return;

    setSending(true);
    try {
      const result = await sendNGN({
        phone: userPhone,
        amount: parseFloat(toAmount), // Send the converted NGN amount
        accountNumber: recipientAccountNumber,
        bankCode: recipientBank.code,
        bankName: recipientBank.name,
        accountName: recipientAccountName,
        narration: `Transfer from ${fromWallet?.currencyCode} to ${recipientAccountName}`,
      });

      if (result.success) {
        setShowConfirmation(false);
        router.push({
          pathname: "/result",
          params: {
            type: "success",
            title: "Transfer Successful!",
            message: `Sent ${fromAmount} ${fromWallet?.currencyCode} (₦${parseFloat(toAmount).toLocaleString()}) to ${recipientAccountName}`,
            subtitle: `${recipientBank.name} • ${recipientAccountNumber}`,
            amount: `${fromAmount} ${fromWallet?.currencyCode}`,
            transactionId: (result as any)?.transaction_id || (result as any)?.reference || (result as any)?.id || "",
            fee: (result as any)?.fee != null ? `${(result as any).fee} ${fromWallet?.currencyCode}` : "Free",
            recipientName: recipientAccountName,
            note: `${recipientBank.name} • ${recipientAccountNumber}`,
            primaryText: "Done",
            primaryRoute: "/(tabs)",
            secondaryText: "Send more",
            secondaryRoute: "/sendmoney",
          },
        });
      } else {
        const liquidityFail = isLiquidityLowResponse(result);
        if (liquidityFail) {
          setShowConfirmation(false);
          Alert.alert(
            "Try again in a few minutes",
            liquidityFail.message,
            [{ text: "OK" }]
          );
        } else {
          Alert.alert("Transfer Failed", result.message || "Failed to send money. Please try again.");
        }
      }
    } catch (e) {
      console.error("Send error:", e);
      const liquidityFail = isLiquidityLowResponse(e);
      if (liquidityFail) {
        setShowConfirmation(false);
        Alert.alert("Try again in a few minutes", liquidityFail.message, [{ text: "OK" }]);
      } else {
        Alert.alert("Error", "Failed to send money. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  // Removed swap function - destination is always NGN/Nigerian bank

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
        <View style={styles.simpleHeader}>
          <BackButton onPress={() => router.back()} showLabel={false} />
          <View style={{ flex: 1 }} />
        </View>

        <View style={{ flex: 1, padding: 20 }}>
          <AppText style={{ fontSize: 22, fontWeight: "600", color: "#333", marginBottom: 8 }}>
            Send Money
          </AppText>
          <AppText style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            You need at least 1 currency wallet to send money to Nigeria.
          </AppText>

          <Pressable
            style={{ backgroundColor: colors.actionBg, borderRadius: 12, padding: 16, alignItems: "center" }}
            onPress={() => router.push("/addaccount")}
          >
            <AppText style={{ color: colors.actionText, fontWeight: "600", fontSize: 16 }}>
              + Add Currency
            </AppText>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }
  const canContinue = fromWallet && fromAmount && parseFloat(fromAmount) > 0 && !balanceExceeded && (rate || fromWallet.currencyCode === "NGN") && !quoteLoading && !liquidityBlock && !liquidityChecking;

  return (
    <ScreenShell scrollable={false} padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

        {/* ── Header ── */}
        <View style={wm.header}>
          <Pressable onPress={() => router.back()} style={wm.backBtn}>
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          <AppText style={wm.headerTitle}>Withdraw</AppText>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={wm.body} keyboardShouldPersistTaps="handled">

          {/* ── FROM card ── */}
          <View style={wm.card}>
            <AppText style={wm.cardLabel}>You send</AppText>
            <View style={wm.amtRow}>
              <AppTextInput
                value={fromAmount}
                onChangeText={setFromAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.muted}
                style={[wm.amtInput, balanceExceeded && { color: colors.red }]}
              />
              <CurrencyPill
                flag={fromWallet?.flag || "🏳️"}
                code={fromWallet?.currencyCode || "Select"}
                countryCode={fromWallet?.countryCode ?? ""}
                onPress={() => setShowFromPicker(true)}
              />
            </View>
            <View style={wm.balRow}>
              <Ionicons name="wallet-outline" size={13} color={colors.muted} />
              <AppText style={[wm.balText, balanceExceeded && { color: colors.red }]}>
                {" "}Balance: {fromWallet?.formattedBalance || "0.00"} {fromWallet?.currencyCode || ""}
              </AppText>
              {balanceExceeded && <AppText style={wm.errText}> · Insufficient</AppText>}
            </View>

            {/* Quick amounts */}
            <View style={wm.quickRow}>
              {[["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["MAX", 1.0]].map(([label, pct]) => (
                <Pressable
                  key={label as string}
                  onPress={() => handleQuickAmount(pct as number)}
                  disabled={!fromWallet || fromWallet.balance <= 0}
                  style={({ pressed }) => [wm.quickBtn, (!fromWallet || fromWallet.balance <= 0) && wm.quickBtnDisabled, pressed && { opacity: 0.7 }]}
                >
                  <AppText style={[wm.quickBtnText, (!fromWallet || fromWallet.balance <= 0) && wm.quickBtnTextDisabled]}>{label as string}</AppText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Rate row ── */}
          <View style={wm.midRow}>
            <View style={wm.arrowWrap}>
              <Ionicons name="arrow-down-outline" size={18} color={colors.primary} />
            </View>
            <View style={wm.rateBox}>
              {quoteLoading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : rate
                  ? <AppText style={wm.rateText}>1 {fromWallet?.currencyCode} = {rate.toFixed(4)} NGN</AppText>
                  : fromWallet?.currencyCode === "NGN"
                    ? <AppText style={wm.rateText}>No conversion needed</AppText>
                    : <AppText style={wm.rateText}>Enter amount to see rate</AppText>
              }
            </View>
          </View>

          {/* ── TO card (always NGN) ── */}
          <View style={wm.card}>
            <AppText style={wm.cardLabel}>Recipient gets</AppText>
            <View style={wm.amtRow}>
              <AppTextInput
                value={quoteLoading ? "..." : toAmount}
                editable={false}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                style={wm.amtInputReadonly}
              />
              <View style={wm.ngnPill}>
                <AppText style={{ fontSize: 16 }}>🇳🇬</AppText>
                <AppText style={wm.ngnPillText}>NGN</AppText>
              </View>
            </View>
            <View style={wm.balRow}>
              <Ionicons name="business-outline" size={13} color={colors.muted} />
              <AppText style={wm.balText}> Sending to Nigerian Bank Account</AppText>
            </View>
          </View>

          {/* ── Liquidity banner ── */}
          <LiquidityBanner
            result={liquidityBlock}
            retrying={liquidityChecking}
            onRetry={runLiquidityCheck}
          />

          {/* ── Continue button ── */}
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || sending}
            style={({ pressed }) => [wm.continueBtn, (!canContinue || sending) && wm.continueBtnDisabled, pressed && { opacity: 0.85 }]}
          >
            <AppText style={wm.continueBtnText}>Continue</AppText>
          </Pressable>

          {/* ── Info ── */}
          <View style={wm.infoRow}>
            <Ionicons name="time-outline" size={13} color={colors.green} />
            <AppText style={wm.infoText}> Same-day delivery · Secured transfer</AppText>
          </View>

        </ScrollView>

        {/* Currency Picker Modal - Source wallet only */}
        <CurrencyPickerModal
          visible={showFromPicker}
          onClose={() => setShowFromPicker(false)}
          wallets={wallets}
          selected={fromWallet}
          onSelect={setFromWallet}
          title="Send From"
        />

        {/* Recipient Details Modal - Always NGN destination */}
        <RecipientDetailsModal
          visible={showRecipientDetails}
          onClose={() => setShowRecipientDetails(false)}
          onConfirm={handleRecipientConfirmed}
          banks={banks}
          banksLoading={banksLoading}
          amount={toAmount}
          toCurrency="NGN"
        />

        {/* Confirmation Modal */}
        <ConfirmationModal
          visible={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={handleConfirmSend}
          fromAmount={fromAmount}
          fromCurrency={fromWallet?.currencyCode || ""}
          toAmount={toAmount}
          toCurrency="NGN"
          rate={rate}
          accountName={recipientAccountName}
          accountNumber={recipientAccountNumber}
          bankName={recipientBank?.name || ""}
          sending={sending}
          liquidityBlock={liquidityBlock}
          liquidityChecking={liquidityChecking}
          onRetryLiquidity={runLiquidityCheck}
        />
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
