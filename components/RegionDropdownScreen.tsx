import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { COLORS } from "../theme/colors";
import { styles } from "../theme/styles";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";

export type Region = { code: string; name: string };

type Props = {
  label: string;               // "State" or "Province"
  value: Region | null;
  onChange: (region: Region) => void;
  regions: Region[];           // list for the selected country
};

export default function RegionDropdown({ label, value, onChange, regions }: Props) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q)
    );
  }, [regions, search]);

  const pick = (r: Region) => {
    onChange(r);
    setVisible(false);
    setSearch("");
  };

  const handleClose = () => {
    setVisible(false);
    setSearch("");
  };

  return (
    <>
      <AppText style={styles.inputLabel}>{label}</AppText>

      <Pressable style={styles.inputBox} onPress={() => setVisible(true)}>
        <AppText style={{ flex: 1, color: value ? COLORS.text : "#B3B3B3", fontSize: 16 }}>
          {value ? value.name : `Select ${label.toLowerCase()}`}
        </AppText>
        <AppText style={{ fontSize: 18, color: COLORS.text }}>⌄</AppText>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <Pressable style={rd.overlay} onPress={handleClose}>
          <Pressable style={rd.sheet} onPress={() => { }}>
            <View style={rd.header}>
              <Pressable onPress={handleClose} style={rd.closeBtn} hitSlop={10}>
                <AppText style={rd.closeText}>✕</AppText>
              </Pressable>
              <AppText style={rd.title}>Select {label}</AppText>
              <View style={{ width: 30 }} />
            </View>

            <AppTextInput
              style={rd.searchInput}
              placeholder={`Search ${label.toLowerCase()}...`}
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const selected = value?.code === item.code;
                return (
                  <Pressable
                    onPress={() => pick(item)}
                    style={[rd.item, selected && rd.itemSelected]}
                  >
                    <View style={rd.itemInfo}>
                      <AppText style={rd.itemName}>{item.name}</AppText>
                      <AppText style={rd.itemDialCode}>{item.code}</AppText>
                    </View>
                    {selected ? <AppText style={rd.checkmark}>✓</AppText> : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<AppText style={rd.emptyText}>No results</AppText>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const rd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  closeBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 18, color: "#6B7280" },
  title: { fontSize: 18, fontWeight: "600", color: "#1F2937" },
  searchInput: {
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: "#F3F4F6", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: "#1F2937",
  },
  item: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F9FAFB", gap: 12,
  },
  itemSelected: { backgroundColor: "#F0FDF4" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "600", color: "#1F2937" },
  itemDialCode: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  checkmark: { fontSize: 18, color: "#059669", fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#9CA3AF", marginTop: 40, fontSize: 16 },
});
