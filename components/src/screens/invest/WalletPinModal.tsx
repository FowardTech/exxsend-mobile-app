import React, { useState } from "react";
import { View, Alert, ActivityIndicator, StyleSheet } from "react-native";
import PinVerificationModal from "@/components/PinVerificationModal";
import { subscribeWithWallet } from "@/api/investments";
import { COLORS } from "@/theme/colors";

interface WalletPinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  phone: string;
  /** Which wallet to debit, per the new /wallet-options + /subscribe
   * contract. Omitted defaults to the backend's USD behavior. */
  walletCurrency?: string;
}

export default function WalletPinModal({ visible, onClose, onSuccess, phone, walletCurrency }: WalletPinModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handlePinVerified = async () => {
    setSubmitting(true);
    try {
      const res = await subscribeWithWallet(phone, walletCurrency);
      setSubmitting(false);
      if (res.success) {
        onSuccess();
        return;
      }
      if (res.insufficientFunds) {
        const { required, currency, available, priceCurrency, price } = res.insufficientFunds;
        const planCost = priceCurrency && price !== undefined ? ` (the plan costs ${price.toFixed(2)} ${priceCurrency})` : "";
        Alert.alert(
          "Insufficient wallet balance",
          `You need ${currency} ${required.toFixed(2)} from this wallet${planCost}, but your ${currency} wallet only has ${currency} ${available.toFixed(2)}. Add funds and try again.`
        );
      } else {
        Alert.alert("Couldn't complete subscription", res.message || "Please try again.");
      }
      onClose();
    } catch {
      setSubmitting(false);
      Alert.alert("Something went wrong", "Please try again.");
      onClose();
    }
  };

  return (
    <>
      <PinVerificationModal
        visible={visible && !submitting}
        onClose={onClose}
        onSuccess={handlePinVerified}
        title="Confirm subscription"
        subtitle="Enter your PIN to pay for Stock from your wallet."
      />
      {submitting && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
});
