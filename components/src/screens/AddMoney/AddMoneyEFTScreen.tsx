import React, { useState, useEffect, useCallback } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import AppText from "../../../AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import ScreenHeader from "../../../../components/ScreenHeader";
import { COLORS } from "@/theme/colors";

// ── Helpers ──────────────────────────────────────────────────
function generateReference(phone: string): string {
  const short = phone.replace(/\D/g, "").slice(-4);
  const ts = Date.now().toString(36).toUpperCase();
  return `EFT-${short}-${ts}`;
}

interface CopyRowProps { label: string; value: string }
function CopyRow({ label, value }: CopyRowProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={s.copyRow}>
      <View style={{ flex: 1 }}>
        <AppText style={s.copyLabel}>{label}</AppText>
        <AppText style={s.copyValue}>{value}</AppText>
      </View>
      <Pressable onPress={copy} style={s.copyBtn}>
        <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? COLORS.green : COLORS.primary} />
      </Pressable>
    </View>
  );
}

export default function AddMoneyEFTScreen() {
  const [loading, setLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState<{ institutionNumber: string; transitNumber: string; accountNumber: string; bankName: string; bankAddress: string } | null>(null);
  const [reference, setReference] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ph = await AsyncStorage.getItem("user_phone") || "";
        setUserPhone(ph);
        const ref = generateReference(ph);
        setReference(ref);

        // Fetch EFT bank details from user accounts cache
        const raw = await AsyncStorage.getItem("cached_accounts_v1");
        if (raw) {
          const accts = JSON.parse(raw);
          const cad = accts.find((a: any) => a.currencyCode === "CAD");
          if (cad) {
            setBankDetails({
              institutionNumber: cad.institutionNumber || "614",
              transitNumber: cad.transitNumber || cad.sortCode || "00001",
              accountNumber: cad.accountNumber || "",
              bankName: cad.bankName || "Exxsend Financial",
              bankAddress: cad.bankAddress || "Toronto, ON, Canada",
            });
          }
        }
      } catch (e) {
        console.error("EFT screen load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleISent = useCallback(async () => {
    setConfirming(true);
    try {
      // Record pending EFT in local activity list
      const pending = JSON.parse(await AsyncStorage.getItem("pending_eft_transfers") || "[]");
      pending.unshift({
        id: reference,
        reference,
        type: "EFT Deposit",
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem("pending_eft_transfers", JSON.stringify(pending.slice(0, 20)));

      Alert.alert(
        "Transfer Noted",
        "Your EFT is being tracked. Funds typically arrive within 1–3 business days.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert("Error", "Could not record transfer.");
    } finally {
      setConfirming(false);
    }
  }, [reference]);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScreenHeader title="Bank Transfer (EFT)" onBack={() => router.back()} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {/* Info banner */}
          <View style={s.infoBanner}>
            <Ionicons name="time-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
            <AppText style={s.infoText}>Funds typically arrive within <AppText style={{ fontWeight: "700" }}>1–3 business days</AppText>. No fees for EFT deposits.</AppText>
          </View>

          {/* Step 1: Reference */}
          <View style={s.section}>
            <View style={s.stepHeader}>
              <View style={s.stepNum}><AppText style={s.stepNumText}>1</AppText></View>
              <AppText style={s.stepTitle}>Your payment reference</AppText>
            </View>
            <AppText style={s.stepDesc}>Include this reference in your EFT so we can match your payment automatically.</AppText>
            <View style={s.refBox}>
              <CopyRow label="Reference code" value={reference} />
            </View>
          </View>

          {/* Step 2: Bank Details */}
          <View style={s.section}>
            <View style={s.stepHeader}>
              <View style={s.stepNum}><AppText style={s.stepNumText}>2</AppText></View>
              <AppText style={s.stepTitle}>Send your EFT to these details</AppText>
            </View>
            <AppText style={s.stepDesc}>Use these bank details when setting up the transfer in your online banking.</AppText>
            <View style={s.detailsCard}>
              <CopyRow label="Bank name" value={bankDetails?.bankName || "Exxsend Financial"} />
              <View style={s.divider} />
              <CopyRow label="Institution number" value={bankDetails?.institutionNumber || "614"} />
              <View style={s.divider} />
              <CopyRow label="Transit number" value={bankDetails?.transitNumber || "00001"} />
              <View style={s.divider} />
              <CopyRow label="Account number" value={bankDetails?.accountNumber || "—"} />
              <View style={s.divider} />
              <CopyRow label="Address" value={bankDetails?.bankAddress || "Toronto, ON, Canada"} />
            </View>
          </View>

          {/* Step 3: Confirm */}
          <View style={s.section}>
            <View style={s.stepHeader}>
              <View style={s.stepNum}><AppText style={s.stepNumText}>3</AppText></View>
              <AppText style={s.stepTitle}>Confirm you've sent the EFT</AppText>
            </View>
            <AppText style={s.stepDesc}>Tap below once you've initiated the transfer from your bank. We'll track it and notify you when it arrives.</AppText>
          </View>

          <Pressable
            onPress={handleISent}
            disabled={confirming}
            style={({ pressed }) => [s.confirmBtn, pressed && { opacity: 0.85 }]}
          >
            {confirming
              ? <ActivityIndicator color={COLORS.actionText} />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.actionText} />
                  <AppText style={s.confirmBtnText}>I've sent the EFT</AppText>
                </>
            }
          </Pressable>

          <View style={s.secureRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.green} />
            <AppText style={s.secureText}> Your transfer is protected by Exxsend</AppText>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, paddingBottom: 40 },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  infoText: { flex: 1, fontSize: 13, color: COLORS.primary, fontWeight: "500", lineHeight: 20 },
  section: { marginBottom: 16 },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  stepNum: { width: 26, height: 26, borderRadius: 999, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center" },
  stepNumText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  stepTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  stepDesc: { fontSize: 13, color: COLORS.muted, fontWeight: "500", lineHeight: 20, marginBottom: 12, marginLeft: 36 },
  refBox: { backgroundColor: COLORS.primaryLight, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: "dashed", overflow: "hidden" },
  detailsCard: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderLight, overflow: "hidden" },
  copyRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  copyLabel: { fontSize: 11, color: COLORS.muted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  copyValue: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  copyBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  divider: { height: 1, backgroundColor: COLORS.borderLight },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.actionBg, borderRadius: 16, paddingVertical: 17 },
  confirmBtnText: { color: COLORS.actionText, fontSize: 15, fontWeight: "700" },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16 },
  secureText: { fontSize: 12, color: COLORS.muted, fontWeight: "600" },
});
