import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { getCountries } from "../api/config";
import { COLORS } from "../theme/colors";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";
import CountryFlag from "./CountryFlag";

export interface Country {
  code: string;
  name: string;
  flag?: string;
  dialCode?: string;
}

interface Props {
  value: Country | null;
  onChange: (country: Country) => void;
}

export default function CountryDropdown({ value, onChange }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    getCountries()
      .then((data) => {
        if (mounted && data.length > 0) {
          setCountries(data);
          if (!value) {
            onChange(data[0]);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch countries:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredCountries = useMemo(
    () =>
      countries.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()) ||
          (c.dialCode ?? "").includes(search)
      ),
    [countries, search]
  );

  const handleSelect = (country: Country) => {
    onChange(country);
    setVisible(false);
    setSearch("");
  };

  const handleClose = () => {
    setVisible(false);
    setSearch("");
  };

  if (!value) {
    return (
      <View style={dd.countryBox}>
        <CountryFlag size="md" fallbackEmoji="🏳️" />
        <AppText style={dd.arrow}>▼</AppText>
      </View>
    );
  }

  return (
    <>
      <Pressable style={dd.countryBox} onPress={() => setVisible(true)}>
        <CountryFlag countryCode={value.code} fallbackEmoji={value.flag ?? "🏳️"} size="md" />
        <AppText style={dd.arrow}>▼</AppText>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <Pressable style={dd.overlay} onPress={handleClose}>
          <Pressable style={dd.sheet} onPress={() => { }}>
            <View style={dd.header}>
              <Pressable onPress={handleClose} style={dd.closeBtn} hitSlop={10}>
                <AppText style={dd.closeText}>✕</AppText>
              </Pressable>
              <AppText style={dd.title}>Select Country</AppText>
              <View style={{ width: 30 }} />
            </View>

            <AppTextInput
              style={dd.searchInput}
              placeholder="Search country..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    dd.item,
                    item.code === value.code && dd.itemSelected,
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <CountryFlag countryCode={item.code} fallbackEmoji={item.flag ?? "🏳️"} size="md" />
                  <View style={dd.itemInfo}>
                    <AppText style={dd.itemName}>{item.name}</AppText>
                    <AppText style={dd.itemDialCode}>{item.dialCode ?? ""}</AppText>
                  </View>
                  {item.code === value.code && (
                    <AppText style={dd.checkmark}>✓</AppText>
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <AppText style={dd.emptyText}>No countries found</AppText>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const dd = StyleSheet.create({
  countryBox: {
    width: 72, height: 56, borderRadius: 14,
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.border,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
  },
  arrow: { fontSize: 10, color: COLORS.muted },
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