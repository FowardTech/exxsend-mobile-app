import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppText from "@/components/AppText";
import SimpleMarkdown from "@/components/SimpleMarkdown";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, SCREEN_PADDING } from "@/theme/designSystem";
import { getInvestContent } from "@/api/investments";

export function ackKey(phone: string): string {
  return `stock_info_acknowledged:${phone.replace(/[^a-zA-Z0-9]/g, "")}`;
}

export async function hasAcknowledgedStockInfo(phone: string): Promise<boolean> {
  if (!phone) return false;
  try {
    return (await AsyncStorage.getItem(ackKey(phone))) === "true";
  } catch {
    return false;
  }
}

interface Props {
  phone: string;
  onAcknowledge: () => void;
}

export default function InvestInfoScreen({ phone, onAcknowledge }: Props) {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("About Exxsend Stock");
  const [bodyMd, setBodyMd] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getInvestContent();
      if (res.success) {
        if (res.title) setTitle(res.title);
        setBodyMd(res.bodyMd || "");
      } else {
        setError(true);
      }
      setLoading(false);
    })();
  }, []);

  const handleAcknowledge = async () => {
    try {
      await AsyncStorage.setItem(ackKey(phone), "true");
    } catch {}
    onAcknowledge();
  };

  return (
    <SafeAreaView style={s.root}>
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={s.centered}>
          <AppText style={s.errorText}>Couldn't load this content. Please check your connection and try again.</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <AppText style={s.title}>{title}</AppText>
          <SimpleMarkdown content={bodyMd} />
        </ScrollView>
      )}

      <View style={s.footer}>
        <Pressable onPress={handleAcknowledge} disabled={loading || error} style={[s.btn, (loading || error) && { opacity: 0.5 }]}>
          <AppText style={s.btnText}>I have read and understood</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  errorText: { fontSize: 13, color: COLORS.muted, fontWeight: "600", textAlign: "center" },
  body: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.xl, paddingBottom: SPACE.huge },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.text, marginBottom: SPACE.lg },
  footer: { paddingHorizontal: SCREEN_PADDING, paddingVertical: SPACE.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight, backgroundColor: COLORS.bg },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
