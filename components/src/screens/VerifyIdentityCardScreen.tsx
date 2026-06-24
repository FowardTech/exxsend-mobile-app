import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import AppText from "../../AppText";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/theme/colors";

interface Props { onPress: () => void; userPhone: string; }

export default function VerifyIdentityCardScreen({ onPress, userPhone }: Props) {
  return (
    <View style={s.wrap}>
      <LinearGradient colors={["#FFFBEB", "#FEF3C7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        <View style={s.left}>
          <View style={s.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#D97706" />
          </View>
          <View style={s.textCol}>
            <View style={s.labelRow}>
              <View style={s.dot} />
              <AppText style={s.label}>Required</AppText>
            </View>
            <AppText style={s.title}>Verify your identity</AppText>
            <AppText style={s.sub}>Unlock full features & sending limits</AppText>
          </View>
        </View>
        <Pressable onPress={onPress} style={s.btn}>
          <AppText style={s.btnText}>Start</AppText>
          <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 10 },
  card: { borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#FDE68A" },
  left: { flex: 1, flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginRight: 12,},
  textCol: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D97706" },
  label: { fontSize: 10, fontWeight: "700", color: "#B45309", textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  btn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#D97706", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  btnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
});
