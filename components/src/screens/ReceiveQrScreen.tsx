import React, { useEffect, useState } from "react";
import { View, Pressable, ActivityIndicator, Share, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import AppText from "@/components/AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER, SCREEN_PADDING } from "@/theme/designSystem";
import { getUserProfile } from "@/api/config";
import { toHandle } from "@/utils/handle";

/**
 * Encodes the user's @handle (not their raw phone number or internal id —
 * a QR code is meant to be shown to anyone, so it shouldn't expose either)
 * as an exxsend://pay/<username> deep link. ScanToPayScreen.tsx decodes
 * this and looks the username up via GET /api/users/lookup — that endpoint
 * only resolves by username, so the QR has to carry the username itself,
 * not an internal id there's no endpoint to resolve back into one.
 */
function buildPayCode(username: string): string {
  return `exxsend://pay/${encodeURIComponent(username)}`;
}

export default function ReceiveQrScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const phone = (await AsyncStorage.getItem("user_phone")) || "";
        if (!phone) { setLoading(false); return; }
        const res = await getUserProfile(phone);
        if (res.success && res.user) {
          const first = res.user.firstName || res.user.first_name || "";
          const last = res.user.lastName || res.user.lastName || "";
          setHandle(toHandle(first, last));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const payCode = handle ? buildPayCode(handle.replace(/^@/, "")) : "";

  const handleShare = async () => {
    if (!payCode) return;
    try {
      await Share.share({
        message: `Send me money on ExxSend — scan my code in the app, or use this link: ${payCode}`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)} style={s.iconBtn}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <AppText style={s.headerTitle}>My QR Code</AppText>
        <Pressable onPress={handleShare} disabled={!payCode} style={s.iconBtn}>
          <Ionicons name="share-outline" size={20} color={payCode ? COLORS.text : COLORS.border} />
        </Pressable>
      </View>

      <View style={s.body}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : !payCode ? (
          <View style={s.errorWrap}>
            <Ionicons name="alert-circle-outline" size={32} color={COLORS.muted} />
            <AppText style={s.errorText}>Couldn't load your QR code. Please try again later.</AppText>
          </View>
        ) : (
          <>
            <AppText style={s.subtitle}>
              Other ExxSend users can scan this code to send you money instantly.
            </AppText>

            <View style={s.qrCard}>
              <QRCode
                value={payCode}
                size={220}
                color={COLORS.text}
                backgroundColor="#FFFFFF"
              />
            </View>

            {!!handle && <AppText style={s.userName}>{handle}</AppText>}
            <AppText style={s.handleHint}>Your ExxSend Pay Code</AppText>

            <Pressable onPress={() => router.push("/scantopay" as any)} style={s.scanBtn}>
              <Ionicons name="scan-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
              <AppText style={s.scanBtnText}>Scan someone else's code instead</AppText>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  iconBtn: { width: 38, height: 38, borderRadius: RADIUS.full, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center", ...GLASS_BORDER, ...CARD_SHADOW },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: "center", marginBottom: SPACE.xxl, lineHeight: 20, paddingHorizontal: SPACE.lg },
  qrCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: SPACE.xxl, ...GLASS_BORDER, ...CARD_SHADOW },
  userName: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: SPACE.xxl },
  handleHint: { fontSize: 13, color: COLORS.muted, fontWeight: "600", marginTop: SPACE.xs },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: SPACE.xxxl, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xxl },
  scanBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  errorWrap: { alignItems: "center", gap: SPACE.md },
  errorText: { fontSize: 14, color: COLORS.muted, textAlign: "center" },
});
