import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, Modal, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../theme/colors";
import { listBeneficiaries, Beneficiary } from "../api/currencycloud";

interface Props {
  visible: boolean;
  currency: string;
  selected?: Beneficiary | null;
  onClose: () => void;
  onSelect: (beneficiary: Beneficiary) => void;
  onAddNew: () => void;
}

export default function BeneficiaryPickerModal({ visible, currency, selected, onClose, onSelect, onAddNew }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setLoading(true);
    setError("");
    listBeneficiaries(currency)
      .then((res) => {
        if (!mounted) return;
        if (res.success) {
          setBeneficiaries(res.beneficiaries || []);
        } else {
          setError(res.message || "Could not load saved beneficiaries");
        }
      })
      .catch(() => {
        if (mounted) setError("Could not load saved beneficiaries");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [visible, currency]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return beneficiaries;
    return beneficiaries.filter(
      (b) =>
        (b.name || b.bank_account_holder_name || "").toLowerCase().includes(q) ||
        (b.bank_name || "").toLowerCase().includes(q)
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
                const displayName = item.name || item.bank_account_holder_name;
                const accountTail = item.account_number
                  ? `•••• ${item.account_number.slice(-4)}`
                  : item.iban
                  ? `•••• ${item.iban.slice(-4)}`
                  : "";
                return (
                  <Pressable
                    onPress={() => onSelect(item)}
                    style={[s.item, isSelected && s.itemSelected]}
                  >
                    <View style={s.avatar}>
                      <AppText style={s.avatarText}>
                        {(displayName || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                      </AppText>
                    </View>
                    <View style={s.itemInfo}>
                      <AppText style={s.itemName}>{displayName}</AppText>
                      <AppText style={s.itemMeta}>
                        {item.bank_name || "Bank"}{accountTail ? ` · ${accountTail}` : ""}
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
