import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, Modal, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../theme/colors";
import { getSavedRecipients } from "../api/sync";
import RecipientAvatar from "./RecipientAvatar";
import { RecentRecipientFromDB } from "../api/sync";

interface Props {
  visible: boolean;
  currency: string;
  selected?: RecentRecipientFromDB | null;
  onClose: () => void;
  onSelect: (beneficiary: RecentRecipientFromDB) => void;
  onAddNew: () => void;
}

export default function BeneficiaryPickerModal({ visible, currency, selected, onClose, onSelect, onAddNew }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<RecentRecipientFromDB[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setLoading(true);
    setError("");
    (async () => {
      const phone = (await AsyncStorage.getItem("user_phone")) || "";
      const res = await getSavedRecipients(phone, currency);
      if (!mounted) return;
      if (res.success) {
        const bankOnly = (res.recipients || []).filter(
          (r) => r.payoutMethod !== "exxsend" && r.bankCode !== "EXXSEND"
        );
        setBeneficiaries(bankOnly);
      } else {
        setError(res.message || "Could not load saved beneficiaries");
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [visible, currency]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return beneficiaries;
    return beneficiaries.filter(
      (b) =>
        (b.accountName || "").toLowerCase().includes(q) ||
        (b.bankName || "").toLowerCase().includes(q)
    );
  }, [beneficiaries, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.header}>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={10}>
              <AppText style={s.closeText}>✕</AppText>
            </Pressable>
            <AppText style={s.title}>Saved Beneficiaries</AppText>
            <View style={{ width: 30 }} />
          </View>

          <AppTextInput
            style={s.searchInput}
            placeholder="Search beneficiaries..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />

          <Pressable style={s.addNewRow} onPress={onAddNew}>
            <View style={s.addNewIcon}>
              <AppText style={{ color: COLORS.primary, fontSize: 18, fontWeight: "700" }}>+</AppText>
            </View>
            <AppText style={s.addNewText}>Add a new beneficiary</AppText>
          </Pressable>

          {loading ? (
            <View style={s.centerBox}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : error ? (
            <View style={s.centerBox}>
              <Ionicons name="cloud-offline-outline" size={28} color={COLORS.muted} style={{ marginBottom: 10 }} />
              <AppText style={s.emptyText}>{error}</AppText>
              <AppText style={[s.emptyText, { marginTop: 6, fontSize: 12 }]}>
                You can still send by entering bank details above.
              </AppText>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selected?.id === item.id;
                const displayName = item.accountName;
                const accountTail = item.accountNumber
                  ? `•••• ${item.accountNumber.slice(-4)}`
                  : "";
                return (
                  <Pressable
                    onPress={() => onSelect(item)}
                    style={[s.item, isSelected && s.itemSelected]}
                  >
                    <RecipientAvatar
                      name={displayName || "?"}
                      currencyCode={currency}
                      countryCode={item.countryCode}
                      photoUrl={item.avatarUrl}
                      size={40}
                      backgroundColor={COLORS.primaryLight}
                      textColor={COLORS.primary}
                    />
                    <View style={s.itemInfo}>
                      <AppText style={s.itemName}>{displayName}</AppText>
                      <AppText style={s.itemMeta}>
                        {item.bankName || "Bank"}{accountTail ? ` · ${accountTail}` : ""}
                      </AppText>
                    </View>
                    {isSelected ? <AppText style={s.checkmark}>✓</AppText> : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={s.centerBox}>
                  <AppText style={s.emptyText}>No saved beneficiaries for {currency} yet</AppText>
                </View>
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  closeBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 18, color: "#6B7280" },
  title: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  searchInput: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: "#F3F4F6", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: "#1F2937",
  },
  addNewRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginTop: 10, marginBottom: 6,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.primaryLight, borderRadius: 12,
  },
  addNewIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },
  addNewText: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  centerBox: { paddingVertical: 40, alignItems: "center" },
  emptyText: { textAlign: "center", color: "#9CA3AF", fontSize: 14, paddingHorizontal: 24 },
  item: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#F9FAFB", gap: 12,
  },
  itemSelected: { backgroundColor: "#F0FDF4" },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  itemMeta: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  checkmark: { fontSize: 18, color: "#059669", fontWeight: "700" },
});
