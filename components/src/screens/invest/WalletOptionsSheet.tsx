import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "@/components/AppText";
import CountryFlag from "@/components/CountryFlag";
import BottomSheet from "@/components/BottomSheet";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS } from "@/theme/designSystem";
import { getCurrencySymbol } from "@/api/flutterwave";
import { WalletOption } from "@/api/investments";

interface Props {
  visible: boolean;
  onClose: () => void;
  priceCurrency: string;
  price: number;
  options: WalletOption[];
  onSelect: (option: WalletOption) => void;
}

export default function WalletOptionsSheet({ visible, onClose, priceCurrency, price, options, onSelect }: Props) {
  const prizeSym = getCurrencySymbol(priceCurrency);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pay with Wallet">
      <AppText style={s.subtitle}>
        Invest costs {prizeSym}{price.toFixed(2)} {priceCurrency}/month. Choose which wallet to pay from.
      </AppText>

      {options.length === 0 ? (
        <AppText style={s.emptyText}>You don't have any wallets yet.</AppText>
      ) : (
        <View style={{ gap: SPACE.sm }}>
          {options.map((opt) => {
            const sym = getCurrencySymbol(opt.currency);
            return (
              <Pressable
                key={opt.currency}
                onPress={() => opt.sufficient && onSelect(opt)}
                disabled={!opt.sufficient}
                style={[s.row, !opt.sufficient && s.rowDisabled]}
              >
                <CountryFlag currencyCode={opt.currency} size="md" />
                <View style={{ flex: 1, marginLeft: SPACE.md }}>
                  <AppText style={[s.currency, !opt.sufficient && s.mutedText]}>{opt.currency}</AppText>
                  <AppText style={[s.balance, !opt.sufficient && s.mutedText]}>
                    Balance: {sym}{opt.balance.toFixed(2)}
                  </AppText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <AppText style={[s.required, !opt.sufficient && s.mutedText]}>
                    ≈ {sym}{opt.requiredAmount.toFixed(2)}
                  </AppText>
                  {opt.sufficient ? (
                    <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
                  ) : (
                    <AppText style={s.insufficientLabel}>Insufficient</AppText>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  subtitle: { fontSize: 13, color: COLORS.muted, fontWeight: "600", marginBottom: SPACE.lg, lineHeight: 19 },
  emptyText: { fontSize: 14, color: COLORS.muted, textAlign: "center", paddingVertical: SPACE.xl },
  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.md,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  rowDisabled: { opacity: 0.5 },
  currency: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  balance: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  required: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  insufficientLabel: { fontSize: 11, color: COLORS.red, fontWeight: "700", marginTop: 2 },
  mutedText: { color: COLORS.muted },
});
