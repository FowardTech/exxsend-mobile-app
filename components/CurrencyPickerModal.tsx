/**
 * CurrencyPickerModal - Modal for selecting currencies from user wallets
 * Supports search filtering and disabled wallet display
 */
import React, { useState } from "react";
import { View, Pressable, Modal, FlatList, StyleSheet } from "react-native";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";
import { COLORS } from "../theme/colors";
import CountryFlag from "./CountryFlag";

export interface Wallet {
  id: number;
  currencyCode: string;
  currencyName: string;
  countryName: string | null;
  countryCode?: string;
  flag: string;
  symbol: string;
  balance: number;
  formattedBalance: string;
  status: string;
}

interface CurrencyPickerModalProps {
  visible: boolean;
  onClose: () => void;
  wallets: Wallet[];
  selected: Wallet | null;
  onSelect: (wallet: Wallet) => void;
  title?: string;
}

export default function CurrencyPickerModal({
  visible,
  onClose,
  wallets,
  selected,
  onSelect,
  title = "Select Currency",
}: CurrencyPickerModalProps) {
  const [search, setSearch] = useState("");

  const filteredWallets = wallets.filter(
    (w) =>
      w.currencyCode.toLowerCase().includes(search.toLowerCase()) ||
      (w.countryName?.toLowerCase() || "").includes(search.toLowerCase())
  );

  const handleSelect = (wallet: Wallet) => {
    if (wallet.status === "disabled") {
      // Could show alert here
      return;
    }
    onSelect(wallet);
    onClose();
    setSearch("");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <AppText style={styles.closeText}>✕</AppText>
            </Pressable>
            <AppText style={styles.title}>{title}</AppText>
            <View style={{ width: 30 }} />
          </View>

          <AppTextInput
            style={styles.searchInput}
            placeholder="Search currency..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />

          <FlatList
            data={filteredWallets}
            keyExtractor={(item) => item.currencyCode}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.item,
                  item.currencyCode === selected?.currencyCode && styles.itemSelected,
                  item.status === "disabled" && { opacity: 0.5 },
                ]}
                onPress={() => handleSelect(item)}
              >
                <CountryFlag 
                  countryCode={item.countryCode} 
                  currencyCode={item.currencyCode} 
                  fallbackEmoji={item.flag} 
                  size="md" 
                />
                <View style={styles.itemInfo}>
                  <AppText style={styles.itemName}>
                    {item.currencyCode} - {item.countryName || item.currencyName}
                  </AppText>
                  <AppText style={styles.itemBalance}>
                    Balance: {item.formattedBalance}
                    {item.status === "disabled" && " (Disabled)"}
                  </AppText>
                </View>
                {item.currencyCode === selected?.currencyCode && (
                  <AppText style={styles.checkmark}>✓</AppText>
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <AppText style={styles.emptyText}>No currencies found</AppText>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  closeBtn: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    fontSize: 18,
    color: "#6B7280",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  searchInput: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1F2937",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
    gap: 12,
  },
  itemSelected: {
    backgroundColor: "#F0FDF4",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  itemBalance: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: "#059669",
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    color: "#9CA3AF",
    marginTop: 40,
    fontSize: 16,
  },
});
