import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, ActivityIndicator, Alert } from "react-native";
import AppText from "../../AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import ScreenShell from "../../../components/ScreenShell";
import type { SavedRecipient } from "./RecipientSelectScreen";
import { sendNGN } from "../../../api/flutterwave";
import { sendBankPayment } from "../../../api/currencycloud";

/** =========================
 *  Recent recipients storage
 *  ========================= */
type RecentRecipient = SavedRecipient & {
  destCurrency: "NGN" | "CAD";
  lastSentAt: number;
};

const RECENT_RECIPIENTS_KEY = "recent_recipients_v1";
const MAX_RECENTS = 10;

function makeRecentKey(destCurrency: "NGN" | "CAD", bankCode: string, accountNumber: string) {
  return `${destCurrency}:${bankCode}:${accountNumber}`;
}

async function getRecentRecipients(): Promise<RecentRecipient[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_RECIPIENTS_KEY);
    const list = raw ? (JSON.parse(raw) as RecentRecipient[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function addRecentRecipient(recipient: SavedRecipient, destCurrency: "NGN" | "CAD") {
  try {
    const existing = await getRecentRecipients();
    const key = makeRecentKey(destCurrency, recipient.bankCode, recipient.accountNumber);

    // de-dupe (remove previous same recipient)
    const filtered = existing.filter(
      (x) => makeRecentKey(x.destCurrency, x.bankCode, x.accountNumber) !== key
    );

    const next: RecentRecipient = {
      ...recipient,
      destCurrency,
      lastSentAt: Date.now(),
    };

    const updated = [next, ...filtered].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENT_RECIPIENTS_KEY, JSON.stringify(updated));
  } catch {
    // don't block transfer if AsyncStorage fails
  }
}

export default function TransferConfirmScreen() {
  const params = useLocalSearchParams<{
    destCurrency: "NGN" | "CAD";
    fromWalletId: string;
    fromCurrency: string;
    fromAmount: string;
    toAmount: string;
    rate?: string;
    recipient: string; // JSON
  }>();

  const recipient = useMemo(() => {
    try {
      return JSON.parse(params.recipient) as SavedRecipient;
    } catch {
      return null;
    }
  }, [params.recipient]);

  const [userPhone, setUserPhone] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("user_phone").then((p) => setUserPhone(p || ""));
  }, []);

  if (!recipient) {
    return (
      <ScreenShell>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <AppText>Recipient not found</AppText>
        </View>
      </ScreenShell>
    );
  }

  const fromAmount = params.fromAmount || "0";
  const toAmount = params.toAmount || "0";
  const destCurrency = params.destCurrency;

  const handleSend = async () => {
    if (!userPhone) {
      Alert.alert("Error", "Missing phone number. Please log in again.");
      return;
    }

    setSending(true);
    try {
      if (destCurrency === "NGN") {
        const result = await sendNGN({
          phone: userPhone,
          amount: parseFloat(toAmount),
          accountNumber: recipient.accountNumber,
          bankCode: recipient.bankCode,
          bankName: recipient.bankName,
          accountName: recipient.accountName,
          narration: `Transfer from ${params.fromCurrency} to ${recipient.accountName}`,
        });

        if (result.success) {
          // ✅ Save as recent recipient (ONLY on success)
          await addRecentRecipient(recipient, "NGN");

          router.replace({
            pathname: "/result",
            params: {
              type: "success",
              title: "Transfer Successful! 🎉",
              message: `Sent ${fromAmount} ${params.fromCurrency} (₦${parseFloat(toAmount).toLocaleString()}) to ${recipient.accountName}`,
              subtitle: `${recipient.bankName} • ${recipient.accountNumber}`,
              primaryText: "Done",
              primaryRoute: "/(tabs)",
              secondaryText: "Send more",
              secondaryRoute: "/sendmoney",
            },
          });
        } else {
          Alert.alert("Transfer Failed", result.message || "Failed to send money. Please try again.");
        }
      } else {
        // CAD EFT (your current flow)
        const result = await sendBankPayment({
          phone: userPhone,
          walletId: Number(params.fromWalletId),
          currency: "CAD",
          amount: Number(toAmount),
          recipientName: recipient.accountName,
          bankCountry: "CA",
          beneficiaryCountry: "CA",
          bankName: recipient.bankName,
          accountNumber: recipient.accountNumber,
          institutionNumber: "000",
          transitNumber: "00000",
          reason: "Bank Transfer",
          reference: `SEND-${Date.now()}`,
        });

        if (result.success) {
          // ✅ Save as recent recipient (ONLY on success)
          await addRecentRecipient(recipient, "CAD");

          router.replace({
            pathname: "/result",
            params: {
              type: "success",
              title: "Transfer Successful! 🎉",
              message: `Sent ${fromAmount} ${params.fromCurrency} ($${parseFloat(toAmount).toLocaleString()} CAD) via Bank Transfer`,
              subtitle: `To: ${recipient.accountName} (${recipient.bankName})\nRef: ${result.reference || "N/A"}`,
              primaryText: "Done",
              primaryRoute: "/(tabs)",
              secondaryText: "Send more",
              secondaryRoute: "/sendmoney",
            },
          });
        } else {
          Alert.alert("Transfer Failed", result.message || "Failed to send money. Please try again.");
        }
      }
    } catch (e) {
      Alert.alert("Error", "Failed to send money. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenShell>
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <Pressable onPress={() => router.back()} style={{ paddingVertical: 8, paddingRight: 10 }}>
            <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          </Pressable>
          <AppText style={{ fontSize: 20, fontWeight: "700" }}>Confirm Transfer</AppText>
        </View>

        <View style={{ backgroundColor: "#F9FAFB", borderRadius: 16, padding: 16 }}>
          <AppText style={{ color: "#6B7280", fontWeight: "700" }}>You send</AppText>
          <AppText style={{ marginTop: 6, fontSize: 22, fontWeight: "700" }}>
            {Number(fromAmount).toLocaleString()} {params.fromCurrency}
          </AppText>

          {params.rate ? (
            <AppText style={{ marginTop: 10, color: "#6B7280" }}>
              Rate: 1 {params.fromCurrency} = {Number(params.rate).toFixed(4)} {destCurrency}
            </AppText>
          ) : null}
        </View>

        <View style={{ marginTop: 14, backgroundColor: "#ECFDF5", borderRadius: 16, padding: 16 }}>
          <AppText style={{ color: "#065F46", fontWeight: "700" }}>Recipient gets</AppText>
          <AppText style={{ marginTop: 6, fontSize: 24, fontWeight: "700", color: "#065F46" }}>
            {destCurrency === "NGN" ? "₦" : "$"}
            {Number(toAmount).toLocaleString()} {destCurrency}
          </AppText>
        </View>

        <View
          style={{
            marginTop: 14,
            borderRadius: 16,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            padding: 16,
          }}
        >
          <AppText style={{ fontWeight: "700" }}>{recipient.accountName}</AppText>
          <AppText style={{ marginTop: 6, color: "#6B7280" }}>
            {recipient.bankName} • {recipient.accountNumber}
          </AppText>
        </View>

        <Pressable
          onPress={handleSend}
          disabled={sending}
          style={{
            marginTop: 18,
            height: 56,
            borderRadius: 28,
            backgroundColor: "#059669",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <AppText style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Send</AppText>
          )}
        </Pressable>
      </View>
    </ScreenShell>
  );
}
