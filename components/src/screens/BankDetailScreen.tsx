import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import {
  Bank,
  getNigerianBanks,
  verifyBankAccount,
} from "../../../api/flutterwave";
import { COLORS } from "../../../theme/colors";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import ScreenShell from "./../../ScreenShell";

// Bank picker modal component
function BankPickerModal({
  visible,
  banks,
  onSelect,
  onClose,
  searchQuery,
  setSearchQuery,
}: {
  visible: boolean;
  banks: Bank[];
  onSelect: (bank: Bank) => void;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  if (!visible) return null;

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
        zIndex: 100,
      }}
    >
      <Pressable
        style={{ flex: 1 }}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: "#fff",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: "70%",
          paddingBottom: 40,
        }}
      >
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText style={{ fontSize: 18, fontWeight: "600", color: "#1F2937" }}>
              Select Bank
            </AppText>
            <Pressable onPress={onClose}>
              <AppText style={{ fontSize: 16, color: "#6B7280" }}>Cancel</AppText>
            </Pressable>
          </View>

          <AppTextInput
            style={{
              marginTop: 16,
              backgroundColor: "#F3F4F6",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              color: "#1F2937",
            }}
            placeholder="Search banks..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        <ScrollView style={{ paddingHorizontal: 20 }}>
          {filteredBanks.map((bank) => (
            <Pressable
              key={bank.code}
              style={{
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#F3F4F6",
              }}
              onPress={() => {
                onSelect(bank);
                onClose();
              }}
            >
              <AppText style={{ fontSize: 16, color: "#1F2937" }}>{bank.name}</AppText>
              <AppText style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                Code: {bank.code}
              </AppText>
            </Pressable>
          ))}

          {filteredBanks.length === 0 && (
            <AppText style={{ textAlign: "center", color: "#9CA3AF", marginTop: 20 }}>
              No banks found
            </AppText>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

export default function BankDetailsScreen() {
  const router = useRouter();

  const [userPhone, setUserPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Bank data
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);

  // Form state
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  // Modal state
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");

  // Load user phone and existing details
  useEffect(() => {
    const loadData = async () => {
      try {
        const phone = await AsyncStorage.getItem("user_phone");
        if (phone) {
          setUserPhone(phone);

          // Load existing payout details from AsyncStorage if available
          const saved = await AsyncStorage.getItem("user_payout_details");
          if (saved) {
            try {
              const details = JSON.parse(saved) as {
                isConfigured?: boolean;
                accountNumber?: string;
                accountName?: string;
                bankCode?: string;
                bankName?: string;
              };
              if (details?.isConfigured) {
                setAccountNumber(details.accountNumber || "");
                setAccountName(details.accountName || "");
                if (details.bankCode && details.bankName) {
                  setSelectedBank({
                    code: details.bankCode,
                    name: details.bankName,
                  });
                  setIsVerified(true);
                }
              }
            } catch (parseErr) {
              console.warn("Failed to parse saved payout details:", parseErr);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load user data:", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Load Nigerian banks
  useEffect(() => {
    const loadBanks = async () => {
      setBanksLoading(true);
      try {
        const bankList = await getNigerianBanks();
        setBanks(bankList);
      } catch (e) {
        console.error("Failed to load banks:", e);
        Alert.alert("Error", "Failed to load banks. Please try again.");
      } finally {
        setBanksLoading(false);
      }
    };

    loadBanks();
  }, []);

  // Verify account when account number is complete
  const handleVerifyAccount = useCallback(async () => {
    if (!selectedBank || accountNumber.length < 10) {
      Alert.alert("Invalid Input", "Please select a bank and enter a valid 10-digit account number.");
      return;
    }

    setVerifying(true);
    setIsVerified(false);
    setAccountName("");

    try {
      const result = await verifyBankAccount(accountNumber, selectedBank.code);

      if (result.success && result.accountName) {
        setAccountName(result.accountName);
        setIsVerified(true);
      } else {
        Alert.alert(
          "Verification Failed",
          result.message || "Could not verify account. Please check the details and try again."
        );
      }
    } catch (e) {
      console.error("Verification error:", e);
      Alert.alert("Error", "Failed to verify account. Please try again.");
    } finally {
      setVerifying(false);
    }
  }, [selectedBank, accountNumber]);

  // Auto-verify when account number reaches 10 digits
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank && !isVerified && !verifying) {
      handleVerifyAccount();
    }
  }, [accountNumber, selectedBank, isVerified, verifying, handleVerifyAccount]);

  // Reset verification when bank or account changes
  useEffect(() => {
    setIsVerified(false);
    setAccountName("");
  }, [selectedBank?.code]);

  const handleSave = async () => {
    if (!isVerified || !selectedBank || !accountNumber || !accountName) {
      Alert.alert("Incomplete", "Please verify your account before saving.");
      return;
    }

    setSaving(true);

    try {
      const details = {
        isConfigured: true,
        accountNumber,
        accountName,
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
      };
      await AsyncStorage.setItem("user_payout_details", JSON.stringify(details));

      Alert.alert(
        "Success",
        "Your bank details have been saved. Future NGN payouts will be sent automatically to this account.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e) {
      console.error("Save error:", e);
      Alert.alert("Error", "Failed to save bank details. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return (
      <ScreenShell >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS?.primary || "#1D4ED8"} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ marginBottom: 24 }}>
            <AppText style={{ fontSize: 14, color: "#6B7280", lineHeight: 20 }}>
              Add your Nigerian bank account for automatic NGN payouts. When you convert to NGN,
              funds will be sent directly to this account.
            </AppText>
          </View>

          {/* Bank Selection */}
          <View style={{ marginBottom: 20 }}>
            <AppText style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 }}>
              Bank
            </AppText>
            <Pressable
              style={{
                backgroundColor: "#F9FAFB",
                borderWidth: 1,
                borderColor: selectedBank ? "#1D4ED8" : "#E5E7EB",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onPress={() => setShowBankPicker(true)}
              disabled={banksLoading}
            >
              <AppText
                style={{
                  fontSize: 16,
                  color: selectedBank ? "#1F2937" : "#9CA3AF",
                }}
              >
                {banksLoading
                  ? "Loading banks..."
                  : selectedBank
                    ? selectedBank.name
                    : "Select your bank"}
              </AppText>
              <AppText style={{ fontSize: 18, color: "#9CA3AF" }}>▼</AppText>
            </Pressable>
          </View>

          {/* Account Number */}
          <View style={{ marginBottom: 20 }}>
            <AppText style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 }}>
              Account Number
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <AppTextInput
                style={{
                  flex: 1,
                  backgroundColor: "#F9FAFB",
                  borderWidth: 1,
                  borderColor: isVerified ? "#10B981" : "#E5E7EB",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: "#1F2937",
                }}
                placeholder="0123456789"
                placeholderTextColor="#9CA3AF"
                value={accountNumber}
                onChangeText={(text) => {
                  // Only allow digits, max 10
                  const digits = text.replace(/\D/g, "").slice(0, 10);
                  setAccountNumber(digits);
                  if (digits.length < 10) {
                    setIsVerified(false);
                    setAccountName("");
                  }
                }}
                keyboardType="number-pad"
                maxLength={10}
              />
              {verifying && (
                <ActivityIndicator
                  size="small"
                  color={COLORS?.primary || "#1D4ED8"}
                  style={{ marginLeft: 12 }}
                />
              )}
              {isVerified && (
                <AppText style={{ marginLeft: 12, fontSize: 20 }}>✓</AppText>
              )}
            </View>
            <AppText style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
              Enter your 10-digit NUBAN account number
            </AppText>
          </View>

          {/* Account Name (auto-filled after verification) */}
          {accountName ? (
            <View style={{ marginBottom: 24 }}>
              <AppText style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 }}>
                Account Name
              </AppText>
              <View
                style={{
                  backgroundColor: "#ECFDF5",
                  borderWidth: 1,
                  borderColor: "#10B981",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <AppText style={{ fontSize: 16, color: "#065F46", fontWeight: "600" }}>
                  {accountName}
                </AppText>
              </View>
              <AppText style={{ fontSize: 12, color: "#10B981", marginTop: 4 }}>
                ✓ Account verified successfully
              </AppText>
            </View>
          ) : null}

          {/* Verify Button (if not auto-verified) */}
          {selectedBank && accountNumber.length === 10 && !isVerified && !verifying && (
            <Pressable
              style={{
                backgroundColor: "#F3F4F6",
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginBottom: 20,
              }}
              onPress={handleVerifyAccount}
            >
              <AppText style={{ fontSize: 16, fontWeight: "600", color: "#4B5563" }}>
                Verify Account
              </AppText>
            </Pressable>
          )}

          {/* Save Button */}
          <Pressable
            style={{
              backgroundColor: isVerified ? (COLORS?.primary || "#1D4ED8") : "#E5E7EB",
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 12,
            }}
            onPress={handleSave}
            disabled={!isVerified || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <AppText
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: isVerified ? "#fff" : "#9CA3AF",
                }}
              >
                Save Bank Details
              </AppText>
            )}
          </Pressable>

          {/* Info Card */}
          <View
            style={{
              backgroundColor: "#FEF3C7",
              borderRadius: 12,
              padding: 16,
              marginTop: 24,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Ionicons name="flash" size={14} color="#92400E" style={{ marginRight: 5 }} />
              <AppText style={{ fontSize: 14, fontWeight: "600", color: "#92400E" }}>
                Automatic Payouts
              </AppText>
            </View>
            <AppText style={{ fontSize: 13, color: "#92400E", lineHeight: 18 }}>
              Once saved, any conversion to NGN will automatically trigger a payout to this
              bank account within minutes. You can update these details anytime.
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bank Picker Modal */}
      <BankPickerModal
        visible={showBankPicker}
        banks={banks}
        onSelect={(bank) => {
          setSelectedBank(bank);
          setIsVerified(false);
          setAccountName("");
        }}
        onClose={() => {
          setShowBankPicker(false);
          setBankSearchQuery("");
        }}
        searchQuery={bankSearchQuery}
        setSearchQuery={setBankSearchQuery}
      />
    </ScreenShell>
  );
}