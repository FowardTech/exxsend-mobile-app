import { Ionicons } from "@expo/vector-icons";
import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../../theme/colors";
import { RADIUS, SPACE } from "../../../theme/designSystem";
import AppText from "../../AppText";

/**
 * Expected QR payload shape for an ExxSend "pay me" code: an
 * exxsend://pay/<username> deep link (see ReceiveQrScreen.tsx for how it's
 * built) or the equivalent JSON shape. Decodes to a username and hands it
 * to /exxsendmembers, which looks the member up via GET /api/users/lookup
 * and sends via POST /api/transfers/internal — the member-to-member flow,
 * not the bank/recipient send flow. (This used to redirect into
 * /sendmoney, which only knows how to send to a saved bank recipient —
 * that's why continuing the flow ended up asking for bank details even
 * though you'd scanned another ExxSend user's code.)
 */
function parseExxSendPayCode(data: string): { username: string } | null {
  try {
    const url = new URL(data);
    if (url.protocol === "exxsend:" && url.hostname === "pay") {
      const username = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (username) return { username };
    }
  } catch { }

  try {
    const parsed = JSON.parse(data);
    if (parsed?.app === "exxsend" && parsed?.type === "pay" && parsed?.handle) {
      return { username: String(parsed.handle).replace(/^@/, "") };
    }
  } catch { }

  return null;
}

export default function ScanToPayScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const processingRef = useRef(false);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanned(true);

    const parsed = parseExxSendPayCode(result.data);
    if (!parsed) {
      Alert.alert(
        "Not an ExxSend code",
        "This QR code isn't a recognized ExxSend Pay code.",
        [{ text: "Scan again", onPress: () => { setScanned(false); processingRef.current = false; } }]
      );
      return;
    }

    router.replace({
      pathname: "/exxsendmembers" as any,
      params: { scannedUsername: parsed.username },
    } as any);
  };

  if (!permission) {
    return <SafeAreaView style={s.root} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.permissionWrap}>
          <View style={s.permissionIcon}>
            <Ionicons name="qr-code-outline" size={36} color={COLORS.primary} />
          </View>
          <AppText style={s.permissionTitle}>Camera access needed</AppText>
          <AppText style={s.permissionSub}>
            ExxSend needs camera access to scan Pay codes.
          </AppText>
          <Pressable onPress={requestPermission} style={s.permissionBtn}>
            <AppText style={s.permissionBtnText}>Allow Camera Access</AppText>
          </Pressable>
          {!permission.canAskAgain && (
            <Pressable onPress={() => Linking.openSettings()} style={s.permissionLink}>
              <AppText style={s.permissionLinkText}>Open Settings</AppText>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()} style={s.permissionLink}>
            <AppText style={s.permissionLinkText}>Cancel</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <SafeAreaView style={s.overlay} edges={["top", "bottom"]}>
        <View style={s.topBar}>
          <Pressable onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <AppText style={s.topTitle}>Scan to Pay</AppText>
          <Pressable onPress={() => setTorchOn((t) => !t)} style={s.iconBtn}>
            <Ionicons name={torchOn ? "flash" : "flash-outline"} size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={s.frameWrap}>
          <View style={s.frame}>
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
          </View>
          <AppText style={s.frameHint}>
            Point your camera at another ExxSend user's Pay code
          </AppText>
        </View>

        <View style={{ flex: 1 }} />

        <Pressable onPress={() => router.push("/(tabs)/myqr" as any)} style={s.myCodeBtn}>
          <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <AppText style={s.myCodeBtnText}>Show my code instead</AppText>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  overlay: { flex: 1, backgroundColor: "transparent" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  topTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  frameWrap: { alignItems: "center", marginTop: SPACE.huge * 2 },
  frame: { width: 260, height: 260, position: "relative" },
  corner: { position: "absolute", width: 36, height: 36, borderColor: COLORS.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: RADIUS.sm },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: RADIUS.sm },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: RADIUS.sm },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: RADIUS.sm },
  frameHint: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: SPACE.xl, paddingHorizontal: SPACE.xxxl },
  permissionWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE.xxxl },
  permissionIcon: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: SPACE.lg },
  permissionTitle: { fontSize: 18, fontWeight: "600", color: COLORS.text, marginBottom: SPACE.sm },
  permissionSub: { fontSize: 14, color: COLORS.muted, textAlign: "center", marginBottom: SPACE.xl, lineHeight: 20 },
  permissionBtn: { backgroundColor: COLORS.actionBg, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xxxl, alignItems: "center" },
  permissionBtnText: { color: COLORS.actionText, fontSize: 15, fontWeight: "600" },
  permissionLink: { marginTop: SPACE.lg, alignItems: "center" },
  permissionLinkText: { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
  myCodeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: SPACE.xxxl, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: RADIUS.full, paddingVertical: SPACE.sm + 2, paddingHorizontal: SPACE.xl },
  myCodeBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
